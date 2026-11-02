<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminTicketController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    private const array RELATIONS = [
        'reservation:id,customer_id,schedule_id,reservation_code,booking_type,guests,status,total_amount',
        'reservation.customer:id,name,email',
        'reservation.schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
        'reservation.schedule.movie:id,title',
        'reservation.schedule.screen:id,name',
        'reservation.schedule.branch:id,name',
        'reservation.reservationSeats.seat:id,row_label,seat_number',
    ];

    /**
     * Tickets of the authenticated admin's branch only. Isolation path:
     * ticket -> reservation -> schedule -> branch_id. The branch is always
     * derived from the admin account; no branch identifier is ever accepted
     * from the client, and no isolation is delegated to the frontend.
     *
     * The qr_token credential is never included in the response.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $branchId = $user->current_branch_id;
        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        $tickets = Ticket::query()
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->with(self::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Ticket $ticket) => $this->ticketPayload($ticket));

        return response()->json(['tickets' => $tickets]);
    }

    /**
     * Entrance check-in by ticket code, typed or scanned from the QR on the
     * customer's ticket (the QR holds the same code). Only a valid ticket of
     * this branch, for a confirmed booking whose show is today (or an
     * overnight show from yesterday), can be checked in, and only once.
     */
    public function checkIn(Request $request): JsonResponse
    {
        $branchId = $request->user()->current_branch_id;
        if (! $branchId) {
            return response()->json(['message' => 'No branch is assigned to your account.'], 404);
        }

        $code = strtoupper(trim($request->validate(['code' => ['required', 'string', 'max:50']])['code']));

        $ticket = Ticket::query()
            ->where('ticket_code', $code)
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->with(self::RELATIONS)
            ->first();

        if (! $ticket) {
            return response()->json(['message' => "No ticket {$code} at this branch."], 404);
        }

        $schedule = $ticket->reservation->schedule;
        $now = now(self::CINEMA_TIMEZONE);
        $showDate = Carbon::parse($schedule->show_date)->toDateString();
        $overnightFromYesterday = $showDate === $now->copy()->subDay()->toDateString()
            && $schedule->end_time < $schedule->start_time
            && $now->format('H:i:s') < $schedule->end_time;

        $error = match (true) {
            $ticket->status === 'used' => 'Already checked in at '.$this->manila($ticket->checked_in_at)->format('M j, g:i A').'.',
            $ticket->status !== 'valid' => "This ticket is {$ticket->status}.",
            $ticket->reservation->status !== 'confirmed' => "This booking is {$ticket->reservation->status}.",
            $showDate !== $now->toDateString() && ! $overnightFromYesterday => 'This ticket is for '.Carbon::parse($showDate)->format('M j, Y').', not today.',
            default => null,
        };

        if ($error) {
            return response()->json(['message' => $error, 'ticket' => $this->ticketPayload($ticket)], 409);
        }

        // Conditional update so two scans at once can't both check in.
        $checkedIn = Ticket::whereKey($ticket->id)->where('status', 'valid')
            ->update(['status' => 'used', 'checked_in_at' => now(), 'updated_at' => now()]);

        if (! $checkedIn) {
            return response()->json(['message' => 'Already checked in.'], 409);
        }

        return response()->json(['ticket' => $this->ticketPayload($ticket->refresh()->load(self::RELATIONS))]);
    }

    /** Stored timestamps are UTC; the portal shows Manila wall-clock time. */
    private function manila(mixed $value): ?Carbon
    {
        return $value ? Carbon::parse($value, 'UTC')->timezone(self::CINEMA_TIMEZONE) : null;
    }

    /**
     * Date/time strings only, formatted by the frontend: created_at and
     * checked_in_at as Manila Y-m-d H:i:s. Seat labels come from
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
            'checked_in_at' => $this->manila($ticket->checked_in_at)?->toDateTimeString(),
            'created_at' => $this->manila($ticket->created_at)?->toDateTimeString(),
            'reservation' => $reservation ? [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'booking_type' => $reservation->booking_type,
                'guests' => $reservation->guests,
                'status' => $reservation->status,
                'total_amount' => $reservation->total_amount,
            ] : null,
            'customer' => $reservation?->customer ? [
                'id' => $reservation->customer->id,
                'name' => $reservation->customer->name,
                'email' => $reservation->customer->email,
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
