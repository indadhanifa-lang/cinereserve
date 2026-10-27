<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Screen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScreenController extends Controller
{
    private const SCREEN_FIELDS = ['id', 'name', 'screen_type', 'capacity', 'status'];

    public function index(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $screens = Screen::where('branch_id', $branchId)
            ->orderBy('id')
            ->get(self::SCREEN_FIELDS);

        return response()->json(['screens' => $screens]);
    }

    public function store(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'screen_type' => ['nullable', 'string', 'max:50'],
            'capacity' => ['required', 'integer', 'min:1'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $screen = Screen::create([
            'branch_id' => $branchId,
            'name' => $data['name'],
            'screen_type' => $data['screen_type'] ?? null,
            'capacity' => $data['capacity'],
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['screen' => $screen->only(self::SCREEN_FIELDS)], 201);
    }

    /**
     * The lookup is scoped to the caller's branch, so a screen owned by
     * another branch is reported as missing rather than updatable.
     */
    public function update(Request $request, string $id)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'screen_type' => ['nullable', 'string', 'max:50'],
            'capacity' => ['required', 'integer', 'min:1'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $screen = Screen::where('id', $id)
            ->where('branch_id', $branchId)
            ->first();

        if (! $screen) {
            return response()->json(['message' => 'Screen not found.'], 404);
        }

        $screen->fill([
            'name' => $data['name'],
            'screen_type' => $data['screen_type'] ?? null,
            'capacity' => $data['capacity'],
            'status' => $data['status'] ?? 'active',
        ]);
        $screen->save();

        return response()->json(['screen' => $screen->only(self::SCREEN_FIELDS)]);
    }

    /**
     * Branch ownership comes from the authenticated admin only; any
     * branch_id sent by the client is ignored.
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
