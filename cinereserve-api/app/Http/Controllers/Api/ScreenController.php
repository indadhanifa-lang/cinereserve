<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesPhotos;
use App\Http\Controllers\Controller;
use App\Models\Screen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScreenController extends Controller
{
    use ManagesPhotos;

    private const SCREEN_FIELDS = [
        'id', 'name', 'screen_type', 'capacity', 'rental_price', 'extra_guest_fee', 'photos', 'status',
    ];

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

        $data = $request->validate($this->screenRules());

        $screen = Screen::create([
            'branch_id' => $branchId,
            'name' => $data['name'],
            'screen_type' => $data['screen_type'] ?? null,
            'capacity' => $data['capacity'],
            'rental_price' => $data['rental_price'] ?? null,
            'extra_guest_fee' => $data['extra_guest_fee'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
        $request->user()->branch->syncStatus();

        return response()->json(['screen' => $screen->fresh()->only(self::SCREEN_FIELDS)], 201);
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

        $data = $request->validate($this->screenRules());

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
            'rental_price' => $data['rental_price'] ?? null,
            'extra_guest_fee' => $data['extra_guest_fee'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
        $screen->save();
        $request->user()->branch->syncStatus();

        return response()->json(['screen' => $screen->only(self::SCREEN_FIELDS)]);
    }

    public function storePhoto(Request $request, string $id)
    {
        $screen = $this->ownScreen($request, $id);
        if ($screen instanceof JsonResponse) {
            return $screen;
        }

        return $this->addPhoto($request, $screen, 'room-photos')
            ?? response()->json(['screen' => $screen->only(self::SCREEN_FIELDS)], 201);
    }

    public function destroyPhoto(Request $request, string $id)
    {
        $screen = $this->ownScreen($request, $id);
        if ($screen instanceof JsonResponse) {
            return $screen;
        }

        return $this->removePhoto($request, $screen, 'room-photos')
            ?? response()->json(['screen' => $screen->only(self::SCREEN_FIELDS)]);
    }

    /**
     * rental_price is the default room price for By-Room establishments;
     * the schedule's own price is what customers pay. By room, the price
     * covers capacity people and each extra one adds extra_guest_fee.
     *
     * @return array<string, array<int, mixed>>
     */
    private function screenRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'screen_type' => ['nullable', 'string', 'max:50'],
            'capacity' => ['required', 'integer', 'min:1'],
            'rental_price' => ['nullable', 'numeric', 'min:0'],
            'extra_guest_fee' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }

    /** @return Screen|JsonResponse */
    private function ownScreen(Request $request, string $id)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        return Screen::where('id', $id)->where('branch_id', $branchId)->first()
            ?? response()->json(['message' => 'Screen not found.'], 404);
    }

    /**
     * Branch ownership comes from the authenticated admin only; any
     * branch_id sent by the client is ignored.
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
