<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerPaymentController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /**
     * Payment summary for one pending reservation of the authenticated
     * customer. Ownership is resolved strictly through reservations.user_id
     * = the token's user id; a reservation that belongs to somebody else
     * resolves exactly like a missing one (404) so nothing about other
     * customers' bookings is ever leaked. Nothing is written here.
     */
    public function show(Request $request, string $reservationId): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $reservation = Reservation::query()
            ->where('id', $reservationId)
            ->where('user_id', $user->id)
            ->with([
                'schedule:id,movie_id,branch_id,screen_id,show_date,start_time',
                'schedule.movie:id,title',
                'schedule.branch:id,name',
                'schedule.screen:id,name',
                'reservationSeats:id,reservation_id,seat_id,price',
                'reservationSeats.seat:id,row_label,seat_number',
            ])
            ->first();

        if ($reservation === null) {
            return response()->json(['message' => 'Reservation not found.'], 404);
        }

        $payableError = $this->payableError($reservation);

        if ($payableError !== null) {
            return response()->json(['message' => $payableError['message']], $payableError['status']);
        }

        $schedule = $reservation->schedule;

        return response()->json([
            'reservation' => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
                'subtotal' => (string) $reservation->subtotal,
                'discount_amount' => (string) $reservation->discount_amount,
                'total_amount' => (string) $reservation->total_amount,
                'expires_at' => $reservation->expires_at instanceof \DateTimeInterface
                    ? $reservation->expires_at->toIso8601String()
                    : ($reservation->expires_at !== null
                        ? Carbon::parse((string) $reservation->expires_at)->toIso8601String()
                        : null),
                // Navigation aid only (Choose Seats Again deep link). The
                // client never sends it back as trusted input.
                'schedule_id' => $schedule?->id,
                'movie' => ['title' => $schedule?->movie?->title],
                'branch' => ['name' => $schedule?->branch?->name],
                'screen' => ['name' => $schedule?->screen?->name],
                'show_date' => $schedule?->show_date,
                'start_time' => $schedule?->start_time,
                'seats' => $reservation->reservationSeats
                    ->map(fn ($reservationSeat) => [
                        'label' => $reservationSeat->seat
                            ? $reservationSeat->seat->row_label.$reservationSeat->seat->seat_number
                            : null,
                        'price' => (string) $reservationSeat->price,
                    ])
                    ->filter(fn (array $seat) => $seat['label'] !== null)
                    ->values()
                    ->all(),
            ],
        ]);
    }

    /**
     * Simulated payment. The body may carry only payment_method=mock;
     * customer, reservation, ownership, amount, payment reference, payment
     * status, reservation status, the ticket (code + qr_token) and the
     * admin branch notification are all resolved server-side inside one
     * transaction, so no partial "paid but unconfirmed" or "confirmed but
     * unticketed" state can exist. Idempotent retries return the existing
     * records without writing a second notification; inconsistent legacy
     * states fail with 409 and are never repaired here.
     */
    public function pay(Request $request, string $reservationId): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'payment_method' => ['required', 'string', 'in:mock'],
        ]);

        $userId = (int) $user->id;

        $result = DB::transaction(function () use ($userId, $reservationId, $validated): array {
            // 1-2. Row lock with ownership baked into the WHERE clause: a
            // foreign reservation locks nothing and reports 404, and every
            // concurrent payment attempt for THIS reservation serializes on
            // the same row.
            $reservation = Reservation::query()
                ->where('id', $reservationId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($reservation === null) {
                return ['status' => 404, 'body' => ['message' => 'Reservation not found.']];
            }

            // Existing paid payment, fetched under the lock: all payers for
            // this reservation are serialized, so this check is race-free.
            $existingPayment = $reservation->payments()
                ->where('status', 'paid')
                ->orderByDesc('id')
                ->first();

            // Ticket state for this reservation, also fetched under the
            // lock. Legacy data may hold more than one ticket; the branches
            // below surface that instead of arbitrarily picking one, and
            // nothing is ever deleted, merged or repaired automatically.
            $existingTickets = Ticket::query()
                ->where('reservation_id', $reservation->id)
                ->orderBy('id')
                ->get();

            // 3. Recheck status under the lock.
            if ($reservation->status === 'confirmed') {
                if ($existingPayment === null) {
                    return ['status' => 409, 'body' => ['message' => 'This reservation is not payable.']];
                }

                // Legacy duplicate tickets: fail safe, never choose one.
                if ($existingTickets->count() > 1) {
                    return ['status' => 409, 'body' => ['message' => 'Multiple tickets exist for this reservation.']];
                }

                // Confirmed but ticketless: an idempotent success requires
                // an existing ticket. No repair ticket is created here.
                if ($existingTickets->count() === 0) {
                    return ['status' => 409, 'body' => ['message' => 'The booking is confirmed, but its ticket is unavailable.']];
                }

                // Idempotent retry: return the already-successful payment,
                // reservation and existing ticket; nothing new is created.
                return [
                    'status' => 200,
                    'body' => $this->successPayload($existingPayment, $reservation, $existingTickets->first()),
                ];
            }

            if ($reservation->status === 'expired') {
                return ['status' => 409, 'body' => ['message' => 'This reservation has expired.']];
            }

            if ($reservation->status !== 'pending') {
                return ['status' => 409, 'body' => ['message' => 'This reservation is not payable.']];
            }

            // 4. Recheck the seat hold under the lock (holds block
            // occupancy only while expires_at is strictly in the future).
            if ($reservation->expires_at !== null
                && ! Carbon::parse((string) $reservation->expires_at)->isFuture()
            ) {
                return ['status' => 409, 'body' => ['message' => 'This reservation has expired.']];
            }

            // 5. The reservation must still own its seats. Seat rows are
            // immutable in this version (no cancel/modify path exists), so
            // this is a defensive existence check only — no repair.
            if ($reservation->reservationSeats()->count() === 0) {
                return ['status' => 409, 'body' => ['message' => 'This reservation has no seats.']];
            }

            // 6. pending + already-paid is an inconsistent state: never
            // duplicate the payment, never silently repair — fail safe.
            if ($existingPayment !== null) {
                return ['status' => 409, 'body' => ['message' => 'This reservation is not payable.']];
            }

            // 7. A ticket that exists before its payment is equally
            // inconsistent — fail safe: no duplicate payment, no second
            // ticket, no automatic repair.
            if ($existingTickets->isNotEmpty()) {
                return ['status' => 409, 'body' => ['message' => 'This reservation is not payable.']];
            }

            // 8. Server-generated unique reference, Asia/Manila date part.
            $payment = new Payment;
            $payment->reservation_id = $reservation->id;
            $payment->payment_reference = $this->generatePaymentReference();
            $payment->payment_method = $validated['payment_method'];
            // 9. Amount copied straight from the reservation — zero math,
            // never client input.
            $payment->amount = $reservation->total_amount;
            $payment->status = 'paid';
            $payment->paid_at = now();

            // 10-11. Payment row and confirmation commit together; any
            // failure rolls both back.
            $payment->save();

            $reservation->status = 'confirmed';
            $reservation->save();

            // 12. One ticket per reservation — the reservation already owns
            // every selected seat. Created inside the same transaction: if
            // the ticket insert fails, the payment and the confirmation
            // roll back with it, so no partial state can exist.
            $ticket = new Ticket;
            $ticket->reservation_id = $reservation->id;
            $ticket->ticket_code = $this->generateTicketCode();
            $ticket->qr_token = $this->generateQrToken();
            $ticket->status = 'valid';
            $ticket->checked_in_at = null;
            $ticket->save();

            // 13. Admin notification for the reservation's branch, inside
            // the same transaction as payment + confirmation + ticket: any
            // rollback removes it with them, and it is written ONLY on
            // this first-success branch — the idempotent 200 retry above
            // returns before reaching this point, so a retry can never
            // produce a second notification. data holds metadata only:
            // no email, phone, qr_token or credentials.
            $reservation->load([
                'user:id,name',
                'schedule:id,movie_id,branch_id,screen_id,show_date,start_time',
                'schedule.movie:id,title',
                'schedule.screen:id,name',
            ]);

            $notification = new AdminNotification;
            $notification->branch_id = (int) $reservation->schedule?->branch_id;
            $notification->type = 'booking_confirmed';
            $notification->title = 'Booking Confirmed';
            $notification->message = $reservation->reservation_code.' has been paid and confirmed.';
            $notification->data = [
                'reservation_id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'customer_name' => $reservation->user?->name,
                'movie_title' => $reservation->schedule?->movie?->title,
                'branch_id' => (int) $reservation->schedule?->branch_id,
                'payment_reference' => $payment->payment_reference,
                'total_amount' => (string) $reservation->total_amount,
            ];
            $notification->read_at = null;
            $notification->save();

            return [
                'status' => 201,
                'body' => $this->successPayload($payment, $reservation, $ticket),
            ];
        });

        return response()->json($result['body'], $result['status']);
    }

    /**
     * Payability verdict for a loaded (unlocked) reservation — fast path
     * only; pay() repeats every check under lockForUpdate().
     *
     * @return array{status: int, message: string}|null
     */
    private function payableError(Reservation $reservation): ?array
    {
        if ($reservation->status === 'expired') {
            return ['status' => 409, 'message' => 'This reservation has expired.'];
        }

        if ($reservation->status !== 'pending') {
            return ['status' => 409, 'message' => 'This reservation is not payable.'];
        }

        if ($reservation->expires_at !== null
            && ! Carbon::parse((string) $reservation->expires_at)->isFuture()
        ) {
            return ['status' => 409, 'message' => 'This reservation has expired.'];
        }

        return null;
    }

    /**
     * PAY-ManilaDate-SUFFIX, server-generated only. The existence loop
     * retries the unlikely unique-reference collision.
     */
    private function generatePaymentReference(): string
    {
        do {
            $reference = 'PAY-'.Carbon::now(self::CINEMA_TIMEZONE)->format('Ymd')
                .'-'.Str::upper(Str::random(6));
        } while (Payment::where('payment_reference', $reference)->exists());

        return $reference;
    }

    /**
     * Identical body for 201 (new payment) and 200 (idempotent retry).
     * The qr_token credential is deliberately absent — the QR token stays
     * private to the ticket endpoint of a future QR-display step.
     *
     * @return array{payment: array<string, mixed>, reservation: array<string, mixed>, ticket: array<string, mixed>}
     */
    private function successPayload(Payment $payment, Reservation $reservation, Ticket $ticket): array
    {
        return [
            'payment' => [
                'id' => $payment->id,
                'payment_reference' => $payment->payment_reference,
                'payment_method' => $payment->payment_method,
                'amount' => (string) $payment->amount,
                'status' => $payment->status,
                'paid_at' => $payment->paid_at instanceof \DateTimeInterface
                    ? $payment->paid_at->toIso8601String()
                    : ($payment->paid_at !== null
                        ? Carbon::parse((string) $payment->paid_at)->toIso8601String()
                        : null),
            ],
            'reservation' => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
                'total_amount' => (string) $reservation->total_amount,
            ],
            'ticket' => [
                'id' => $ticket->id,
                'ticket_code' => $ticket->ticket_code,
                'status' => $ticket->status,
            ],
        ];
    }

    /**
     * TKT-ManilaDate-SUFFIX, server-generated only; never accepted from
     * the client. The existence loop retries the unlikely unique-code
     * collision (tickets.ticket_code carries a unique index).
     */
    private function generateTicketCode(): string
    {
        do {
            $ticketCode = 'TKT-'.Carbon::now(self::CINEMA_TIMEZONE)->format('Ymd')
                .'-'.Str::upper(Str::random(6));
        } while (Ticket::where('ticket_code', $ticketCode)->exists());

        return $ticketCode;
    }

    /**
     * Cryptographically secure 64-character token (Str::random uses
     * random_bytes). It derives from no customer, reservation, contact or
     * sequential data, is never accepted from the client, and is never
     * returned in the payment response — tickets.qr_token only.
     */
    private function generateQrToken(): string
    {
        do {
            $qrToken = Str::random(64);
        } while (Ticket::where('qr_token', $qrToken)->exists());

        return $qrToken;
    }
}
