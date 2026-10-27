<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminPasswordTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'password' => 'OldPassword123!',
        ]);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->patchJson('/api/admin/password', [])->assertUnauthorized();
    }

    public function test_admin_can_change_password_and_other_sessions_are_revoked(): void
    {
        $admin = $this->admin();
        $currentToken = $admin->createToken('admin-portal')->plainTextToken;
        $admin->createToken('admin-portal');

        $response = $this->withToken($currentToken)->patchJson('/api/admin/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ]);

        $response->assertOk();
        $this->assertTrue(Hash::check('NewPassword456!', $admin->fresh()->password));
        $this->assertSame(1, $admin->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($currentToken)->getJson('/api/admin/me')->assertOk();
    }

    public function test_wrong_current_password_returns_422(): void
    {
        $admin = $this->admin();
        $token = $admin->createToken('admin-portal')->plainTextToken;

        $response = $this->withToken($token)->patchJson('/api/admin/password', [
            'current_password' => 'not-my-password',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('current_password');
        $this->assertTrue(Hash::check('OldPassword123!', $admin->fresh()->password));
    }

    public function test_mismatched_confirmation_returns_422(): void
    {
        $admin = $this->admin();
        $token = $admin->createToken('admin-portal')->plainTextToken;

        $response = $this->withToken($token)->patchJson('/api/admin/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'Different789!',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('password');
    }

    public function test_customer_token_cannot_change_password_here(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'status' => 'active']);
        $token = $customer->createToken('customer-app')->plainTextToken;

        $this->withToken($token)->patchJson('/api/admin/password', [
            'current_password' => 'password',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ])->assertForbidden();
    }
}
