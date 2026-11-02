<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Business owner accounts: signup, sign in/out and password reset.
 */
class AdminRegisterTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'branch_name' => 'Starlight Mini Cinema',
            'email' => 'Maria@Starlight.test',
            'phone' => '+63 912 345 6789',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ];
    }

    public function test_signup_creates_an_owner_with_a_draft_branch_and_signs_in(): void
    {
        $response = $this->postJson('/api/admin/register', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.status', 'active')
            ->assertJsonPath('user.email', 'maria@starlight.test')
            ->assertJsonPath('user.name', 'Starlight Mini Cinema')
            ->assertJsonPath('user.branch.name', 'Starlight Mini Cinema')
            ->assertJsonPath('user.branch.status', 'draft')
            ->assertJsonPath('user.branch.category', 'mini_cinema')
            ->assertJsonPath('user.branches.0.member_role', 'owner');

        $this->withToken($response->json('token'))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.branch.name', 'Starlight Mini Cinema');
    }

    public function test_signup_cannot_choose_a_role(): void
    {
        $this->postJson('/api/admin/register', $this->payload(['role' => 'platform_admin']))
            ->assertCreated()
            ->assertJsonPath('user.role', 'admin');
    }

    public function test_duplicate_email_is_rejected_case_insensitively(): void
    {
        $this->postJson('/api/admin/register', $this->payload())->assertCreated();

        $this->postJson('/api/admin/register', $this->payload(['email' => 'MARIA@starlight.test']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertSame(1, User::count());
    }

    public function test_password_must_be_confirmed(): void
    {
        $this->postJson('/api/admin/register', $this->payload(['password_confirmation' => 'Different123!']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_missing_fields_are_rejected(): void
    {
        $this->postJson('/api/admin/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['branch_name', 'email', 'phone', 'password']);

    }

    public function test_owner_can_log_in_and_log_out(): void
    {
        $this->postJson('/api/admin/register', $this->payload())->assertCreated();

        $token = $this->postJson('/api/admin/login', [
            'email' => 'maria@starlight.test',
            'password' => 'Password123!',
        ])->assertOk()->json('token');

        $this->withToken($token)->postJson('/api/admin/logout')->assertNoContent();

        // Only the signup token is left; the logged-out one is revoked.
        $this->assertSame(1, User::first()->tokens()->count());
    }

    public function test_customer_cannot_log_in_to_the_partner_portal(): void
    {
        Customer::factory()->create(['email' => 'buyer@example.test', 'password' => 'Password123!']);

        $this->postJson('/api/admin/login', ['email' => 'buyer@example.test', 'password' => 'Password123!'])
            ->assertUnauthorized();
    }

    public function test_owner_can_reset_a_forgotten_password(): void
    {
        Notification::fake();
        $this->postJson('/api/admin/register', $this->payload())->assertCreated();
        $owner = User::first();

        $this->postJson('/api/admin/forgot-password', ['email' => 'maria@starlight.test'])->assertOk();

        $token = null;
        Notification::assertSentTo($owner, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        $this->postJson('/api/admin/reset-password', [
            'token' => $token,
            'email' => 'maria@starlight.test',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ])->assertOk();

        $this->assertSame(0, $owner->tokens()->count());
        $this->postJson('/api/admin/login', ['email' => 'maria@starlight.test', 'password' => 'NewPassword456!'])
            ->assertOk();
    }

    public function test_forgot_password_answers_the_same_for_unknown_and_customer_emails(): void
    {
        Notification::fake();
        $customer = Customer::factory()->create(['email' => 'buyer@example.test']);

        $unknown = $this->postJson('/api/admin/forgot-password', ['email' => 'nobody@example.test'])->assertOk()->json('message');
        $buyer = $this->postJson('/api/admin/forgot-password', ['email' => 'buyer@example.test'])->assertOk()->json('message');

        $this->assertSame($unknown, $buyer);
        Notification::assertNotSentTo($customer, ResetPassword::class);
    }

    public function test_invalid_reset_token_is_rejected(): void
    {
        $this->postJson('/api/admin/register', $this->payload())->assertCreated();

        $this->postJson('/api/admin/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'maria@starlight.test',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ])->assertUnprocessable();
    }
}
