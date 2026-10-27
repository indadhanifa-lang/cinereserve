<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
{
    private const PROFILE_FIELDS = ['id', 'name', 'email', 'phone', 'avatar_url', 'role', 'branch_id', 'status'];

    private const BRANCH_FIELDS = ['id', 'name', 'address', 'city', 'province', 'phone', 'email', 'logo_url', 'status'];

    /**
     * Shared user payload for every endpoint here, with the admin's branch
     * embedded so the portal chrome can render it without a second request.
     */
    private function profilePayload(User $user): array
    {
        $branch = $user->branch;

        return $user->only(self::PROFILE_FIELDS) + [
            'branch' => $branch?->only(self::BRANCH_FIELDS),
            'organization' => $branch?->organization?->only(['id', 'name']),
        ];
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower(trim($credentials['email']));
        $user = User::where('email', $email)->first();

        // Always run a hash check, even with no matching user, so a
        // nonexistent email doesn't respond measurably faster than a
        // wrong password (timing oracle for admin email enumeration).
        $passwordMatches = Hash::check(
            $credentials['password'],
            $user->password ?? Hash::make('not-a-real-password'),
        );

        if (! $user || ! $passwordMatches || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Invalid email or password.',
            ], 401);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Your account is inactive. Contact an administrator.',
            ], 403);
        }

        $token = $user->createToken('admin-portal')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->profilePayload($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $this->profilePayload($request->user()),
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user->name = $data['name'];
        $user->email = strtolower(trim($data['email']));
        $user->phone = $data['phone'] ?? null;
        $user->save();

        return response()->json([
            'user' => $this->profilePayload($user),
        ]);
    }

    /**
     * Change the signed-in admin's own password. Every other token is
     * revoked so a stolen or forgotten session can't outlive the change;
     * the token making this request stays valid so the admin isn't kicked out.
     */
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'different:current_password'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => ['current_password' => ['Your current password is incorrect.']],
            ], 422);
        }

        $user->password = $data['password'];
        $user->save();

        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();

        return response()->json(['message' => 'Your password has been changed.']);
    }

    public function updateAvatar(Request $request)
    {
        $request->validate([
            'avatar' => ['required', 'image', 'max:2048'],
        ]);

        $user = $request->user();

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        if ($user->avatar_url && str_contains($user->avatar_url, '/storage/avatars/')) {
            $disk->delete('avatars/'.basename($user->avatar_url));
        }

        $path = $request->file('avatar')->storeAs('avatars', Str::uuid().'.'.$request->file('avatar')->extension(), 'public');

        $user->avatar_url = '/storage/'.$path;
        $user->save();

        return response()->json([
            'user' => $this->profilePayload($user),
        ]);
    }
}
