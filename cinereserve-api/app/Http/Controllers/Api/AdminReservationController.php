<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationSeat;
use Illuminate\Http\Request;

class AdminReservationController extends Controller
{
    /**
     * Reservations of the authenticated admin's branch only. The branch
     * is always derived from the admin account; no branch identifier is
     * ever accepted from the client.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $branchId = $user->branch_id;
        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        // Keeps statuses correct even when the scheduler isn't running.
        Reservation::expireStale();

        $reservations = Reservation::query()
            ->whereHas('schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->with([
                'user:id,name,email',
                'schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
                'schedule.movie:id,title',
                'schedule.branch:id,name',
                'schedule.screen:id,name',
                'reservationSeats.seat',
                'payments',
            ])
            ->orderByDesc('reserved_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Reservation $reservation) => $this->reservationPayload($reservation));

        return response()->json(['reservations' => $reservations]);
    }

    /**
     * @return array<string, mixed>
     */
    private function reservationPayload(Reservation $reservation): array
    {
        $schedule = $reservation->schedule;

        return [
            'id' => $reservation->id,
            'reservation_code' => $reservation->reservation_code,
            'subtotal' => $reservation->subtotal,
            'discount_amount' => $reservation->discount_amount,
            'total_amount' => $reservation->total_amount,
            'status' => $reservation->status,
            'reserved_at' => $reservation->reserved_at,
            'expires_at' => $reservation->expires_at,
            'customer' => $reservation->user ? [
                'id' => $reservation->user->id,
                'name' => $reservation->user->name,
                'email' => $reservation->user->email,
            ] : null,
            'movie' => $schedule?->movie ? [
                'id' => $schedule->movie->id,
                'title' => $schedule->movie->title,
            ] : null,
            'schedule' => $schedule ? [
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
            ] : null,
            'screen' => [
                'name' => $schedule?->screen?->name,
            ],
            'branch' => [
                'id' => $schedule?->branch?->id,
                'name' => $schedule?->branch?->name,
            ],
            'seats' => $reservation->reservationSeats
                ->map(fn (ReservationSeat $reservationSeat) => [
                    'id' => $reservationSeat->seat_id,
                    'label' => $reservationSeat->seat
                        ? $reservationSeat->seat->row_label.$reservationSeat->seat->seat_number
                        : null,
                    'price' => $reservationSeat->price,
                    'status' => $reservationSeat->status,
                ])
                ->values()
                ->all(),
            'payment' => $this->latestPayment($reservation),
        ];
    }

    /**
     * A reservation may hold several payment records; only the newest
     * (highest created_at, ties broken by highest id) is reported.
     * Read-only: no payment is created or modified here.
     *
     * @return array{method: string, status: string, amount: string|int|float}|null
     */
    private function latestPayment(Reservation $reservation): ?array
    {
        /** @var Payment|null $payment */
        $payment = $reservation->payments
            ->sortByDesc(fn (Payment $payment) => [
                $payment->created_at?->getTimestamp() ?? 0,
                $payment->id,
            ])
            ->first();

        if (! $payment) {
            return null;
        }

        return [
            'method' => $payment->payment_method,
            'status' => $payment->status,
            'amount' => $payment->amount,
        ];
    }
}
