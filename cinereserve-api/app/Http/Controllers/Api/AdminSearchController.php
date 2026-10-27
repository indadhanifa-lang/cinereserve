<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Schedule;
use App\Models\Screen;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSearchController extends Controller
{
    /**
     * Maximum results per category so the dropdown stays small; seven
     * categories therefore cap the payload at 35 items.
     */
    private const int RESULTS_PER_TYPE = 5;

    /**
     * Branch-scoped global admin search. Every branch-specific resource is
     * filtered by the authenticated admin's branch inside Laravel; no branch
     * identifier is ever accepted from the client.
     */
    public function index(Request $request): JsonResponse
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

        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return response()->json(['results' => []]);
        }

        // PostgreSQL ILIKE with escaped literal wildcards; the value is
        // always a bound parameter, never concatenated into raw SQL.
        $like = '%'.addcslashes($term, '%_\\').'%';

        $results = array_merge(
            $this->movies($like, $branchId),
            $this->screens($like, $user),
            $this->schedules($like, $branchId),
            $this->reservations($like, $branchId),
            $this->customers($like, $branchId),
            $this->payments($like, $branchId),
            $this->tickets($like, $branchId),
        );

        return response()->json(['results' => $results]);
    }

    /** @return array<int, array<string, mixed>> */
    private function movies(string $like, int $branchId): array
    {
        return Movie::query()
            ->where('branch_id', $branchId)
            ->where(function ($query) use ($like) {
                $query->where('title', 'ILIKE', $like)
                    ->orWhereHas('genres', fn ($genreQuery) => $genreQuery->where('name', 'ILIKE', $like));
            })
            ->orderBy('title')
            ->orderBy('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'title'])
            ->map(fn (Movie $movie) => [
                'type' => 'movie',
                'id' => $movie->id,
                'title' => $movie->title,
                'subtitle' => 'Movie',
                'href' => '/dashboard/movies',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function screens(string $like, User $user): array
    {
        $branchName = $user->branch?->name;

        return Screen::query()
            ->where('branch_id', $user->branch_id)
            ->where(function ($query) use ($like) {
                $query->where('name', 'ILIKE', $like)
                    ->orWhere('screen_type', 'ILIKE', $like);
            })
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'name'])
            ->map(fn (Screen $screen) => [
                'type' => 'screen',
                'id' => $screen->id,
                'title' => $screen->name,
                'subtitle' => 'Screen'.($branchName ? ' • '.$branchName : ''),
                'href' => '/dashboard/screens',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function schedules(string $like, int $branchId): array
    {
        return Schedule::query()
            ->where('branch_id', $branchId)
            ->where(function ($query) use ($like) {
                $query->whereHas('movie', fn ($movieQuery) => $movieQuery->where('title', 'ILIKE', $like))
                    ->orWhereHas('screen', fn ($screenQuery) => $screenQuery->where('name', 'ILIKE', $like));
            })
            ->with(['movie:id,title', 'screen:id,name'])
            ->orderBy('show_date')
            ->orderBy('start_time')
            ->orderBy('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'movie_id', 'screen_id', 'show_date', 'start_time'])
            ->map(fn (Schedule $schedule) => [
                'type' => 'schedule',
                'id' => $schedule->id,
                'title' => ($schedule->movie?->title ?? 'Untitled movie')
                    .' • '.($schedule->screen?->name ?? 'No screen'),
                'subtitle' => $this->formatDateShort((string) $schedule->show_date)
                    .' • '.$this->formatTime12((string) $schedule->start_time),
                'href' => '/dashboard/schedules',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function reservations(string $like, int $branchId): array
    {
        return Reservation::query()
            ->whereHas('schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->where(function ($query) use ($like) {
                $query->where('reservation_code', 'ILIKE', $like)
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where(function ($nameQuery) use ($like) {
                        $nameQuery->where('name', 'ILIKE', $like)
                            ->orWhere('email', 'ILIKE', $like);
                    }))
                    ->orWhereHas('schedule.movie', fn ($movieQuery) => $movieQuery->where('title', 'ILIKE', $like));
            })
            ->with(['user:id,name', 'schedule:id,movie_id,show_date,start_time', 'schedule.movie:id,title'])
            ->orderByDesc('reserved_at')
            ->orderByDesc('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'reservation_code', 'user_id', 'schedule_id'])
            ->map(fn (Reservation $reservation) => [
                'type' => 'reservation',
                'id' => $reservation->id,
                'title' => $reservation->reservation_code,
                'subtitle' => ($reservation->user?->name ?? 'Unknown customer')
                    .' • '.($reservation->schedule?->movie?->title ?? 'Unknown movie'),
                'href' => '/dashboard/reservations',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function customers(string $like, int $branchId): array
    {
        return User::query()
            ->where('role', 'customer')
            ->whereHas('reservations', fn ($query) => $query->whereHas(
                'schedule',
                fn ($scheduleQuery) => $scheduleQuery->where('branch_id', $branchId)
            ))
            ->where(function ($query) use ($like) {
                $query->where('name', 'ILIKE', $like)
                    ->orWhere('email', 'ILIKE', $like)
                    ->orWhere('phone', 'ILIKE', $like);
            })
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'name', 'email'])
            ->map(fn (User $customer) => [
                'type' => 'customer',
                'id' => $customer->id,
                'title' => $customer->name,
                'subtitle' => $customer->email,
                'href' => '/dashboard/customers',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function payments(string $like, int $branchId): array
    {
        return Payment::query()
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->where(function ($query) use ($like) {
                $query->where('payment_reference', 'ILIKE', $like)
                    ->orWhereHas('reservation', fn ($reservationQuery) => $reservationQuery
                        ->where('reservation_code', 'ILIKE', $like)
                        ->orWhereHas('user', fn ($userQuery) => $userQuery->where('name', 'ILIKE', $like)));
            })
            ->with(['reservation:id,reservation_code,user_id', 'reservation.user:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'payment_reference', 'reservation_id'])
            ->map(fn (Payment $payment) => [
                'type' => 'payment',
                'id' => $payment->id,
                'title' => $payment->payment_reference ?? 'Payment #'.$payment->id,
                'subtitle' => ($payment->reservation?->reservation_code ?? 'No reservation')
                    .' • '.($payment->reservation?->user?->name ?? 'Unknown customer'),
                'href' => '/dashboard/payments',
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function tickets(string $like, int $branchId): array
    {
        return Ticket::query()
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->where(function ($query) use ($like) {
                $query->where('ticket_code', 'ILIKE', $like)
                    ->orWhereHas('reservation', fn ($reservationQuery) => $reservationQuery
                        ->where('reservation_code', 'ILIKE', $like)
                        ->orWhereHas('user', fn ($userQuery) => $userQuery->where('name', 'ILIKE', $like)));
            })
            ->with(['reservation:id,reservation_code,user_id', 'reservation.user:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::RESULTS_PER_TYPE)
            ->get(['id', 'ticket_code', 'reservation_id'])
            ->map(fn (Ticket $ticket) => [
                'type' => 'ticket',
                'id' => $ticket->id,
                'title' => $ticket->ticket_code,
                'subtitle' => ($ticket->reservation?->reservation_code ?? 'No reservation')
                    .' • '.($ticket->reservation?->user?->name ?? 'Unknown customer'),
                'href' => '/dashboard/tickets',
            ])
            ->all();
    }

    /** "2026-10-05" → "Oct 5" */
    private function formatDateShort(string $date): string
    {
        $parts = explode('-', $date);

        if (count($parts) !== 3) {
            return $date;
        }

        [$year, $month, $day] = array_map('intval', $parts);

        if ($year === 0 || $month < 1 || $month > 12 || $day < 1) {
            return $date;
        }

        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return $months[$month - 1].' '.$day;
    }

    /** "08:00:00" → "8:00 AM" */
    private function formatTime12(string $time): string
    {
        $parts = explode(':', $time);

        if (count($parts) < 2) {
            return $time;
        }

        $hour = (int) $parts[0];
        $minute = $parts[1];

        if ($hour > 23) {
            return $time;
        }

        $suffix = $hour >= 12 ? 'PM' : 'AM';
        $hour12 = $hour % 12 === 0 ? 12 : $hour % 12;

        return $hour12.':'.$minute.' '.$suffix;
    }
}
