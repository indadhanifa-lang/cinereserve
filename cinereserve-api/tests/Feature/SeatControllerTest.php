<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SeatControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/screens/1/seats')->assertUnauthorized();
    }

    public function test_index_returns_a_404_when_the_admin_has_no_branch(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => null]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/screens/1/seats')->assertNotFound();
    }

    public function test_index_hides_screens_from_another_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $foreign = Screen::create(['branch_id' => $otherBranch->id, 'name' => 'Other Hall', 'capacity' => 90]);
        DB::table('seats')->insert([
            'screen_id' => $foreign->id,
            'row_label' => 'A',
            'seat_number' => 1,
            'seat_type' => 'vip',
            'price_modifier' => 100,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum')->getJson("/api/screens/{$foreign->id}/seats")
            ->assertNotFound()
            ->assertJsonPath('message', 'Screen not found.');
    }

    public function test_index_returns_own_seats_ordered_by_row_and_number(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        foreach ([['B', 2], ['A', 2], ['A', 1]] as [$row, $number]) {
            DB::table('seats')->insert([
                'screen_id' => $screen->id,
                'row_label' => $row,
                'seat_number' => $number,
                'seat_type' => 'regular',
                'price_modifier' => 0,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/screens/{$screen->id}/seats");

        $response->assertOk();
        $response->assertJsonCount(3, 'seats');
        $response->assertJsonPath('seats.0.row_label', 'A');
        $response->assertJsonPath('seats.0.seat_number', 1);
        $response->assertJsonPath('seats.1.row_label', 'A');
        $response->assertJsonPath('seats.1.seat_number', 2);
        $response->assertJsonPath('seats.2.row_label', 'B');
    }

    public function test_index_returns_an_empty_list_for_a_screen_without_seats(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $this->actingAs($admin, 'sanctum')->getJson("/api/screens/{$screen->id}/seats")
            ->assertOk()
            ->assertJsonCount(0, 'seats');
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/screens/1/seats', ['seats' => [['row_label' => 'A', 'seat_number' => 1]]])
            ->assertUnauthorized();
    }

    public function test_store_creates_the_layout_with_server_side_defaults(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/screens/{$screen->id}/seats", $this->payload(5, 8));

        $response->assertCreated();
        $response->assertJsonCount(40, 'seats');
        $response->assertJsonPath('seats.0.row_label', 'A');
        $response->assertJsonPath('seats.0.seat_number', 1);
        $response->assertJsonPath('seats.0.seat_type', 'regular');
        $response->assertJsonPath('seats.0.status', 'active');

        $this->assertDatabaseCount('seats', 40);
        $this->assertDatabaseHas('seats', [
            'screen_id' => $screen->id,
            'row_label' => 'E',
            'seat_number' => 8,
            'seat_type' => 'regular',
            'status' => 'active',
        ]);
    }

    public function test_store_applies_client_supplied_seat_type_and_price_modifier(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 10]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", [
            'seats' => [
                ['row_label' => 'A', 'seat_number' => 1, 'seat_type' => 'vip', 'price_modifier' => 150],
            ],
        ])->assertCreated()->assertJsonPath('seats.0.seat_type', 'vip');

        $this->assertDatabaseHas('seats', [
            'screen_id' => $screen->id,
            'row_label' => 'A',
            'seat_number' => 1,
            'seat_type' => 'vip',
            'price_modifier' => 150,
            'status' => 'active',
        ]);
    }

    public function test_store_rejects_a_layout_larger_than_the_screen_capacity(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 39]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/screens/{$screen->id}/seats", $this->payload(5, 8))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Generated seats (40) exceed screen capacity (39).');

        $this->assertDatabaseCount('seats', 0);
    }

    public function test_store_rejects_duplicate_seats_inside_the_payload(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", [
            'seats' => [
                ['row_label' => 'A', 'seat_number' => 1],
                ['row_label' => 'A', 'seat_number' => 1],
            ],
        ])->assertUnprocessable()->assertJsonPath('message', 'Duplicate seat A1 in request.');

        $this->assertDatabaseCount('seats', 0);
    }

    public function test_store_rejects_a_second_layout_for_the_same_screen(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/screens/{$screen->id}/seats", $this->payload(1, 5))
            ->assertCreated();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/screens/{$screen->id}/seats", $this->payload(1, 5))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Seat layout already exists for this screen.');

        $this->assertDatabaseCount('seats', 5);
    }

    public function test_store_hides_screens_from_another_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $foreign = Screen::create(['branch_id' => $otherBranch->id, 'name' => 'Other Hall', 'capacity' => 90]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/screens/{$foreign->id}/seats", $this->payload(1, 5))
            ->assertNotFound()
            ->assertJsonPath('message', 'Screen not found.');

        $this->assertDatabaseCount('seats', 0);
    }

    public function test_store_rejects_invalid_payloads(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['seats']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", ['seats' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['seats']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", [
            'seats' => [['row_label' => 'A']],
        ])->assertUnprocessable()->assertJsonValidationErrors(['seats.0.seat_number']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/screens/{$screen->id}/seats", [
            'seats' => [[
                'row_label' => str_repeat('x', 11),
                'seat_number' => 1,
                'seat_type' => str_repeat('y', 31),
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['seats.0.row_label', 'seats.0.seat_type']);

        $this->assertDatabaseCount('seats', 0);
    }

    /**
     * Builds a full rectangular layout payload.
     */
    private function payload(int $rows, int $seatsPerRow): array
    {
        $seats = [];
        for ($row = 0; $row < $rows; $row++) {
            for ($number = 1; $number <= $seatsPerRow; $number++) {
                $seats[] = [
                    'row_label' => chr(65 + $row),
                    'seat_number' => $number,
                ];
            }
        }

        return ['seats' => $seats];
    }

    public function test_update_requires_authentication(): void
    {
        $this->patchJson('/api/seats/1', [
            'seat_type' => 'vip',
            'price_modifier' => 50,
            'status' => 'active',
        ])->assertUnauthorized();
    }

    public function test_update_returns_a_404_when_the_admin_has_no_branch(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => null]);

        $this->actingAs($admin, 'sanctum')->patchJson('/api/seats/1', [
            'seat_type' => 'vip',
            'price_modifier' => 50,
            'status' => 'active',
        ])->assertNotFound();
    }

    public function test_update_hides_seats_from_another_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $foreign = Screen::create(['branch_id' => $otherBranch->id, 'name' => 'Other Hall', 'capacity' => 90]);
        $foreignSeat = $this->createSeat($foreign->id, 'A', 1);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$foreignSeat}", [
            'seat_type' => 'vip',
            'price_modifier' => 150,
            'status' => 'disabled',
        ])->assertNotFound()->assertJsonPath('message', 'Seat not found.');

        $this->assertDatabaseHas('seats', [
            'id' => $foreignSeat,
            'seat_type' => 'regular',
            'price_modifier' => 0,
            'status' => 'active',
        ]);
    }

    public function test_update_changes_type_price_and_status(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        $seat = $this->createSeat($screen->id, 'A', 1);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$seat}", [
            'seat_type' => 'vip',
            'price_modifier' => 150,
            'status' => 'disabled',
        ])->assertOk()
            ->assertJsonPath('seat.row_label', 'A')
            ->assertJsonPath('seat.seat_number', 1)
            ->assertJsonPath('seat.seat_type', 'vip')
            ->assertJsonPath('seat.status', 'disabled');

        $this->assertDatabaseHas('seats', [
            'id' => $seat,
            'screen_id' => $screen->id,
            'seat_type' => 'vip',
            'price_modifier' => 150,
            'status' => 'disabled',
        ]);
    }

    public function test_update_rejects_invalid_payloads(): void
    {
        [$adminBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        $seat = $this->createSeat($screen->id, 'A', 1);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$seat}", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['seat_type', 'price_modifier', 'status']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$seat}", [
            'seat_type' => 'loveseat',
            'price_modifier' => 50,
            'status' => 'active',
        ])->assertUnprocessable()->assertJsonValidationErrors(['seat_type']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$seat}", [
            'seat_type' => 'vip',
            'price_modifier' => 'abc',
            'status' => 'active',
        ])->assertUnprocessable()->assertJsonValidationErrors(['price_modifier']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/seats/{$seat}", [
            'seat_type' => 'vip',
            'price_modifier' => 50,
            'status' => 'reserved',
        ])->assertUnprocessable()->assertJsonValidationErrors(['status']);

        $this->assertDatabaseHas('seats', [
            'id' => $seat,
            'seat_type' => 'regular',
            'price_modifier' => 0,
            'status' => 'active',
        ]);
    }

    private function createSeat(int $screenId, string $row, int $number): int
    {
        return DB::table('seats')->insertGetId([
            'screen_id' => $screenId,
            'row_label' => $row,
            'seat_number' => $number,
            'seat_type' => 'regular',
            'price_modifier' => 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
