<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CustomerHistoryController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /**
     * Read-only booking history for the authenticated customer. Ownership
     * comes exclusively from the token's user id (reservation -> user_id);
     * no user or branch identifier is accepted from the client, and
     * customers are never branch-filtered because a customer may hold
     * reservations across several branches. Nothing is ever written here
     * — a past confirmed reservation keeps status "confirmed".
     *
     * History is a UI classification, not a database status: cancelled,
     * expired and completed reservations always belong here (even for a
     * future screening), and any other reservation belongs here once its
     * screening has ended on the Asia/Manila cinema clock. No qr_token,
     * token, password or unrelated customer data is exposed.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $now = Carbon::now(self::CINEMA_TIMEZONE);

        /** @var Collection<int, Reservation> $reservations */
        $reservations = Reservation::query()
            ->where('user_id', $user->id)
            ->with([
                'schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
                'schedule.movie:id,title,poster_url',
                'schedule.screen:id,name',
                'schedule.branch:id,name',
                'reservationSeats.seat:id,row_label,seat_number',
                'payments:id,reservation_id,payment_method,amount,status,created_at',
            ])
            ->get();

        // Null-safe sort keys: a status-included reservation with
        // incomplete schedule data still ships, sorting as an empty
        // string (last in DESC) instead of crashing.
        $rows = $reservations
            ->filter(fn (Reservation $reservation) => $this->isHistory($reservation, $now))
            ->map(fn (Reservation $reservation) => [
                'reservation' => $reservation,
                'show_date' => (string) ($reservation->schedule?->show_date ?? ''),
                'start_time' => (string) ($reservation->schedule?->start_time ?? ''),
                'reserved_at' => (string) ($reservation->reserved_at ?? ''),
                'id' => (int) $reservation->id,
            ])
            ->values();

        // Newest past screening first: show_date DESC, start_time DESC,
        // ties broken by reserved_at DESC then id DESC. Sorting runs only
        // on eager-loaded values, so no extra queries.
        $sorted = $rows->sortBy([
            ['show_date', 'desc'],
            ['start_time', 'desc'],
            ['reserved_at', 'desc'],
            ['id', 'desc'],
        ])->values();

        return response()->json([
            'history' => $sorted->map(fn (array $row) => $this->historyPayload($row['reservation']))->values(),
        ]);
    }

    /**
     * In history when the reservation is cancelled, expired or completed
     * (regardless of screening date), or when the screening has already
     * ended. Strict greater-than against the cinema clock: at exactly
     * end_time the booking belongs in History. Missing schedule data can
     * never classify a reservation as finished — only the status rule
     * above can.
     */
    private function isHistory(Reservation $reservation, Carbon $now): bool
    {
        if (in_array($reservation->status, ['cancelled', 'expired', 'completed'], true)) {
            return true;
        }

        $schedule = $reservation->schedule;

        if ($schedule === null || $schedule->show_date === null || $schedule->end_time === null) {
            return false;
        }

        $showEnd = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $schedule->show_date.' '.$schedule->end_time,
            self::CINEMA_TIMEZONE
        );

        return ! $showEnd->gt($now);
    }

    /**
     * Newest payment wins on created_at DESC then id DESC (not id alone).
     * A payment-less reservation returns payment: null — the frontend
     * hides the block while still showing the payment summary.
     *
     * @return array<string, mixed>
     */
    private function latestPayment(Reservation $reservation): ?array
    {
        $payment = $reservation->payments
            ->sortByDesc(fn (Payment $payment) => [
                $payment->created_at?->getTimestamp() ?? 0,
                $payment->id,
            ])
            ->first();

        if ($payment === null) {
            return null;
        }

        return [
            'method' => $payment->payment_method,
            'status' => $payment->status,
            'amount' => (string) $payment->amount,
        ];
    }

    /**
     * Raw schedule/date strings only; the frontend formats display.
     * Seat labels come from eager-loaded reservation seats — no N+1.
     *
     * @return array<string, mixed>
     */
    private function historyPayload(Reservation $reservation): array
    {
        $schedule = $reservation->schedule;

        return [
            'id' => $reservation->id,
            'reservation_code' => $reservation->reservation_code,
            'status' => $reservation->status,
            'subtotal' => (string) $reservation->subtotal,
            'discount_amount' => (string) $reservation->discount_amount,
            'total_amount' => (string) $reservation->total_amount,
            'reserved_at' => $reservation->reserved_at !== null
                ? (string) $reservation->reserved_at
                : null,
            'movie' => $schedule?->movie ? [
                'id' => $schedule->movie->id,
                'title' => $schedule->movie->title,
                'poster_url' => $schedule->movie->poster_url,
            ] : null,
            'branch' => [
                'id' => $schedule?->branch?->id,
                'name' => $schedule?->branch?->name,
            ],
            'screen' => [
                'id' => $schedule?->screen?->id,
                'name' => $schedule?->screen?->name,
            ],
            'schedule' => [
                'show_date' => $schedule?->show_date,
                'start_time' => $schedule?->start_time,
                'end_time' => $schedule?->end_time,
            ],
            'seats' => $reservation->reservationSeats
                ->map(fn ($reservationSeat) => [
                    'label' => $reservationSeat->seat
                        ? $reservationSeat->seat->row_label.$reservationSeat->seat->seat_number
                        : null,
                ])
                ->filter(fn (array $seat) => $seat['label'] !== null)
                ->values()
                ->all(),
            'payment' => $this->latestPayment($reservation),
        ];
    }
}
