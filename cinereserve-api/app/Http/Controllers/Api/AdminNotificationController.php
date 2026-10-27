<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    /**
     * Newest rows returned to the client (light polling payload), while
     * unread_count is always computed over the full branch set.
     */
    private const int LIST_LIMIT = 50;

    /**
     * Newest notifications of the authenticated admin's branch only. The
     * branch always comes from the admin account; no branch identifier is
     * ever accepted from the client. The list is capped at the newest 50
     * rows, but unread_count counts EVERY unread notification of the
     * branch, so the bell badge never under-reports past the cap. Read-
     * only endpoint: polling can never create or mutate notifications.
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $this->branchId($request);

        $unreadCount = AdminNotification::query()
            ->where('branch_id', $branchId)
            ->whereNull('read_at')
            ->count();

        $notifications = AdminNotification::query()
            ->where('branch_id', $branchId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::LIST_LIMIT)
            ->get()
            ->map(fn (AdminNotification $notification) => $this->payload($notification))
            ->values()
            ->all();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * Mark one notification read. Idempotent: an already-read row keeps
     * its original read_at and still reports success. Scope is always
     * the authenticated admin's branch — another branch's notification
     * resolves exactly like a missing one (404).
     */
    public function read(Request $request, string $notificationId): JsonResponse
    {
        $branchId = $this->branchId($request);

        $notification = AdminNotification::query()
            ->where('id', $notificationId)
            ->where('branch_id', $branchId)
            ->first();

        if ($notification === null) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }

        if ($notification->read_at === null) {
            $notification->read_at = now();
            $notification->save();
        }

        return response()->json(['notification' => $this->payload($notification)]);
    }

    /**
     * Mark EVERY unread notification of the authenticated admin's branch
     * read — the full branch set, not just the newest 50 rows the client
     * currently holds. Only rows of this branch are ever updated.
     */
    public function readAll(Request $request): JsonResponse
    {
        $branchId = $this->branchId($request);

        $updated = AdminNotification::query()
            ->where('branch_id', $branchId)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return response()->json(['updated' => $updated]);
    }

    /**
     * Exact admin convention: wrong role → 403, missing branch → 404
     * with the established wording. The branch comes from the token's
     * user only — never from the request.
     */
    private function branchId(Request $request): int
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            abort(response()->json(['message' => 'Forbidden.'], 403));
        }

        if (! $user->branch_id) {
            abort(response()->json(['message' => 'No branch is assigned to your account.'], 404));
        }

        return (int) $user->branch_id;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(AdminNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'title' => $notification->title,
            'message' => $notification->message,
            'data' => $notification->data,
            'read_at' => $notification->read_at !== null
                ? $notification->read_at->toIso8601String()
                : null,
            'created_at' => $notification->created_at !== null
                ? $notification->created_at->toIso8601String()
                : null,
        ];
    }
}
