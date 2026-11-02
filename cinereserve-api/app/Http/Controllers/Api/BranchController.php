<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesPhotos;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Establishments a user manages, through the branch_user pivot (owner or
 * staff). users.current_branch_id is the one currently selected; every other
 * admin controller scopes by it, so selecting here is the only way to reach a
 * different establishment.
 */
class BranchController extends Controller
{
    use ManagesPhotos;

    public const BRANCH_FIELDS = [
        'id', 'name', 'description', 'category', 'address', 'city', 'province', 'booking_mode',
        'phone', 'email', 'logo_url', 'photos', 'operating_hours', 'status',
    ];

    public static function payload(Branch $branch): array
    {
        return $branch->only(self::BRANCH_FIELDS) + [
            'setup' => $branch->setupChecklist(),
        ];
    }

    /** Establishments the caller owns or is staff of. */
    public function index(Request $request)
    {
        return response()->json(['branches' => self::memberBranches($request->user())]);
    }

    /** @return Collection<int, array<string, mixed>> */
    public static function memberBranches(User $user): Collection
    {
        return $user->branches()
            ->orderBy('branches.id')
            ->get(['branches.id', 'name', 'status', 'booking_mode', 'logo_url'])
            ->map(fn (Branch $branch) => $branch->only(['id', 'name', 'status', 'booking_mode', 'logo_url'])
                + ['member_role' => $branch->pivot->role]);
    }

    /**
     * Registers a new establishment as a draft owned by the caller and makes
     * it the current one. It goes live by itself once setup is complete.
     */
    public function store(Request $request)
    {
        // One establishment per account; signup already creates it.
        if ($request->user()->branches()->exists()) {
            return response()->json(['message' => 'Each account manages one establishment.'], 422);
        }

        $data = $request->validate($this->profileRules() + [
            'booking_mode' => ['required', 'in:'.implode(',', Branch::BOOKING_MODES)],
        ]);

        $branch = DB::transaction(fn () => self::createDraft($request->user(), $data));

        return response()->json(['branch' => self::payload($branch->refresh())], 201);
    }

    /**
     * A new draft mini cinema owned by $user and selected as their current
     * one. Caller wraps it in a transaction.
     *
     * @param  array<string, mixed>  $data  profile fields; name is required
     */
    public static function createDraft(User $user, array $data): Branch
    {
        $branch = new Branch($data + ['address' => '', 'city' => '']);
        // Random suffix keeps slugs unique when two cinemas share a name.
        $branch->slug = Str::limit(Str::slug($data['name']), 150, '').'-'.Str::lower(Str::random(6));
        $branch->category = 'mini_cinema';
        $branch->status = 'draft';
        $branch->save();
        $branch->members()->attach($user->id, ['role' => 'owner']);

        $user->current_branch_id = $branch->id;
        $user->save();

        return $branch;
    }

    /** Switch the current establishment; only its owners and staff may select it. */
    public function select(Request $request, int $id)
    {
        $user = $request->user();

        $branch = $user->branches()->where('branches.id', $id)->first();

        if (! $branch) {
            return response()->json(['message' => 'Establishment not found.'], 404);
        }

        $user->current_branch_id = $branch->id;
        $user->save();

        return response()->json(['branch' => self::payload($branch)]);
    }

    public function setup(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        return response()->json([
            'status' => $branch->status,
            'setup' => $branch->setupChecklist(),
        ]);
    }

    public function update(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        $data = $request->validate($this->profileRules() + [
            'booking_mode' => ['sometimes', 'in:'.implode(',', Branch::BOOKING_MODES)],
        ]);

        // Customers may already hold bookings of the live mode.
        if (isset($data['booking_mode']) && $data['booking_mode'] !== $branch->booking_mode && $branch->status !== 'draft') {
            return response()->json([
                'message' => 'The booking model can only be changed while the establishment is a draft.',
                'errors' => ['booking_mode' => ['The booking model can only be changed while the establishment is a draft.']],
            ], 422);
        }

        $branch->fill($data);
        $branch->save();
        $branch->syncStatus();

        return response()->json([
            'branch' => self::payload($branch),
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
        $branch->syncStatus();

        return response()->json([
            'branch' => self::payload($branch),
        ]);
    }

    public function storePhoto(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        return $this->addPhoto($request, $branch, 'branch-photos')
            ?? response()->json(['branch' => self::payload($branch)], 201);
    }

    public function destroyPhoto(Request $request)
    {
        $branch = $this->ownBranch($request);
        if ($branch instanceof JsonResponse) {
            return $branch;
        }

        return $this->removePhoto($request, $branch, 'branch-photos')
            ?? response()->json(['branch' => self::payload($branch)]);
    }

    /**
     * Shared create/update profile rules. Closed days are simply left out
     * of operating_hours.
     *
     * @return array<string, array<int, mixed>>
     */
    private function profileRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'address' => ['required', 'string', 'max:500'],
            'city' => ['required', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'operating_hours' => ['nullable', 'array:mon,tue,wed,thu,fri,sat,sun'],
            'operating_hours.*' => ['array:open,close'],
            'operating_hours.*.open' => ['required', 'date_format:H:i'],
            'operating_hours.*.close' => ['required', 'date_format:H:i'],
        ];
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
