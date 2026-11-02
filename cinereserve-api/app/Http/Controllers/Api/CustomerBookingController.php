<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\Reservation;
use App\Models\Schedule;
use App\Models\Screen;
use App\Models\Seat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Mini cinema bookings: the customer picks any movie from the catalog, a
 * room, a date and a start time inside opening hours. The booking lasts the
 * movie's runtime. Each booked slot is stored as a schedule row (created on
 * demand), so payments, tickets and reports work exactly as for cinemas.
 *
 * By Room: one booking takes the whole room; price = the room's price,
 * plus the extra-person fee for each guest past the included number.
 * By Seat: customers who pick the same movie and start time share the slot
 * and choose seats; price = the room's seat price + each seat's modifier.
 * Either way a room only ever runs one movie at a time.
 */
class CustomerBookingController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /** Quote a slot: availability, price, the room's busy times that day and, in seat mode, the seat map. */
    public function slot(Request $request, string $screenId): JsonResponse
    {
        $resolved = $this->resolve($request, $screenId);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }
        [$screen, $movie, $start, $end] = $resolved;
        $branch = $screen->branch;

        $conflict = $this->conflict($screen, $movie, $start, $end);
        $slot = $conflict === null ? $this->existingSlot($screen, $movie, $start) : null;
        $takenSeatIds = $slot ? $this->takenSeatIds($slot) : collect();

        return response()->json([
            'room' => [
                ...$screen->only(['id', 'name', 'capacity', 'rental_price', 'extra_guest_fee', 'photos']),
                'max_guests' => $screen->maxGuests(),
            ],
            'movie' => $movie->only(['id', 'title', 'poster_url', 'duration_minutes']),
            'booking_mode' => $branch->booking_mode,
            'start' => $start->format('Y-m-d H:i'),
            'end' => $end->format('Y-m-d H:i'),
            'price' => $screen->rental_price,
            'available' => $conflict === null,
            'message' => $conflict,
            'busy' => $this->busyTimes($screen, $start),
            'seats' => $branch->booking_mode === 'seat'
                ? Seat::where('screen_id', $screen->id)
                    ->orderBy('row_label')
                    ->orderBy('seat_number')
                    ->get(['id', 'row_label', 'seat_number', 'seat_type', 'capacity', 'price_modifier', 'status'])
                    ->map(fn (Seat $seat) => $seat->only(['id', 'row_label', 'seat_number', 'seat_type', 'capacity', 'price_modifier']) + [
                        'label' => $seat->row_label.$seat->seat_number,
                        'availability' => $seat->status !== 'active' ? 'disabled'
                            : ($conflict !== null || $takenSeatIds->contains($seat->id) ? 'reserved' : 'available'),
                    ])
                : [],
        ]);
    }

    /**
     * Book a slot. The room row is locked for the whole check-and-write, so
     * two customers can't both take overlapping times in the same room.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $resolved = $this->resolve($request, (string) $request->input('screen_id'));
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }
        [$screen, $movie, $start, $end] = $resolved;
        $seatMode = $screen->branch->booking_mode === 'seat';

        $seatIds = $seatMode
            ? array_map('intval', $request->validate([
                'seat_ids' => ['required', 'array', 'min:1', 'distinct'],
                'seat_ids.*' => ['integer'],
            ])['seat_ids'])
            : [];
        // By room: the party size, up to the room's capacity. Older clients
        // send none and pay the base price.
        $guests = $seatMode ? null : $request->validate([
            'guests' => ['nullable', 'integer', 'min:1', 'max:'.$screen->maxGuests()],
        ])['guests'] ?? null;

        $result = DB::transaction(function () use ($user, $screen, $movie, $start, $end, $seatMode, $seatIds, $guests): array {
            Screen::query()->lockForUpdate()->find($screen->id);

            if ($message = $this->conflict($screen, $movie, $start, $end)) {
                return ['status' => 409, 'body' => ['message' => $message]];
            }

            $slot = $this->slotFor($screen, $movie, $start, $end);
            $reservations = app(CustomerReservationController::class);

            return $seatMode
                ? $reservations->createReservation($user, $slot->id, $seatIds)
                : $reservations->createRoomReservation($user, $slot->id, $guests);
        });

        if (isset($result['status'])) {
            return response()->json($result['body'], (int) $result['status']);
        }

        return response()->json($result, 201);
    }

    /**
     * Validates the shared slot inputs and returns [screen, movie, start, end]
     * as Manila times, or the error response.
     *
     * @return array{0: Screen, 1: Movie, 2: Carbon, 3: Carbon}|JsonResponse
     */
    private function resolve(Request $request, string $screenId): array|JsonResponse
    {
        $data = $request->validate([
            'movie_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
        ]);

        $screen = Screen::with('branch')->where('status', 'active')->find($screenId);
        $branch = $screen?->branch;
        if (! $branch || ! $branch->isMiniCinema()) {
            return response()->json(['message' => 'Room not found.'], 404);
        }
        if ($branch->status !== 'active') {
            return response()->json(['message' => 'This cinema is not accepting bookings.'], 409);
        }
        if ($screen->rental_price === null) {
            return response()->json(['message' => 'This room has no price yet.'], 409);
        }

        $movie = Movie::where('branch_id', $branch->id)->where('status', 'active')->find($data['movie_id']);
        if (! $movie) {
            return response()->json(['message' => 'Movie not found.'], 404);
        }

        $start = Carbon::createFromFormat('Y-m-d H:i', $data['date'].' '.$data['start_time'], self::CINEMA_TIMEZONE)->startOfMinute();
        $end = $start->copy()->addMinutes((int) $movie->duration_minutes);

        if (! $start->isAfter(Carbon::now(self::CINEMA_TIMEZONE))) {
            return response()->json(['message' => 'Pick a time that is still ahead.'], 422);
        }
        if (! $branch->isOpenBetween($start, $end)) {
            return response()->json(['message' => 'The movie has to start and end within opening hours.'], 422);
        }

        return [$screen, $movie, $start, $end];
    }

    /**
     * Why the room can't take this booking, or null. Another movie (or, by
     * room, any booking) overlapping the time blocks it; in seat mode the
     * exact same movie and start time is the shared slot and stays open.
     */
    private function conflict(Screen $screen, Movie $movie, Carbon $start, Carbon $end): ?string
    {
        foreach ($this->heldSlots($screen, $start) as [$slot, $slotStart, $slotEnd]) {
            if (! ($slotStart->lt($end) && $slotEnd->gt($start))) {
                continue;
            }

            $sameSlot = $screen->branch->booking_mode === 'seat'
                && (int) $slot->movie_id === (int) $movie->id
                && $slotStart->eq($start);

            if (! $sameSlot) {
                return 'This room is already booked from '.$slotStart->format('g:i A').' to '.$slotEnd->format('g:i A').'.';
            }
        }

        return null;
    }

    /**
     * Slots on this room around $start (day before to day after, so
     * overnight bookings count) that a live reservation is holding.
     *
     * @return Collection<int, array{0: Schedule, 1: Carbon, 2: Carbon}>
     */
    private function heldSlots(Screen $screen, Carbon $start): Collection
    {
        return Schedule::where('screen_id', $screen->id)
            ->where('status', 'active')
            ->whereBetween('show_date', [$start->copy()->subDay()->toDateString(), $start->copy()->addDay()->toDateString()])
            ->get()
            ->filter(fn (Schedule $slot) => Reservation::blockingSchedule($slot->id)->exists())
            ->map(function (Schedule $slot) {
                $slotStart = Carbon::parse($slot->show_date.' '.$slot->start_time, self::CINEMA_TIMEZONE);
                $slotEnd = Carbon::parse($slot->show_date.' '.$slot->end_time, self::CINEMA_TIMEZONE);
                if ($slotEnd->lte($slotStart)) {
                    $slotEnd->addDay();
                }

                return [$slot, $slotStart, $slotEnd];
            })
            ->values();
    }

    /** @return array<int, array{start: string, end: string}> */
    private function busyTimes(Screen $screen, Carbon $start): array
    {
        return $this->heldSlots($screen, $start)
            ->filter(fn (array $held) => $held[1]->isSameDay($start) || $held[2]->isSameDay($start))
            ->map(fn (array $held) => ['start' => $held[1]->format('Y-m-d H:i'), 'end' => $held[2]->format('Y-m-d H:i')])
            ->values()
            ->all();
    }

    private function existingSlot(Screen $screen, Movie $movie, Carbon $start): ?Schedule
    {
        return Schedule::where('screen_id', $screen->id)
            ->where('movie_id', $movie->id)
            ->whereDate('show_date', $start->toDateString())
            ->where('start_time', $start->format('H:i:s'))
            ->first();
    }

    /**
     * The schedule row for this slot. A row left over from an expired hold
     * at the same start time is reused for the new movie and price.
     */
    private function slotFor(Screen $screen, Movie $movie, Carbon $start, Carbon $end): Schedule
    {
        $slot = Schedule::where('screen_id', $screen->id)
            ->whereDate('show_date', $start->toDateString())
            ->where('start_time', $start->format('H:i:s'))
            ->first() ?? new Schedule;

        $slot->fill([
            'movie_id' => $movie->id,
            'branch_id' => $screen->branch_id,
            'screen_id' => $screen->id,
            'show_date' => $start->toDateString(),
            'start_time' => $start->format('H:i:s'),
            'end_time' => $end->format('H:i:s'),
            'ticket_price' => $screen->rental_price,
            'status' => 'active',
        ]);
        $slot->save();

        return $slot;
    }

    /** @return Collection<int, int> */
    private function takenSeatIds(Schedule $slot): Collection
    {
        return Reservation::blockingSchedule($slot->id)
            ->join('reservation_seats', 'reservation_seats.reservation_id', '=', 'reservations.id')
            ->pluck('reservation_seats.seat_id');
    }
}
