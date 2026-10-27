<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Movie;
use App\Models\Organization;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardOccupancyTest extends TestCase
{
    use RefreshDatabase;

    private static int $scheduleSlot = 0;

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/admin/dashboard/occupancy')->assertUnauthorized();
    }

    public function test_admin_without_a_branch_gets_a_404(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => null]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard/occupancy')
            ->assertNotFound();
    }

    public function test_returns_branch_capacity_and_zero_rate_when_no_reservations(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $ownScreen = $this->createScreen($adminBranch, 40);
        $this->createScreen($adminBranch, 60);
        $this->createScreen($otherBranch, 999);

        $this->createSeat($ownScreen->id, 'A', 1);
        $this->createSeat($ownScreen->id, 'A', 2);
        $this->createSeat($ownScreen->id, 'A', 3, 'inactive');
        $this->createSeat($this->createScreen($otherBranch, 10)->id, 'B', 1);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard/occupancy');

        $response->assertOk();
        $response->assertJsonPath('occupancy.rate', 0);
        $response->assertJsonPath('occupancy.occupied', 0);
        $response->assertJsonPath('occupancy.capacity', 100);
        $response->assertJsonPath('occupancy.active_seats', 2);
    }

    public function test_counts_only_own_branch_reservations_and_skips_cancelled_ones(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $ownScreen = $this->createScreen($adminBranch, 40);
        $ownSeats = [
            $this->createSeat($ownScreen->id, 'A', 1),
            $this->createSeat($ownScreen->id, 'A', 2),
            $this->createSeat($ownScreen->id, 'A', 3),
            $this->createSeat($ownScreen->id, 'A', 4),
        ];

        $this->reserve($adminBranch, $ownScreen->id, 'confirmed', array_slice($ownSeats, 0, 2));
        $this->reserve($adminBranch, $ownScreen->id, 'cancelled', array_slice($ownSeats, 2));

        $foreignScreen = $this->createScreen($otherBranch, 999);
        $foreignSeats = [
            $this->createSeat($foreignScreen->id, 'B', 1),
            $this->createSeat($foreignScreen->id, 'B', 2),
            $this->createSeat($foreignScreen->id, 'B', 3),
            $this->createSeat($foreignScreen->id, 'B', 4),
        ];
        $this->reserve($otherBranch, $foreignScreen->id, 'confirmed', $foreignSeats);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard/occupancy');

        $response->assertOk();
        $response->assertJsonPath('occupancy.occupied', 2);
        $response->assertJsonPath('occupancy.capacity', 40);
        $response->assertJsonPath('occupancy.rate', 5);
        $response->assertJsonPath('occupancy.active_seats', 4);
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

    private function createScreen(Branch $branch, int $capacity): Screen
    {
        return Screen::create([
            'branch_id' => $branch->id,
            'name' => 'Screen '.$capacity,
            'capacity' => $capacity,
        ]);
    }

    private function createSeat(int $screenId, string $row, int $number, string $status = 'active'): int
    {
        return DB::table('seats')->insertGetId([
            'screen_id' => $screenId,
            'row_label' => $row,
            'seat_number' => $number,
            'seat_type' => 'regular',
            'price_modifier' => 0,
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<int, int>  $seatIds
     */
    private function reserve(Branch $branch, int $screenId, string $status, array $seatIds): void
    {
        $movie = Movie::create([
            'title' => 'Movie '.uniqid(),
            'slug' => 'movie-'.uniqid(),
            'duration_minutes' => 120,
        ]);

        // schedules.screen_id + show_date + start_time is unique, so every
        // seeded reservation gets its own slot.
        $slot = ++self::$scheduleSlot;

        $scheduleId = DB::table('schedules')->insertGetId([
            'movie_id' => $movie->id,
            'branch_id' => $branch->id,
            'screen_id' => $screenId,
            'show_date' => now()->toDateString(),
            'start_time' => sprintf('%02d:%02d:00', 10 + intdiv($slot, 60), $slot % 60),
            'end_time' => '23:59:00',
            'ticket_price' => 250,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $reservationId = DB::table('reservations')->insertGetId([
            'user_id' => $this->admin($branch)->id,
            'schedule_id' => $scheduleId,
            'reservation_code' => 'BOOKING-'.uniqid(),
            'subtotal' => 250 * count($seatIds),
            'total_amount' => 250 * count($seatIds),
            'status' => $status,
            'reserved_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($seatIds as $seatId) {
            DB::table('reservation_seats')->insert([
                'reservation_id' => $reservationId,
                'seat_id' => $seatId,
                'price' => 250,
                'status' => 'reserved',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
