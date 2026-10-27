<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\Request;

class AdminTicketController extends Controller
{
    /**
     * Tickets of the authenticated admin's branch only. Isolation path:
     * ticket -> reservation -> schedule -> branch_id. The branch is always
     * derived from the admin account; no branch identifier is ever accepted
     * from the client, and no isolation is delegated to the frontend.
     *
     * Read-only monitoring: no ticket is created, checked in, or modified
     * here. The qr_token credential is never included in the response.
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

        $tickets = Ticket::query()
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->with([
                'reservation:id,user_id,schedule_id,reservation_code,status,total_amount',
                'reservation.user:id,name,email',
                'reservation.schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
                'reservation.schedule.movie:id,title',
                'reservation.schedule.screen:id,name',
                'reservation.schedule.branch:id,name',
                'reservation.reservationSeats.seat:id,row_label,seat_number',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Ticket $ticket) => $this->ticketPayload($ticket));

        return response()->json(['tickets' => $tickets]);
    }

    /**
     * Raw date/time strings only, formatted by the frontend. checked_in_at
     * has no date cast (raw column) and is returned untouched; created_at
     * is Eloquent-cast and normalized to Y-m-d H:i:s. Seat labels come from
     * the eager-loaded reservation seats, so no seat query runs per ticket.
     *
     * @return array<string, mixed>
     */
    private function ticketPayload(Ticket $ticket): array
    {
        $reservation = $ticket->reservation;
        $schedule = $reservation?->schedule;

        return [
            'id' => $ticket->id,
            'ticket_code' => $ticket->ticket_code,
            'status' => $ticket->status,
            'checked_in_at' => $ticket->checked_in_at,
            'created_at' => $ticket->created_at?->toDateTimeString(),
            'reservation' => $reservation ? [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
                'total_amount' => $reservation->total_amount,
            ] : null,
            'customer' => $reservation?->user ? [
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
            'seats' => $reservation?->reservationSeats
                ->map(fn ($reservationSeat) => [
                    'label' => $reservationSeat->seat
                        ? $reservationSeat->seat->row_label.$reservationSeat->seat->seat_number
                        : null,
                ])
                ->filter(fn (array $seat) => $seat['label'] !== null)
                ->values()
                ->all() ?? [],
        ];
    }
}
