<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;

class AdminPaymentController extends Controller
{
    /**
     * Payments of the authenticated admin's branch only. Isolation path:
     * payment -> reservation -> schedule -> branch_id. The branch is always
     * derived from the admin account; no branch identifier is ever accepted
     * from the client, and no isolation is delegated to the frontend.
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

        $payments = Payment::query()
            ->whereHas('reservation.schedule', fn ($query) => $query->where('branch_id', $branchId))
            ->with([
                'reservation:id,user_id,schedule_id,reservation_code,status',
                'reservation.user:id,name,email',
                'reservation.schedule:id,movie_id,branch_id,screen_id,show_date,start_time,end_time',
                'reservation.schedule.movie:id,title',
                'reservation.schedule.screen:id,name',
                'reservation.schedule.branch:id,name',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Payment $payment) => $this->paymentPayload($payment));

        return response()->json(['payments' => $payments]);
    }

    /**
     * Read-only monitoring payload: raw date/time strings only, formatted
     * by the frontend. paid_at is a plain column (no date cast), so it is
     * returned untouched; created_at is Eloquent-cast, so it is normalized
     * to Y-m-d H:i:s for predictable output. payment_reference is nullable
     * and passed through as-is.
     *
     * @return array<string, mixed>
     */
    private function paymentPayload(Payment $payment): array
    {
        $reservation = $payment->reservation;
        $schedule = $reservation?->schedule;

        return [
            'id' => $payment->id,
            'payment_reference' => $payment->payment_reference,
            'payment_method' => $payment->payment_method,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'paid_at' => $payment->paid_at,
            'created_at' => $payment->created_at?->toDateTimeString(),
            'reservation' => $reservation ? [
                'id' => $reservation->id,
                'reservation_code' => $reservation->reservation_code,
                'status' => $reservation->status,
            ] : null,
            'customer' => $reservation?->user ? [
                'id' => $reservation->user->id,
                'name' => $reservation->user->name,
                'email' => $reservation->user->email,
            ] : null,
            'movie' => $schedule?->movie ? [
                'id' => $schedule->movie->id,
                'title' => $schedule->movie->title,
            ] : null,
            'schedule' => $schedule ? [
                'show_date' => $schedule->show_date,
                'start_time' => $schedule->start_time,
            ] : null,
            'screen' => [
                'name' => $schedule?->screen?->name,
            ],
            'branch' => [
                'id' => $schedule?->branch?->id,
                'name' => $schedule?->branch?->name,
            ],
        ];
    }
}
