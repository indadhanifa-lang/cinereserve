<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CustomerShowtimeController extends Controller
{
    /**
     * Customer-facing showtime feed: active movies that have at least one
     * active upcoming schedule. Branch ownership is never taken from the
     * customer account — customers may see every participating branch, and
     * the admin ScheduleController keeps its own branch isolation untouched.
     */
    public function index(Request $request): JsonResponse
    {
        // One timestamp per request, in the application's configured
        // timezone, so "today" and "current time" cannot drift apart.
        $now = now();
        $today = $now->toDateString();
        $currentTime = $now->format('H:i:s');

        $schedules = Schedule::query()
            ->where('status', 'active')
            ->whereHas('movie', fn ($query) => $query->where('status', 'active'))
            ->where(function ($query) use ($today, $currentTime) {
                $query->where('show_date', '>', $today)
                    ->orWhere(function ($query) use ($today, $currentTime) {
                        $query->where('show_date', $today)
                            ->where('start_time', '>=', $currentTime);
                    });
            })
            ->with(['movie.genres:id,name', 'screen:id,name', 'branch:id,name'])
            ->orderBy('show_date')
            ->orderBy('start_time')
            ->orderBy('id')
            ->get();

        return response()->json([
            'movies' => $this->groupByMovie($schedules),
        ]);
    }

    /**
     * Groups the chronologically ordered schedules by movie. First
     * appearance of a movie equals its nearest upcoming schedule, so the
     * movies list inherits that ordering; each group's schedules are
     * already chronological.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function groupByMovie(Collection $schedules): Collection
    {
        return $schedules
            ->groupBy('movie_id')
            ->map(function (Collection $movieSchedules) {
                $movie = $movieSchedules->first()->movie;

                return [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'poster_url' => $movie->poster_url,
                    'duration_minutes' => $movie->duration_minutes,
                    'age_rating' => $movie->age_rating,
                    'genres' => $movie->genres->pluck('name'),
                    'upcoming_schedules' => $movieSchedules
                        ->map(fn (Schedule $schedule) => [
                            'id' => $schedule->id,
                            'show_date' => $schedule->show_date,
                            'start_time' => $schedule->start_time,
                            'end_time' => $schedule->end_time,
                            'ticket_price' => $schedule->ticket_price,
                            'branch' => [
                                'id' => $schedule->branch?->id,
                                'name' => $schedule->branch?->name,
                            ],
                            'screen' => [
                                'id' => $schedule->screen?->id,
                                'name' => $schedule->screen?->name,
                            ],
                        ])
                        ->values(),
                ];
            })
            ->values();
    }
}
