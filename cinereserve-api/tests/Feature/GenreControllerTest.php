<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GenreControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_genre(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/genres', ['name' => 'Horror']);

        $response->assertCreated();
        $this->assertDatabaseHas('genres', ['name' => 'Horror']);
    }

    public function test_customer_cannot_create_genre(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'status' => 'active']);

        $response = $this->actingAs($customer, 'sanctum')->postJson('/api/admin/genres', ['name' => 'Horror']);

        $response->assertForbidden();
        $this->assertDatabaseMissing('genres', ['name' => 'Horror']);
    }
}
