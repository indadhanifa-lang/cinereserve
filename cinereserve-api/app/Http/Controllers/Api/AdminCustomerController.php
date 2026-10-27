<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Http\Request;

class AdminCustomerController extends Controller
{
    /**
     * Customers of the authenticated admin's branch only. Customers normally
     * have users.branch_id = null, so directory membership is derived purely
     * from customer -> reservations -> schedule -> branch_id. The branch is
     * always taken from the admin account; no branch identifier is ever
     * accepted from the client.
     */
    public function index(Request $request)
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

        $customers = User::query()
            ->where('role', 'customer')
            ->whereHas('reservations', fn ($query) => $query->whereHas(
                'schedule',
                fn ($scheduleQuery) => $scheduleQuery->where('branch_id', $branchId)
            ))
            ->with([
                'reservations' => fn ($query) => $query
                    ->whereHas('schedule', fn ($scheduleQuery) => $scheduleQuery->where('branch_id', $branchId))
                    ->with([
                        'schedule.movie:id,title',
                        'schedule.screen:id,name',
                    ])
                    ->orderByDesc('reserved_at')
                    ->orderByDesc('id'),
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (User $customer) => $this->customerPayload($customer));

        return response()->json(['customers' => $customers]);
    }

    /**
     * Every aggregate below is derived from the branch-scoped, ordered
     * reservation collection eager-loaded on the customer: other branches'
     * reservations are never loaded, so they can never leak into
     * reservation_count, last_reservation_at, or the history list.
     *
     * @return array<string, mixed>
     */
    private function customerPayload(User $customer): array
    {
        /** @var iterable<int, Reservation> $branchReservations */
        $branchReservations = $customer->reservations;

        $reservations = collect($branchReservations)
            ->map(fn (Reservation $reservation) => [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'movie' => $reservation->schedule?->movie?->title,
                'show_date' => $reservation->schedule?->show_date,
                'start_time' => $reservation->schedule?->start_time,
                'screen' => $reservation->schedule?->screen?->name,
                'total_amount' => $reservation->total_amount,
                'status' => $reservation->status,
            ])
            ->values()
            ->all();

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'avatar_url' => $customer->avatar_url,
            'status' => $customer->status,
            'reservation_count' => count($reservations),
            'last_reservation_at' => $branchReservations->first()?->reserved_at,
            'reservations' => $reservations,
        ];
    }
}
