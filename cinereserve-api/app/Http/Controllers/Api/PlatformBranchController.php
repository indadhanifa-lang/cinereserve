<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;

/**
 * Platform administrator view of every business. There is no approval
 * queue: establishments publish themselves, and this only suspends or
 * reinstates them.
 */
class PlatformBranchController extends Controller
{
    public function index()
    {
        $branches = Branch::with('owners:users.id,name,email')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'city', 'booking_mode', 'status', 'created_at'])
            ->map(fn (Branch $branch) => $branch->only(['id', 'name', 'category', 'city', 'booking_mode', 'status', 'created_at'])
                + ['owner' => $branch->owners->first()?->only(['id', 'name', 'email'])]);

        return response()->json(['branches' => $branches]);

    }

    /**
     * Reinstating re-derives the status from setup progress, so an
     * establishment suspended mid-setup goes back to draft, not live.
     */
    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        $branch = Branch::find($id);
        if (! $branch) {
            return response()->json(['message' => 'Establishment not found.'], 404);
        }

        $branch->status = $data['status'] === 'suspended'
            ? 'suspended'
            : ($branch->setupComplete() ? 'active' : 'draft');
        $branch->save();

        return response()->json(['branch' => $branch->only(['id', 'name', 'status'])]);
    }
}
