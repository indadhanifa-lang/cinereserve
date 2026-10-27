<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScreenControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_only_screens_from_the_admin_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        Screen::create(['branch_id' => $otherBranch->id, 'name' => 'Other Hall', 'capacity' => 90]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/screens');

        $response->assertOk();
        $response->assertJsonCount(1, 'screens');
        $response->assertJsonPath('screens.0.name', 'Screen 1');
        $response->assertJsonPath('screens.0.capacity', 40);
        $response->assertJsonPath('screens.0.status', 'active');
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/screens')->assertUnauthorized();
    }

    public function test_store_assigns_the_admin_branch_and_ignores_a_client_sent_branch_id(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/screens', [
            'name' => 'Screen 1',
            'screen_type' => '2D',
            'capacity' => 40,
            'status' => 'active',
            'branch_id' => $otherBranch->id,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('screen.name', 'Screen 1');
        $response->assertJsonPath('screen.screen_type', '2D');

        $this->assertDatabaseHas('screens', [
            'name' => 'Screen 1',
            'branch_id' => $adminBranch->id,
            'capacity' => 40,
            'status' => 'active',
        ]);
        $this->assertDatabaseCount('screens', 1);
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/screens', ['name' => 'Screen 1', 'capacity' => 40])
            ->assertUnauthorized();
    }

    public function test_admin_without_a_branch_gets_a_404_on_store(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => null]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/screens', ['name' => 'Screen 1', 'capacity' => 40])
            ->assertNotFound();

        $this->assertDatabaseCount('screens', 0);
    }

    public function test_store_rejects_invalid_payloads(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $this->actingAs($admin, 'sanctum')->postJson('/api/screens', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'capacity']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/screens', ['name' => 'Screen', 'capacity' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['capacity']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/screens', [
            'name' => str_repeat('a', 101),
            'capacity' => 40,
        ])->assertUnprocessable()->assertJsonValidationErrors(['name']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/screens', [
            'name' => 'Screen 1',
            'screen_type' => str_repeat('x', 51),
            'capacity' => 40,
        ])->assertUnprocessable()->assertJsonValidationErrors(['screen_type']);

        $this->assertDatabaseCount('screens', 0);
    }

    public function test_admin_can_update_own_branch_screen_but_not_another_branch_screen(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $own = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        $foreign = Screen::create(['branch_id' => $otherBranch->id, 'name' => 'Other Hall', 'capacity' => 90]);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/screens/{$own->id}", [
            'name' => 'Screen 1 Renamed',
            'screen_type' => 'IMAX',
            'capacity' => 55,
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('screen.name', 'Screen 1 Renamed')
            ->assertJsonPath('screen.screen_type', 'IMAX')
            ->assertJsonPath('screen.capacity', 55)
            ->assertJsonPath('screen.status', 'inactive');

        $this->assertDatabaseHas('screens', [
            'id' => $own->id,
            'name' => 'Screen 1 Renamed',
            'capacity' => 55,
            'branch_id' => $adminBranch->id,
        ]);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/screens/{$foreign->id}", [
            'name' => 'Hijacked',
            'capacity' => 1,
        ])->assertNotFound();

        $this->assertDatabaseHas('screens', [
            'id' => $foreign->id,
            'name' => 'Other Hall',
            'capacity' => 90,
            'branch_id' => $otherBranch->id,
        ]);
    }

    public function test_update_requires_authentication(): void
    {
        $this->patchJson('/api/screens/1', ['name' => 'Screen 1', 'capacity' => 40])
            ->assertUnauthorized();
    }

    public function test_update_rejects_invalid_payloads(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/screens/{$screen->id}", ['capacity' => 40])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/screens/{$screen->id}", [
            'name' => 'Screen 1',
            'capacity' => 0,
        ])->assertUnprocessable()->assertJsonValidationErrors(['capacity']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/screens/{$screen->id}", [
            'name' => str_repeat('a', 101),
            'capacity' => 40,
        ])->assertUnprocessable()->assertJsonValidationErrors(['name']);

        $this->assertDatabaseHas('screens', ['id' => $screen->id, 'name' => 'Screen 1', 'capacity' => 40]);
    }

    private function admin(Branch $branch): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'branch_id' => $branch->id,
        ]);
    }

    /**
     * @return array{0: Branch, 1: Branch}
     */
    private function twoBranches(): array
    {
        $organization = Organization::create(['name' => 'Cinema Co', 'slug' => 'cinema-co']);

        return [
            Branch::create([
                'organization_id' => $organization->id,
                'name' => 'Central',
                'slug' => 'central',
                'address' => 'Main Street',
                'city' => 'Cagayan de Oro',
            ]),
            Branch::create([
                'organization_id' => $organization->id,
                'name' => 'Uptown',
                'slug' => 'uptown',
                'address' => 'Uptown Avenue',
                'city' => 'Cagayan de Oro',
            ]),
        ];
    }
}
