<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Movie;
use App\Models\Schedule;
use App\Models\Screen;
use Illuminate\Http\JsonResponse;

/**
 * Public establishment listings for the customer app and the landing page.
 * Only active establishments exist here; drafts and suspended ones 404.
 */
class CustomerBranchController extends Controller
{
    public function index(): JsonResponse
    {
        $branches = Branch::bookable()
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'description' => $branch->description,
                'category' => $branch->category,
                'booking_mode' => $branch->booking_mode,
                'city' => $branch->city,
                'province' => $branch->province,
                'logo_url' => $branch->logo_url,
                'cover_url' => $branch->photos[0] ?? null,
            ]);

        return response()->json(['branches' => $branches]);
    }

    public function show(string $id): JsonResponse
    {
        $branch = Branch::bookable()->find($id);
        if (! $branch) {
            return response()->json(['message' => 'Cinema not found.'], 404);
        }

        $now = now();

        // Mini cinemas have no showtimes: customers book any catalog movie
        // at a time of their choosing (CustomerBookingController).
        $schedules = $branch->isMiniCinema() ? collect() : Schedule::query()
            ->where('branch_id', $branch->id)
            ->where('status', 'active')
            ->whereHas('movie', fn ($query) => $query->where('status', 'active'))
            ->where(function ($query) use ($now) {
                $query->where('show_date', '>', $now->toDateString())
                    ->orWhere(function ($query) use ($now) {
                        $query->where('show_date', $now->toDateString())
                            ->where('start_time', '>=', $now->format('H:i:s'));
                    });
            })
            ->with(['movie:id,title,poster_url,duration_minutes,age_rating', 'screen:id,name'])
            ->orderBy('show_date')
            ->orderBy('start_time')
            ->limit(100)
            ->get();

        return response()->json([
            'branch' => $branch->only([
                'id', 'name', 'description', 'category', 'booking_mode', 'address', 'city',
                'province', 'phone', 'email', 'logo_url', 'photos', 'operating_hours',
            ]),
            'rooms' => $branch->screens()
                ->where('status', 'active')
                ->orderBy('id')
                ->get()
                ->map(fn (Screen $screen) => [
                    ...$screen->only(['id', 'name', 'capacity', 'rental_price', 'extra_guest_fee', 'photos']),
                    'max_guests' => $screen->maxGuests(),
                ]),
            'movies' => Movie::where('branch_id', $branch->id)
                ->where('status', 'active')
                ->with('genres:id,name')
                ->orderBy('title')
                ->get()
                ->map(fn (Movie $movie) => $movie->only(['id', 'title', 'poster_url', 'duration_minutes', 'age_rating', 'description'])
                    + ['genres' => $movie->genres->pluck('name')]),
            'schedules' => $schedules->map(fn (Schedule $schedule) => [
                'id' => $schedule->id,
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'ticket_price' => $schedule->ticket_price,
                'movie' => $schedule->movie?->only(['id', 'title', 'poster_url', 'duration_minutes', 'age_rating']),
                'screen' => $schedule->screen?->only(['id', 'name']),
            ]),
        ]);
    }
}
