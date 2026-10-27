<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_me_returns_401(): void
    {
        $this->getJson('/api/customer/me')->assertUnauthorized();
    }

    public function test_authenticated_customer_can_fetch_own_profile(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
            'name' => 'Alex Morgan',
            'email' => 'alex.morgan@example.com',
            'phone' => '+63 912 345 6789',
        ]);

        $response = $this->actingAs($customer, 'sanctum')->getJson('/api/customer/me');

        $response->assertOk();
        $response->assertJsonStructure([
            'user' => ['id', 'name', 'email', 'phone', 'role'],
        ]);
        $response->assertJsonPath('user.id', $customer->id);
        $response->assertJsonPath('user.name', 'Alex Morgan');
        $response->assertJsonPath('user.email', 'alex.morgan@example.com');
        $response->assertJsonPath('user.phone', '+63 912 345 6789');
        $response->assertJsonPath('user.role', 'customer');
    }

    public function test_authenticated_customer_can_update_name_email_and_phone(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
            'email' => 'old@example.com',
            'phone' => '+63 912 345 6789',
        ]);

        $response = $this->actingAs($customer, 'sanctum')->patchJson('/api/customer/profile', [
            'name' => 'Jordan Reyes',
            'email' => 'jordan.reyes@example.com',
            'phone' => '+63 998 765 4321',
        ]);

        $response->assertOk();
        $response->assertJsonPath('user.name', 'Jordan Reyes');
        $response->assertJsonPath('user.email', 'jordan.reyes@example.com');
        $response->assertJsonPath('user.phone', '+63 998 765 4321');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'name' => 'Jordan Reyes',
            'email' => 'jordan.reyes@example.com',
            'phone' => '+63 998 765 4321',
        ]);
    }

    public function test_duplicate_email_belonging_to_another_user_returns_422(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'status' => 'active']);
        User::factory()->create(['email' => 'taken@example.com']);

        $response = $this->actingAs($customer, 'sanctum')->patchJson('/api/customer/profile', [
            'name' => $customer->name,
            'email' => 'taken@example.com',
            'phone' => $customer->phone,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('email');
    }

    public function test_customer_can_keep_existing_email_when_updating_profile(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
            'email' => 'keep.me@example.com',
        ]);

        $response = $this->actingAs($customer, 'sanctum')->patchJson('/api/customer/profile', [
            'name' => 'Updated Name',
            'email' => 'keep.me@example.com',
            'phone' => '+63 900 111 2222',
        ]);

        $response->assertOk();
        $response->assertJsonPath('user.email', 'keep.me@example.com');
        $response->assertJsonPath('user.name', 'Updated Name');
    }
}
