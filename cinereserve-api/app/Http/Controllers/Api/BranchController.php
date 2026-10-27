<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BranchController extends Controller
{
    private const BRANCH_FIELDS = ['id', 'name', 'address', 'city', 'province', 'phone', 'email', 'logo_url', 'status'];

    public function update(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'address' => ['required', 'string'],
            'city' => ['required', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
        ]);

        $branch->fill($data);
        $branch->save();

        return response()->json([
            'branch' => $branch->only(self::BRANCH_FIELDS),
        ]);
    }

    public function updateLogo(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        $request->validate([
            'logo' => ['required', 'image', 'max:2048'],
        ]);

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        if ($branch->logo_url && str_contains($branch->logo_url, '/storage/branch-logos/')) {
            $disk->delete('branch-logos/'.basename($branch->logo_url));
        }

        $path = $request->file('logo')->storeAs('branch-logos', Str::uuid().'.'.$request->file('logo')->extension(), 'public');

        $branch->logo_url = $disk->url($path);
        $branch->save();

        return response()->json([
            'branch' => $branch->only(self::BRANCH_FIELDS),
        ]);
    }

    private function ownBranch(Request $request)
    {
        $branch = $request->user()->branch;

        if (! $branch) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        return $branch;
    }
}
