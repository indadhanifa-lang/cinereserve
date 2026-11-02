<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Models\Customer;
use App\Models\Reservation;
use App\Models\ReservationSeat;
use App\Models\Schedule;
use App\Models\Screen;
use App\Models\Seat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerReservationController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    // Unpaid bookings are released (status expired) after a day.
    private const int HOLD_MINUTES = 24 * 60;

    /**
     * Create a pending reservation for the authenticated customer.
     *
     * The request body carries only schedule_id and seat_ids. Customer,
     * schedule, screen, seat ownership, availability, prices, totals,
     * reservation status and expiration are all resolved server-side;
     * nothing money- or identity-related is trusted from the client.
     *
     * @return array{status: int, body: array<string, mixed>}|array{reservation: array<string, mixed>}
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $scheduleId = (int) $request->validate([
            'schedule_id' => ['required', 'integer'],
        ])['schedule_id'];

        // Fast failure only — the transaction below repeats every check
        // while holding the locks and is the final authority.
        $schedule = Schedule::query()
            ->with(['movie:id,title', 'branch:id,name,category,status', 'screen:id,name'])
            ->find($scheduleId);

        if ($schedule === null) {
            return response()->json(['message' => 'Showtime not found.'], 404);
        }

        if ($schedule->branch?->status !== 'active') {
            return response()->json(['message' => 'This cinema is not accepting bookings.'], 409);
        }

        if (! $this->isBookable($schedule)) {
            return response()->json(['message' => 'This showtime is no longer available.'], 409);
        }

        // Mini cinema slots are booked through CustomerBookingController,
        // which also checks the room against overlapping bookings.
        if ($schedule->branch->isMiniCinema()) {
            return response()->json(['message' => 'Book this cinema from its page in the app.'], 422);
        }

        $validated = $request->validate([
            'seat_ids' => ['required', 'array', 'min:1', 'distinct'],
            'seat_ids.*' => ['integer'],
        ]);

        $seatIds = array_map('intval', $validated['seat_ids']);

        $initialSeats = Seat::query()
            ->whereIn('id', $seatIds)
            ->get(['id', 'screen_id', 'status']);

        if (! $this->seatsAreValid($initialSeats, $schedule, $seatIds)) {
            return response()->json(['message' => 'One or more selected seats are invalid.'], 422);
        }

        $result = DB::transaction(function () use ($user, $scheduleId, $seatIds): array {
            return $this->createReservation($user, $scheduleId, $seatIds);
        });

        if (isset($result['status'])) {
            return response()->json($result['body'], (int) $result['status']);
        }

        return response()->json($result, 201);
    }

    /**
     * Active pending reservations awaiting payment for the authenticated
     * customer — the recovery path when they leave the Payment page.
     * Ownership comes exclusively from the token's user id; no user
     * identifier is accepted from the client. Read-only: no status
     * mutation and no payment row is ever faked here — a payment record
     * is created only when the customer actually pays.
     *
     * A reservation appears only while status = pending AND the seat hold
     * is still live (expires_at NULL or strictly in the future, same rule
     * as seat occupancy and pay()). Expired holds drop out automatically
     * at query time — no cron, no cleanup job. The payment endpoints stay
     * the final authority if the client's copy is stale.
     */
    public function pending(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $reservations = Reservation::query()
            ->where('customer_id', $user->id)
            ->where('status', 'pending')
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->with([
                'schedule:id,movie_id,branch_id,screen_id,show_date,start_time',
                'schedule.movie:id,title,poster_url',
                'schedule.branch:id,name',
                'schedule.screen:id,name',
                'reservationSeats.seat:id,row_label,seat_number',
            ])
            ->orderByDesc('reserved_at')
            ->get();

        return response()->json([
            'reservations' => $reservations->map(fn (Reservation $reservation) => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'booking_type' => $reservation->booking_type,
                'status' => $reservation->status,
                'total_amount' => (string) $reservation->total_amount,
                'reserved_at' => $reservation->reserved_at !== null
                    ? (string) $reservation->reserved_at
                    : null,
                'expires_at' => $reservation->expires_at !== null
                    ? Carbon::parse($reservation->expires_at)->toIso8601String()
                    : null,
                'movie' => [
                    'title' => $reservation->schedule?->movie?->title,
                    'poster_url' => $reservation->schedule?->movie?->poster_url,
                ],
                'branch' => ['name' => $reservation->schedule?->branch?->name],
                'screen' => ['name' => $reservation->schedule?->screen?->name],
                'schedule' => [
                    'show_date' => $reservation->schedule?->show_date,
                    'start_time' => $reservation->schedule?->start_time,
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
            ])->values()->all(),
        ]);
    }

    /**
     * Full write path, executed while the seat rows are locked. Returns an
     * error tuple (status + body) on any failure; the transaction then
     * rolls back, so no reservation, reservation_seat or admin
     * notification row can remain. The authenticated Customer is passed for
     * the customer name/id recorded in the admin notification — nothing
     * identity-related comes from the client.
     *
     * @param  array<int, int>  $seatIds
     * @return array<string, mixed>
     */
    public function createReservation(Customer $user, int $scheduleId, array $seatIds): array
    {
        // A. Schedule recheck under lock: still exists, still active, and
        // the Manila cinema clock is still strictly before show start.
        $schedule = Schedule::query()->lockForUpdate()->find($scheduleId);

        if ($schedule === null || ! $this->isBookable($schedule)) {
            return [
                'status' => 409,
                'body' => ['message' => 'This showtime is no longer available.'],
            ];
        }

        // B. Seat rows locked in deterministic id order (no deadlock
        // between overlapping confirmations), then ownership/status is
        // verified again with the locks held.
        $seats = Seat::query()
            ->whereIn('id', $seatIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if (! $this->seatsAreValid($seats, $schedule, $seatIds)) {
            return [
                'status' => 422,
                'body' => ['message' => 'One or more selected seats are invalid.'],
            ];
        }

        // C. Occupancy recheck for THIS schedule while the seat locks are
        // held: confirmed blocks; pending blocks only until expires_at;
        // cancelled/expired never block.
        $blockingSeatIds = DB::table('reservation_seats')
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
            ->pluck('reservation_seats.seat_id');

        $unavailableSeatIds = $seats
            ->filter(fn (Seat $seat) => $blockingSeatIds->contains($seat->id))
            ->pluck('id')
            ->values()
            ->all();

        if ($unavailableSeatIds !== []) {
            return [
                'status' => 409,
                'body' => [
                    'message' => 'One or more selected seats are no longer available.',
                    'unavailable_seat_ids' => $unavailableSeatIds,
                ],
            ];
        }

        // D. Money in integer cents: ticket_price + price_modifier per
        // seat, subtotal = sum, no discount in this version. No floats.
        $baseCents = $this->toCents((string) $schedule->ticket_price);

        $pricedSeats = $seats
            ->map(fn (Seat $seat) => [
                'seat' => $seat,
                'cents' => $baseCents + $this->toCents((string) $seat->price_modifier),
            ])
            ->values();

        $subtotalCents = (int) $pricedSeats->sum('cents');

        $now = now();
        $reservation = new Reservation;
        $reservation->customer_id = $user->id;
        $reservation->schedule_id = $schedule->id;
        $reservation->reservation_code = $this->generateReservationCode();
        $reservation->subtotal = $this->fromCents($subtotalCents);
        $reservation->discount_amount = $this->fromCents(0);
        $reservation->total_amount = $this->fromCents($subtotalCents);
        $reservation->status = 'pending';
        $reservation->reserved_at = $now;
        $reservation->expires_at = $this->holdExpiry($schedule, $now);
        $reservation->save();

        foreach ($pricedSeats as $priced) {
            $reservationSeat = new ReservationSeat;
            $reservationSeat->reservation_id = $reservation->id;
            $reservationSeat->seat_id = $priced['seat']->id;
            $reservationSeat->price = $this->fromCents($priced['cents']);
            $reservationSeat->status = 'reserved';
            $reservationSeat->save();
        }

        $schedule->refresh()->load(['movie:id,title', 'branch:id,name', 'screen:id,name']);

        // Admin notification for the reservation's branch, created inside
        // the same transaction: a rollback removes it with the reservation
        // and its seats, and exactly one row is written per actual
        // reservation creation (read paths never write notifications).
        // data carries metadata only — no email, phone or credentials.
        $seatLabels = $pricedSeats
            ->map(fn (array $priced) => $priced['seat']->row_label.$priced['seat']->seat_number)
            ->values()
            ->all();

        $notification = new AdminNotification;
        $notification->branch_id = (int) $schedule->branch_id;
        $notification->type = 'reservation_created';
        $notification->title = 'New Reservation';
        $notification->message = $user->name
            .' reserved '.count($seatLabels).(count($seatLabels) === 1 ? ' seat' : ' seats')
            .' for '.$schedule->movie?->title.'.';
        $notification->data = [
            'reservation_id' => $reservation->id,
            'reservation_code' => $reservation->reservation_code,
            'customer_id' => $user->id,
            'customer_name' => $user->name,
            'movie_title' => $schedule->movie?->title,
            'branch_id' => (int) $schedule->branch_id,
            'screen_name' => $schedule->screen?->name,
            'show_date' => $schedule->show_date,
            'start_time' => $schedule->start_time,
            'seat_labels' => $seatLabels,
            'total_amount' => (string) $reservation->total_amount,
        ];
        $notification->read_at = null;
        $notification->save();

        return [
            'reservation' => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
                'subtotal' => $reservation->subtotal,
                'discount_amount' => $reservation->discount_amount,
                'total_amount' => $reservation->total_amount,
                // Carbon::parse accepts both the Carbon assigned above and a
                // raw "Y-m-d H:i:s" string, should the attribute round-trip.
                'expires_at' => $reservation->expires_at !== null
                    ? Carbon::parse($reservation->expires_at)->toIso8601String()
                    : null,
                'movie' => ['title' => $schedule->movie?->title],
                'branch' => ['name' => $schedule->branch?->name],
                'screen' => ['name' => $schedule->screen?->name],
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'seats' => $pricedSeats
                    ->map(fn (array $priced) => [
                        'id' => $priced['seat']->id,
                        'label' => $priced['seat']->row_label.$priced['seat']->seat_number,
                        'price' => $this->fromCents($priced['cents']),
                    ])
                    ->values()
                    ->all(),
            ],
        ];
    }

    /**
     * Whole-room write path. Locking the schedule row serialises competing
     * renters of the same showing, and any confirmed or live pending
     * reservation on it means the room is taken. The schedule's price is
     * the room price; guests past the room's capacity each add its
     * extra-person fee.
     *
     * @return array<string, mixed>
     */
    public function createRoomReservation(Customer $user, int $scheduleId, ?int $guests = null): array
    {
        $schedule = Schedule::query()->lockForUpdate()->find($scheduleId);

        if ($schedule === null || ! $this->isBookable($schedule)) {
            return [
                'status' => 409,
                'body' => ['message' => 'This showtime is no longer available.'],
            ];
        }

        if (Reservation::blockingSchedule($schedule->id)->exists()) {
            return [
                'status' => 409,
                'body' => ['message' => 'This room is already booked for this showtime.'],
            ];
        }

        $screen = Screen::find($schedule->screen_id);
        $extraGuests = $guests !== null && $screen ? $screen->extraGuests($guests) : 0;
        $totalCents = $this->toCents((string) $schedule->ticket_price)
            + $extraGuests * $this->toCents((string) $screen?->extra_guest_fee);

        $now = now();
        $reservation = new Reservation;
        $reservation->customer_id = $user->id;
        $reservation->schedule_id = $schedule->id;
        $reservation->booking_type = 'room';
        $reservation->guests = $guests;
        $reservation->reservation_code = $this->generateReservationCode();
        $reservation->subtotal = $this->fromCents($totalCents);
        $reservation->discount_amount = $this->fromCents(0);
        $reservation->total_amount = $this->fromCents($totalCents);
        $reservation->status = 'pending';
        $reservation->reserved_at = $now;
        $reservation->expires_at = $this->holdExpiry($schedule, $now);
        $reservation->save();

        $schedule->load(['movie:id,title', 'branch:id,name', 'screen:id,name']);

        $notification = new AdminNotification;
        $notification->branch_id = (int) $schedule->branch_id;
        $notification->type = 'reservation_created';
        $notification->title = 'New Room Booking';
        $notification->message = $user->name.' booked '.$schedule->screen?->name.' for '.$schedule->movie?->title
            .($guests !== null ? ' ('.$guests.' '.($guests === 1 ? 'person' : 'people').')' : '').'.';
        $notification->data = [
            'reservation_id' => $reservation->id,
            'reservation_code' => $reservation->reservation_code,
            'customer_id' => $user->id,
            'customer_name' => $user->name,
            'movie_title' => $schedule->movie?->title,
            'branch_id' => (int) $schedule->branch_id,
            'screen_name' => $schedule->screen?->name,
            'show_date' => $schedule->show_date,
            'start_time' => $schedule->start_time,
            'booking_type' => 'room',
            'total_amount' => (string) $reservation->total_amount,
        ];
        $notification->read_at = null;
        $notification->save();

        return [
            'reservation' => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'booking_type' => 'room',
                'guests' => $reservation->guests,
                'status' => $reservation->status,
                'subtotal' => $reservation->subtotal,
                'discount_amount' => $reservation->discount_amount,
                'total_amount' => $reservation->total_amount,
                'expires_at' => Carbon::parse($reservation->expires_at)->toIso8601String(),
                'movie' => ['title' => $schedule->movie?->title],
                'branch' => ['name' => $schedule->branch?->name],
                'screen' => ['name' => $schedule->screen?->name],
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'seats' => [],
            ],
        ];
    }

    /**
     * Bookable only while the schedule is active and the Manila cinema
     * clock is still strictly before showtime start (equal = closed).
     */
    private function isBookable(Schedule $schedule): bool
    {
        if ($schedule->status !== 'active') {
            return false;
        }

        return Carbon::now(self::CINEMA_TIMEZONE)->lt($this->showStart($schedule));
    }

    private function showStart(Schedule $schedule): Carbon
    {
        return Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $schedule->show_date.' '.$schedule->start_time,
            self::CINEMA_TIMEZONE
        );
    }

    /**
     * An unpaid booking holds its seats or room for HOLD_MINUTES, but
     * never past the show's start: nobody can pay for a show that began.
     * Converted to the app timezone so the stored wall time is right.
     */
    private function holdExpiry(Schedule $schedule, Carbon $now): Carbon
    {
        return $now->copy()->addMinutes(self::HOLD_MINUTES)
            ->min($this->showStart($schedule))
            ->setTimezone(config('app.timezone'));
    }

    /**
     * Every requested seat must exist, belong to the schedule's screen
     * and still be active. One failure rejects the whole request — no
     * requested id is ever silently dropped.
     *
     * @param  Collection<int, Seat>  $seats
     * @param  array<int, int>  $seatIds
     */
    private function seatsAreValid(Collection $seats, Schedule $schedule, array $seatIds): bool
    {
        if ($seats->count() !== count($seatIds)) {
            return false;
        }

        return $seats->every(
            fn (Seat $seat) => (int) $seat->screen_id === (int) $schedule->screen_id
                && $seat->status === 'active'
        );
    }

    /**
     * RSV-ManilaDate-SUFFIX, server-generated only. The existence loop
     * retries the unlikely unique-code collision.
     */
    private function generateReservationCode(): string
    {
        do {
            $code = 'RSV-'.Carbon::now(self::CINEMA_TIMEZONE)->format('Ymd')
                .'-'.Str::upper(Str::random(6));
        } while (Reservation::where('reservation_code', $code)->exists());

        return $code;
    }

    /** "250.00" → 25000. String parsing only — no float math. */
    private function toCents(string $amount): int
    {
        $normalized = trim($amount);
        $negative = str_starts_with($normalized, '-');
        $unsigned = ltrim($normalized, '-+');
        [$whole, $fraction] = array_pad(explode('.', $unsigned, 2), 2, '0');
        $cents = ((int) $whole) * 100 + (int) str_pad(substr($fraction ?? '', 0, 2), 2, '0');

        return $negative ? -$cents : $cents;
    }

    /** 30000 → "300.00". */
    private function fromCents(int $cents): string
    {
        return sprintf('%d.%02d', intdiv($cents, 100), abs($cents % 100));
    }
}
