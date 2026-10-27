<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerAuthController extends Controller
{
    /**
     * Customer-safe profile payload, matching the user object returned by
     * register/login so every customer endpoint shares one response shape.
     *
     * @return array{id: int, name: string, email: string, phone: string|null, avatar_url: string|null, role: string}
     */
    private function profilePayload(User $user): array
    {
        return $user->only(['id', 'name', 'email', 'phone', 'avatar_url', 'role']);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        try {
            $user = User::create([
                'name' => $data['name'],
                'email' => strtolower(trim($data['email'])),
                'phone' => $data['phone'],
                'password' => $data['password'],
                'role' => 'customer',
            ]);

            return response()->json([
                'message' => 'Account created successfully.',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Customer registration failed: '.$e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'Unable to create account. Please try again.',
            ], 500);
        }
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        try {
            $email = strtolower(trim($credentials['email']));
            $user = User::where('email', $email)->first();

            $passwordMatches = Hash::check(
                $credentials['password'],
                $user->password ?? Hash::make('not-a-real-password'),
            );

            if (! $user || ! $passwordMatches || $user->role !== 'customer') {
                return response()->json([
                    'message' => 'Invalid email or password.',
                ], 401);
            }

            if ($user->status !== 'active') {
                return response()->json([
                    'message' => 'Your account is inactive.',
                ], 403);
            }

            $token = $user->createToken('customer-app')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Customer login failed: '.$e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'Unable to sign in. Please try again.',
            ], 500);
        }
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->profilePayload($request->user()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
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
     * Upload the authenticated customer's avatar. The user always comes from
     * the sanctum token, so a client-supplied user_id can never touch
     * another account's picture.
     */
    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $user = $request->user();

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        if ($user->avatar_url && str_contains($user->avatar_url, '/storage/avatars/')) {
            $disk->delete('avatars/'.basename($user->avatar_url));
        }

        $avatar = $request->file('avatar');
        $path = $avatar->storeAs('avatars', Str::uuid().'.'.$avatar->extension(), 'public');

        $user->avatar_url = '/storage/'.$path;
        $user->save();

        return response()->json([
            'user' => $this->profilePayload($user),
        ]);
    }
}
