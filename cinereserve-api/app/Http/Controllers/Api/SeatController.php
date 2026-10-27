<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Screen;
use App\Models\Seat;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SeatController extends Controller
{
    private const SEAT_FIELDS = ['id', 'row_label', 'seat_number', 'seat_type', 'price_modifier', 'status'];

    public function index(Request $request, string $screenId)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $screen = $this->ownScreen($branchId, $screenId);
        if (! $screen) {
            return $this->screenNotFound();
        }

        $seats = Seat::where('screen_id', $screen->id)
            ->orderBy('row_label')
            ->orderBy('seat_number')
            ->get(self::SEAT_FIELDS);

        return response()->json(['seats' => $seats]);
    }

    /**
     * Creates the full layout for a screen in one request. Ownership is
     * derived from the authenticated admin only; no branch identifier
     * is accepted from the client.
     */
    public function store(Request $request, string $screenId)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $screen = $this->ownScreen($branchId, $screenId);
        if (! $screen) {
            return $this->screenNotFound();
        }

        $data = $request->validate([
            'seats' => ['required', 'array', 'min:1', 'max:2000'],
            'seats.*.row_label' => ['required', 'string', 'max:10'],
            'seats.*.seat_number' => ['required', 'integer', 'min:1'],
            'seats.*.seat_type' => ['nullable', 'string', 'max:30'],
            'seats.*.price_modifier' => ['nullable', 'numeric'],
        ]);

        $seats = $data['seats'];

        $seen = [];
        foreach ($seats as $seat) {
            $key = $seat['row_label'].'|'.$seat['seat_number'];
            if (isset($seen[$key])) {
                return response()->json([
                    'message' => sprintf('Duplicate seat %s%s in request.', $seat['row_label'], $seat['seat_number']),
                ], 422);
            }
            $seen[$key] = true;
        }

        if (Seat::where('screen_id', $screen->id)->exists()) {
            return response()->json(['message' => 'Seat layout already exists for this screen.'], 422);
        }

        $total = count($seats);
        if ($total > $screen->capacity) {
            return response()->json([
                'message' => sprintf('Generated seats (%d) exceed screen capacity (%d).', $total, $screen->capacity),
            ], 422);
        }

        $rows = array_map(fn (array $seat) => [
            'screen_id' => $screen->id,
            'row_label' => $seat['row_label'],
            'seat_number' => $seat['seat_number'],
            'seat_type' => $seat['seat_type'] ?? 'regular',
            'price_modifier' => $seat['price_modifier'] ?? 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ], $seats);

        try {
            DB::transaction(function () use ($rows) {
                Seat::insert($rows);
            });
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'Seat layout already exists for this screen.'], 422);
        }

        $created = Seat::where('screen_id', $screen->id)
            ->orderBy('row_label')
            ->orderBy('seat_number')
            ->get(self::SEAT_FIELDS);

        return response()->json(['seats' => $created], 201);
    }

    /**
     * Updates a single seat's editable attributes. Ownership is checked
     * through the seat's screen, so a seat from another branch is
     * reported as missing.
     */
    public function update(Request $request, string $seatId)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $seat = Seat::find($seatId);
        $screen = $seat ? $this->ownScreen($branchId, (string) $seat->screen_id) : null;
        if (! $screen) {
            return $this->seatNotFound();
        }

        $data = $request->validate([
            'seat_type' => ['required', 'in:regular,vip'],
            'price_modifier' => ['required', 'numeric'],
            'status' => ['required', 'in:active,disabled'],
        ]);

        $seat->fill($data);
        $seat->save();

        return response()->json(['seat' => $seat->only(self::SEAT_FIELDS)]);
    }

    /**
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

    private function ownScreen(int $branchId, string $screenId): ?Screen
    {
        return Screen::where('id', $screenId)
            ->where('branch_id', $branchId)
            ->first();
    }

    private function screenNotFound(): JsonResponse
    {
        return response()->json(['message' => 'Screen not found.'], 404);
    }

    private function seatNotFound(): JsonResponse
    {
        return response()->json(['message' => 'Seat not found.'], 404);
    }
}
