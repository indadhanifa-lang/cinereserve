<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerNotification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerNotificationController extends Controller
{
    /**
     * The customer's newest notifications. New-movie rows whose movie or
     * branch is no longer bookable are left out, since there is nothing
     * left to book from them.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = $this->visible($request)
            ->with('movie.branch:id,name,category,booking_mode')
            ->latest('id')
            ->limit(30)
            ->get();

        return response()->json([
            'unread_count' => $this->visible($request)->whereNull('read_at')->count(),
            'notifications' => $notifications->map(fn (CustomerNotification $notification) => [
                'id' => $notification->id,
                'title' => $notification->title,
                'message' => $notification->message,
                'poster_url' => $notification->movie?->poster_url,
                'movie_id' => $notification->movie_id,
                'branch' => $notification->movie ? [
                    'id' => $notification->movie->branch->id,
                    'name' => $notification->movie->branch->name,
                    'category' => $notification->movie->branch->category,
                    'booking_mode' => $notification->movie->branch->booking_mode,
                ] : null,
                'unread' => $notification->read_at === null,
                'created_at' => $notification->created_at->toIso8601String(),
            ]),
        ]);
    }

    /** Tapping one notification marks just that one read. */
    public function read(Request $request, int $id): JsonResponse
    {
        CustomerNotification::where('customer_id', $request->user()->id)
            ->whereKey($id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['unread_count' => $this->visible($request)->whereNull('read_at')->count()]);
    }

    /** "Mark all as read". */
    public function seen(Request $request): JsonResponse
    {
        CustomerNotification::where('customer_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['unread_count' => 0]);
    }

    /** "Clear": deletes the customer's notifications. */
    public function clear(Request $request): JsonResponse
    {
        CustomerNotification::where('customer_id', $request->user()->id)->delete();

        return response()->json(['unread_count' => 0]);
    }

    /** @return Builder<CustomerNotification> */
    private function visible(Request $request): Builder
    {
        return CustomerNotification::query()
            ->where('customer_id', $request->user()->id)
            ->where(fn ($query) => $query->whereNull('movie_id')->orWhereHas('movie', fn ($movie) => $movie
                ->where('status', 'active')
                ->whereHas('branch', fn ($branch) => $branch->bookable())));
    }
}
