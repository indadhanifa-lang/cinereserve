<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Schedule;
use App\Models\Seat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerScheduleSeatController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /**
     * Seat layout + availability for one schedule. The schedule id is the
     * only client input: schedule, branch, screen, seats, ticket price and
     * occupancy are all resolved from database records. Customers are never
     * filtered by their own branch — any participating schedule may be
     * opened. Read-only: nothing is written and no seat is locked.
     */
    public function show(Request $request, string $scheduleId): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $schedule = Schedule::query()
            ->with([
                'movie:id,title',
                'branch:id,name,booking_mode,status',
                'screen:id,name,capacity,rental_price,photos',
            ])
            ->find($scheduleId);

        if ($schedule === null) {
            return response()->json(['message' => 'Showtime not found.'], 404);
        }

        // Bookable only while the schedule is active and the cinema clock
        // (Asia/Manila — schedules are Manila wall-clock values) is still
        // strictly before showtime start. Equal to start time = closed.
        $now = Carbon::now(self::CINEMA_TIMEZONE);

        $showStart = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $schedule->show_date.' '.$schedule->start_time,
            self::CINEMA_TIMEZONE
        );

        if ($schedule->status !== 'active' || ! $now->lt($showStart)) {
            return response()->json([
                'message' => 'This showtime is no longer available.',
            ], 409);
        }

        if ($schedule->branch?->status !== 'active') {
            return response()->json([
                'message' => 'This cinema is not accepting bookings.',
            ], 409);
        }

        $seats = Seat::query()
            ->where('screen_id', $schedule->screen_id)
            ->orderBy('row_label')
            ->orderBy('seat_number')
            ->get(['id', 'row_label', 'seat_number', 'seat_type', 'capacity', 'price_modifier', 'status']);

        // Occupancy for THIS schedule only: a seat blocked by another
        // showtime stays bookable here. Blocking = confirmed, or pending
        // whose hold has not lapsed yet; cancelled/expired reservations
        // and expired pending holds do not block (no scheduler flips the
        // status — the query itself treats an expired hold as free). No
        // reservation or customer data is selected, so none can leak.
        $reservedSeatIds = DB::table('reservation_seats')
            ->join('reservations', 'reservations.id', '=', 'reservation_seats.reservation_id')
            ->where('reservations.schedule_id', $schedule->id)
            ->where(function ($query) {
                $query->where('reservations.status', 'confirmed')
                    ->orWhere(function ($pending) {
                        $pending->where('reservations.status', 'pending')
                            ->where(function ($hold) {
                                $hold->whereNull('reservations.expires_at')
                                    ->orWhere('reservations.expires_at', '>', now());
                            });
                    });
            })
            ->pluck('reservation_seats.seat_id')
            ->flip()
            ->all();

        return response()->json([
            'schedule' => [
                'id' => $schedule->id,
                'movie' => [
                    'id' => $schedule->movie?->id,
                    'title' => $schedule->movie?->title,
                ],
                'branch' => [
                    'id' => $schedule->branch?->id,
                    'name' => $schedule->branch?->name,
                    'booking_mode' => $schedule->branch?->booking_mode,
                ],
                'screen' => [
                    'id' => $schedule->screen?->id,
                    'name' => $schedule->screen?->name,
                ],
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'ticket_price' => $schedule->ticket_price,
            ],
            // By-Room establishments rent the whole screen: no seat map, just
            // the room and whether anyone holds this showing already.
            'room' => $schedule->branch?->booking_mode === 'room' ? [
                'capacity' => $schedule->screen?->capacity,
                'photos' => $schedule->screen?->photos ?? [],
                'available' => ! Reservation::blockingSchedule($schedule->id)->exists(),
            ] : null,
            'seats' => $seats
                ->map(fn (Seat $seat) => [
                    'id' => $seat->id,
                    'label' => $seat->row_label.$seat->seat_number,
                    'row_label' => $seat->row_label,
                    'seat_number' => $seat->seat_number,
                    'seat_type' => $seat->seat_type,
                    'capacity' => $seat->capacity,
                    'price_modifier' => $seat->price_modifier,
                    'availability' => $this->availabilityFor($seat, $reservedSeatIds),
                ])
                ->values(),
        ]);
    }

    /**
     * Backend is the source of truth for availability. Order matters: a
     * disabled seat stays unavailable even if some reservation references
     * it.
     *
     * @param  array<int|string, int>  $reservedSeatIds  flipped seat_id => index map
     */
    private function availabilityFor(Seat $seat, array $reservedSeatIds): string
    {
        if ($seat->status !== 'active') {
            return 'disabled';
        }

        if (isset($reservedSeatIds[$seat->id])) {
            return 'reserved';
        }

        return 'available';
    }
}
