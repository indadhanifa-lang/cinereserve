<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
{
    private const PROFILE_FIELDS = ['id', 'name', 'email', 'phone', 'avatar_url', 'role', 'current_branch_id', 'status'];

    /** Roles that sign in to the partner portal. */
    private const PORTAL_ROLES = ['admin', 'platform_admin'];

    /**
     * Shared user payload for every endpoint here, with the current
     * establishment (and its setup checklist) and the owner's other
     * establishments embedded so the portal chrome renders in one request.
     */
    private function profilePayload(User $user): array
    {
        $branch = $user->branch;

        return $user->only(self::PROFILE_FIELDS) + [
            'branch' => $branch ? BranchController::payload($branch) : null,
            'branches' => BranchController::memberBranches($user),

        ];
    }

    /**
     * Self-serve signup for a business owner: the account plus a draft
     * branch under the given branch name, which the owner then completes
     * from Business Profile. The account is named after the branch. The role
     * is fixed server-side, so no one can sign up as a platform administrator.
     */
    public function register(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);

        $data = $request->validate([
            'branch_name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = new User([
                'name' => $data['branch_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => $data['password'],
            ]);
            $user->role = 'admin';
            $user->status = 'active';
            $user->save();

            BranchController::createDraft($user, [
                'name' => $data['branch_name'],
                'phone' => $data['phone'],
                'email' => $data['email'],
            ]);

            return $user;
        });

        $token = $user->createToken('admin-portal')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->profilePayload($user),
        ], 201);
    }

    /**
     * Always answers the same way, whether or not the email belongs to a
     * portal account, so the form can't be used to discover accounts.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        Password::sendResetLink([
            'email' => strtolower(trim($data['email'])),
            'role' => self::PORTAL_ROLES,
        ]);

        return response()->json([
            'message' => 'If that email has a partner account, a reset link is on its way.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            [
                'email' => strtolower(trim($data['email'])),
                'role' => self::PORTAL_ROLES,
                'token' => $data['token'],
                'password' => $data['password'],
            ],
            function (User $user, string $password) {
                $user->password = $password;
                $user->save();
                // Every existing session ends with the old password.
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'This reset link is invalid or has expired.',
                'errors' => ['email' => ['This reset link is invalid or has expired.']],
            ], 422);
        }

        return response()->json(['message' => 'Your password has been reset. You can sign in now.']);
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

        if (! $user || ! $passwordMatches || ! in_array($user->role, self::PORTAL_ROLES, true)) {
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
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }
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

        if (! in_array($user->role, self::PORTAL_ROLES, true)) {
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
