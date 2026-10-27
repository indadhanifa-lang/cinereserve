<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $branchId = $request->user()->branch_id;

        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        return $branchId;
    }
}
