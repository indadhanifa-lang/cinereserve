<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Cinema local timezone. Schedule show_date/start_time/end_time are
     * stored as Philippine wall-clock strings (entered raw by the admin),
     * so "today" and "now" must be read in the same timezone. Scoped to
     * this dashboard calculation only; the global app timezone is untouched.
     */
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /**
     * Backward-compatible alias: existing consumers of /dashboard/occupancy
     * keep every field they already use and simply receive the additional
     * overview fields.
     */
    public function occupancy(Request $request): JsonResponse
    {
        return $this->overview($request);
    }

    /**
     * Single branch-scoped dashboard overview. Every statistic below is
     * computed only from the authenticated admin's branch; no branch
     * identifier is ever accepted from the client.
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        // Lapsed holds must not count as occupied seats or pending
        // reservations, even when the scheduler isn't running.
        Reservation::expireStale();

        // One cinema-local timestamp per request, so every "today" and the
        // screening window can never drift apart.
        $now = now(self::CINEMA_TIMEZONE);
        $today = $now->format('Y-m-d');
        $currentTime = $now->format('H:i:s');

        // paid_at/reserved_at are TIMESTAMP WITHOUT TIME ZONE columns written
        // with Laravel's now() (application timezone = UTC), so the Manila
        // business-day boundaries are converted to the same convention
        // before querying.
        $dayStart = $now->copy()->startOfDay()->timezone('UTC')->format('Y-m-d H:i:s');
        $dayEnd = $now->copy()->addDay()->startOfDay()->timezone('UTC')->format('Y-m-d H:i:s');

        $capacity = (int) DB::table('screens')
            ->where('branch_id', $branchId)
            ->sum('capacity');

        $occupied = (int) DB::table('reservation_seats')
            ->join('reservations', 'reservations.id', '=', 'reservation_seats.reservation_id')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->whereNotIn('reservations.status', ['cancelled', 'expired'])
            ->count();

        $activeSeats = (int) DB::table('seats')
            ->join('screens', 'screens.id', '=', 'seats.screen_id')
            ->where('screens.branch_id', $branchId)
            ->where('seats.status', 'active')
            ->count();

        // Halls: active screens of this branch only.
        $totalHalls = (int) DB::table('screens')
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->count();

        // Schedules of this branch currently in progress, whose screen is
        // also active — an inactive screen never occupies a hall.
        $screeningQuery = DB::table('schedules')
            ->join('screens', 'screens.id', '=', 'schedules.screen_id')
            ->where('schedules.branch_id', $branchId)
            ->where('schedules.status', 'active')
            ->where('screens.status', 'active')
            ->where('schedules.show_date', $today)
            ->where('schedules.start_time', '<=', $currentTime)
            ->where('schedules.end_time', '>', $currentTime);

        // Active screenings counts schedules; standby counts distinct
        // halls not currently screening, floored at zero.
        $activeScreenings = (clone $screeningQuery)->count();
        $screeningScreenIds = $screeningQuery->distinct()->pluck('schedules.screen_id');
        $standbyScreens = max(0, $totalHalls - $screeningScreenIds->unique()->count());

        // Today's box office: payment -> reservation -> schedule -> branch.
        // Only fully paid payments inside today's Manila business day.
        $boxOfficeQuery = DB::table('payments')
            ->join('reservations', 'reservations.id', '=', 'payments.reservation_id')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->where('payments.status', 'paid')
            ->where('payments.paid_at', '>=', $dayStart)
            ->where('payments.paid_at', '<', $dayEnd);

        $todayBoxOffice = number_format((float) (clone $boxOfficeQuery)->sum('payments.amount'), 2, '.', '');
        $todayPaidTransactions = (int) (clone $boxOfficeQuery)->count();

        // Reservations today: reservation -> schedule -> branch.
        $reservationsQuery = DB::table('reservations')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->where('reservations.reserved_at', '>=', $dayStart)
            ->where('reservations.reserved_at', '<', $dayEnd);

        $confirmedReservationsToday = (int) (clone $reservationsQuery)
            ->where('reservations.status', 'confirmed')
            ->count();
        $pendingReservationsToday = (int) (clone $reservationsQuery)
            ->where('reservations.status', 'pending')
            ->count();

        // Mini cinema room bookings that still hold their slot (stale holds
        // were expired above). A slot ending before it starts runs past midnight.
        $heldSlots = DB::table('reservations')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->whereIn('reservations.status', ['pending', 'confirmed']);
        $yesterday = $now->copy()->subDay()->format('Y-m-d');

        $roomsInUse = (int) (clone $heldSlots)
            ->where(fn ($query) => $query
                ->where(fn ($q) => $q->where('schedules.show_date', $today)
                    ->where('schedules.start_time', '<=', $currentTime)
                    ->where(fn ($q) => $q->where('schedules.end_time', '>', $currentTime)
                        ->orWhereColumn('schedules.end_time', '<', 'schedules.start_time')))
                ->orWhere(fn ($q) => $q->where('schedules.show_date', $yesterday)
                    ->whereColumn('schedules.end_time', '<', 'schedules.start_time')
                    ->where('schedules.end_time', '>', $currentTime)))
            ->distinct()
            ->count('schedules.screen_id');

        $bookedToday = (clone $heldSlots)->where('schedules.show_date', $today);
        $nextBooking = (clone $bookedToday)
            ->where('schedules.start_time', '>', $currentTime)
            ->min('schedules.start_time');

        // Today's branch schedules, ordered by start time.
        $todaySchedules = Schedule::query()
            ->where('branch_id', $branchId)
            ->where('show_date', $today)
            ->with(['movie:id,title', 'screen:id,name'])
            ->orderBy('start_time')
            ->orderBy('id')
            ->get()
            ->map(fn (Schedule $schedule) => [
                'id' => $schedule->id,
                'movie' => [
                    'id' => $schedule->movie?->id,
                    'title' => $schedule->movie?->title,
                ],
                'screen' => [
                    'id' => $schedule->screen?->id,
                    'name' => $schedule->screen?->name,
                ],
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'ticket_price' => $schedule->ticket_price,
                'status' => $schedule->status,
            ])
            ->values();

        return response()->json([
            'occupancy' => [
                'rate' => $capacity > 0 ? (int) round($occupied * 100 / $capacity) : 0,
                'occupied' => $occupied,
                'capacity' => $capacity,
                'active_seats' => $activeSeats,
            ],
            'active_screenings' => $activeScreenings,
            'standby_screens' => $standbyScreens,
            'total_halls' => $totalHalls,
            'today_box_office' => $todayBoxOffice,
            'today_paid_transactions' => $todayPaidTransactions,
            'confirmed_reservations_today' => $confirmedReservationsToday,
            'pending_reservations_today' => $pendingReservationsToday,
            'today_schedules' => $todaySchedules,
            'rooms_in_use' => $roomsInUse,
            'bookings_today' => (int) (clone $bookedToday)->count(),
            'rooms_booked_today' => (int) (clone $bookedToday)->distinct()->count('schedules.screen_id'),
            'next_booking_start' => $nextBooking,
        ] + $this->businessTotals($branchId, $today, $currentTime));
    }

    /**
     * All-time partner dashboard figures for one branch.
     *
     * @return array<string, mixed>
     */
    private function businessTotals(int $branchId, string $today, string $currentTime): array
    {
        $reservations = DB::table('reservations')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId);

        $paidPayments = DB::table('payments')
            ->join('reservations', 'reservations.id', '=', 'payments.reservation_id')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->where('payments.status', 'paid');

        return [
            'total_bookings' => (int) (clone $reservations)->whereIn('reservations.status', ['pending', 'confirmed'])->count(),
            'total_revenue' => number_format((float) (clone $paidPayments)->sum('payments.amount'), 2, '.', ''),
            'pending_reservations' => (int) (clone $reservations)->where('reservations.status', 'pending')->count(),
            'confirmed_reservations' => (int) (clone $reservations)->where('reservations.status', 'confirmed')->count(),
            'upcoming_schedules' => (int) DB::table('schedules')
                ->where('branch_id', $branchId)
                ->where('status', 'active')
                ->where(fn ($query) => $query->where('show_date', '>', $today)
                    ->orWhere(fn ($query) => $query->where('show_date', $today)->where('start_time', '>=', $currentTime)))
                ->count(),
            'recent_transactions' => (clone $paidPayments)
                ->join('customers', 'customers.id', '=', 'reservations.customer_id')
                ->orderByDesc('payments.paid_at')
                ->limit(10)
                ->get([
                    'payments.id', 'payments.payment_reference', 'payments.payment_method',
                    'payments.amount', 'payments.paid_at', 'reservations.reservation_code',
                    'reservations.booking_type', 'customers.name as customer_name',
                ]),
        ];
    }

    /**
     * Reports for a Manila date range (default last 30 days), by booking
     * date: paid revenue per payment day, reservations by status, and top
     * movies. Booking date (not show date) so paid bookings for upcoming
     * shows count as soon as they are made.
     */
    public function reports(Request $request): JsonResponse
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $to = isset($data['to']) ? Carbon::parse($data['to'], self::CINEMA_TIMEZONE) : now(self::CINEMA_TIMEZONE);
        $from = isset($data['from']) ? Carbon::parse($data['from'], self::CINEMA_TIMEZONE) : $to->copy()->subDays(29);
        $range = [$from->toDateString(), $to->toDateString()];

        // Timestamps are stored as UTC TIMESTAMP WITHOUT TIME ZONE (see overview()).
        $window = [
            $from->copy()->startOfDay()->timezone('UTC')->format('Y-m-d H:i:s'),
            $to->copy()->addDay()->startOfDay()->timezone('UTC')->format('Y-m-d H:i:s'),
        ];

        Reservation::expireStale();

        $base = fn () => DB::table('reservations')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->where('reservations.reserved_at', '>=', $window[0])
            ->where('reservations.reserved_at', '<', $window[1]);

        // ponytail: grouped by Manila day/month in PHP to stay DB-agnostic; move to SQL if ranges get huge.
        $paidByManila = fn (string $start, string $end, string $format) => DB::table('payments')
            ->join('reservations', 'reservations.id', '=', 'payments.reservation_id')
            ->join('schedules', 'schedules.id', '=', 'reservations.schedule_id')
            ->where('schedules.branch_id', $branchId)
            ->where('payments.status', 'paid')
            ->where('payments.paid_at', '>=', $start)
            ->where('payments.paid_at', '<', $end)
            ->get(['payments.paid_at', 'payments.amount'])
            ->groupBy(fn ($payment) => Carbon::parse($payment->paid_at, 'UTC')->timezone(self::CINEMA_TIMEZONE)->format($format));
        $totals = fn ($payments) => [
            'revenue' => number_format((float) $payments->sum('amount'), 2, '.', ''),
            'bookings' => $payments->count(),
        ];

        $revenueByDay = $paidByManila($window[0], $window[1], 'Y-m-d')
            ->sortKeys()
            ->map(fn ($payments, $date) => ['date' => $date] + $totals($payments))
            ->values();

        // Last 12 Manila months (current month so far included), independent
        // of the date range, so the best and slowest months can be compared.
        $firstMonth = now(self::CINEMA_TIMEZONE)->startOfMonth()->subMonths(11);
        $byMonth = $paidByManila(
            $firstMonth->copy()->timezone('UTC')->format('Y-m-d H:i:s'),
            now(self::CINEMA_TIMEZONE)->addMonth()->startOfMonth()->timezone('UTC')->format('Y-m-d H:i:s'),
            'Y-m',
        );
        $revenueByMonth = collect(range(0, 11))->map(function (int $i) use ($firstMonth, $byMonth, $totals) {
            $month = $firstMonth->copy()->addMonths($i)->format('Y-m');

            return ['month' => $month] + $totals($byMonth->get($month, collect()));
        });

        $byStatus = $base()
            ->groupBy('reservations.status')
            ->selectRaw('reservations.status as status, count(*) as total')
            ->pluck('total', 'status');

        $topMovies = $base()
            ->join('movies', 'movies.id', '=', 'schedules.movie_id')
            ->where('reservations.status', 'confirmed')
            ->groupBy('movies.id', 'movies.title')
            ->orderByDesc('revenue')
            ->limit(5)
            ->selectRaw('movies.title as title, count(*) as bookings, sum(reservations.total_amount) as revenue')
            ->get();

        return response()->json([
            'from' => $range[0],
            'to' => $range[1],
            'revenue_by_day' => $revenueByDay,
            'revenue_by_month' => $revenueByMonth,
            'bookings_by_status' => $byStatus,
            'top_movies' => $topMovies,
        ]);
    }

    /**
     * Occupancy is always computed for the authenticated admin's branch;
     * no branch identifier is accepted from the client.
     *
     * @return int|JsonResponse
     */
    private function ownBranchId(Request $request)
    {
        $branchId = $request->user()->current_branch_id;

        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        return $branchId;
    }
}
