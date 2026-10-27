<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CustomerTicketController extends Controller
{
    /**
     * Schedule values (show_date/start_time/end_time) are Manila-local wall
     * clock times, so every active/past decision below is made against the
     * cinema clock — never the device or UTC clock.
     */
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /**
     * Read-only ticket list for the authenticated customer. Ownership is
     * derived exclusively from the token's user id (reservation -> user_id);
     * no user identifier or branch identifier is ever accepted from the
     * client, and customers are never branch-filtered because a customer may
     * hold tickets for several branches. The qr_token credential is never
     * included in the response.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $now = Carbon::now(self::CINEMA_TIMEZONE);

        /** @var Collection<int, Ticket> $tickets */
        $tickets = Ticket::query()
            ->whereIn('reservation_id', Reservation::where('user_id', $user->id)->select('id'))
            ->with([
                'reservation:id,user_id,schedule_id,reservation_code,status,total_amount',
                'reservation.schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
                'reservation.schedule.movie:id,title,poster_url',
                'reservation.schedule.screen:id,name',
                'reservation.schedule.branch:id,name',
                'reservation.reservationSeats.seat:id,row_label,seat_number',
            ])
            ->get();

        $classified = $tickets->map(fn (Ticket $ticket) => [
            'ticket' => $ticket,
            'is_active' => $this->isTicketActive($ticket, $now),
        ]);

        // Active: nearest showtime first (ASC). Past: most recent screening
        // first (DESC). Ties break on created_at DESC then id DESC. Sorting
        // happens after classification and only on already eager-loaded
        // values, so no extra queries run.
        $active = $classified
            ->filter(fn (array $item) => $item['is_active'])
            ->sortBy([
                ['ticket.reservation.schedule.show_date', 'asc'],
                ['ticket.reservation.schedule.start_time', 'asc'],
                ['ticket.created_at', 'desc'],
                ['ticket.id', 'desc'],
            ])
            ->values();

        $past = $classified
            ->filter(fn (array $item) => ! $item['is_active'])
            ->sortBy([
                ['ticket.reservation.schedule.show_date', 'desc'],
                ['ticket.reservation.schedule.start_time', 'desc'],
                ['ticket.created_at', 'desc'],
                ['ticket.id', 'desc'],
            ])
            ->values();

        $payload = $active
            ->concat($past)
            ->map(fn (array $item) => $this->ticketPayload($item['ticket'], $item['is_active']));

        return response()->json(['tickets' => $payload]);
    }

    /**
     * Active means: the ticket is still valid AND its screening has not
     * finished yet according to the cinema clock. Strict greater-than: at
     * exactly end_time the ticket is already past. A missing schedule or a
     * missing show date/end time classifies the ticket as past. Nothing is
     * ever written here — a valid ticket whose screening ended keeps status
     * "valid" and simply appears under Past Passes.
     */
    private function isTicketActive(Ticket $ticket, Carbon $now): bool
    {
        if ($ticket->status !== 'valid') {
            return false;
        }

        $schedule = $ticket->reservation?->schedule;

        if ($schedule === null || $schedule->show_date === null || $schedule->end_time === null) {
            return false;
        }

        $showEnd = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $schedule->show_date.' '.$schedule->end_time,
            self::CINEMA_TIMEZONE
        );

        return $showEnd->gt($now);
    }

    /**
     * Raw date/time strings only, formatted by the frontend. checked_in_at
     * has no date cast (raw column) and is returned untouched; created_at
     * is Eloquent-cast and normalized to Y-m-d H:i:s. Seat labels come from
     * the eager-loaded reservation seats, so no seat query runs per ticket.
     *
     * @return array<string, mixed>
     */
    private function ticketPayload(Ticket $ticket, bool $isActive): array
    {
        $reservation = $ticket->reservation;
        $schedule = $reservation?->schedule;

        return [
            'id' => $ticket->id,
            'ticket_code' => $ticket->ticket_code,
            'status' => $ticket->status,
            'is_active' => $isActive,
            'created_at' => $ticket->created_at?->toDateTimeString(),
            'checked_in_at' => $ticket->checked_in_at,
            'reservation' => $reservation ? [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
                'total_amount' => $reservation->total_amount,
            ] : null,
            'movie' => $schedule?->movie ? [
                'id' => $schedule->movie->id,
                'title' => $schedule->movie->title,
                'poster_url' => $schedule->movie->poster_url,
            ] : null,
            'schedule' => $schedule ? [
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
            ] : null,
            'branch' => [
                'id' => $schedule?->branch?->id,
                'name' => $schedule?->branch?->name,
            ],
            'screen' => [
                'id' => $schedule?->screen?->id,
                'name' => $schedule?->screen?->name,
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
