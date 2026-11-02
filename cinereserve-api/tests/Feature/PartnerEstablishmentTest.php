<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Movie;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Establishment registration, automatic activation, multi-establishment
 * owners, tenant isolation and platform suspension.
 */
class PartnerEstablishmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function owner(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function profile(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'Starlight Mini Cinema',
            'description' => 'Private rooms for movie nights.',
            'address' => '12 Rizal Avenue',
            'city' => 'Cebu City',
            'phone' => '+63 912 345 6789',
            'email' => 'hello@starlight.test',
            'operating_hours' => ['fri' => ['open' => '10:00', 'close' => '23:00']],
        ];
    }

    private function register(User $owner, string $mode, array $overrides = []): int
    {
        return (int) $this->actingAs($owner, 'sanctum')
            ->postJson('/api/admin/branches', $this->profile($overrides) + ['booking_mode' => $mode])
            ->assertCreated()
            ->assertJsonPath('branch.status', 'draft')
            ->json('branch.id');
    }

    /** Runs every remaining setup step through the API, returning the room id. */
    private function completeSetup(User $owner, string $mode): int
    {
        $this->actingAs($owner, 'sanctum')
            ->post('/api/admin/branch/logo', ['logo' => UploadedFile::fake()->image('logo.png')])
            ->assertOk();

        $movie = new Movie(['title' => 'Night Owl', 'slug' => 'night-owl-'.$owner->id, 'duration_minutes' => 100]);
        $movie->branch_id = $owner->fresh()->current_branch_id;
        $movie->save();

        $screenId = (int) $this->actingAs($owner, 'sanctum')->postJson('/api/screens', [
            'name' => 'Room 1', 'capacity' => 8, 'rental_price' => 1500,
        ])->assertCreated()->json('screen.id');

        if ($mode === 'seat') {
            $this->actingAs($owner, 'sanctum')->postJson("/api/screens/{$screenId}/seats", [
                'seats' => [['row_label' => 'A', 'seat_number' => 1]],
            ])->assertCreated();
        }

        return $screenId;
    }

    public function test_new_establishment_is_a_draft_owned_by_the_caller(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');

        $branch = Branch::find($id);
        $this->assertSame([$owner->id], $branch->owners()->pluck('users.id')->all());
        $this->assertSame('mini_cinema', $branch->category);
        $this->assertSame($id, (int) $owner->fresh()->current_branch_id);
    }

    public function test_booking_mode_must_be_room_or_seat(): void
    {
        $this->actingAs($this->owner(), 'sanctum')
            ->postJson('/api/admin/branches', $this->profile() + ['booking_mode' => 'both'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('booking_mode');
    }

    public function test_incomplete_setup_stays_draft(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'seat');

        // A priced room, but no seats and no movies yet.
        $this->actingAs($owner, 'sanctum')->postJson('/api/screens', ['name' => 'Room 1', 'capacity' => 8, 'rental_price' => 200])->assertCreated();

        $this->assertSame('draft', Branch::find($id)->status);
        $this->actingAs($owner, 'sanctum')->getJson('/api/admin/branch/setup')
            ->assertOk()
            ->assertJsonPath('setup.rooms', true)
            ->assertJsonPath('setup.seats', false)
            ->assertJsonPath('setup.movies', false)
            ->assertJsonMissingPath('setup.schedules');

    }

    public function test_completed_room_setup_activates_without_approval(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');
        $this->completeSetup($owner, 'room');

        $this->assertSame('active', Branch::find($id)->status);
    }

    public function test_completed_seat_setup_activates_without_approval(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'seat');
        $this->completeSetup($owner, 'seat');

        $this->assertSame('active', Branch::find($id)->status);
    }

    public function test_room_mode_needs_a_room_price(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');
        $screenId = $this->completeSetup($owner, 'room');
        Branch::whereKey($id)->update(['status' => 'draft']);

        $this->actingAs($owner, 'sanctum')->patchJson("/api/screens/{$screenId}", ['name' => 'Room 1', 'capacity' => 8])->assertOk();

        $this->assertSame('draft', Branch::find($id)->status);
    }

    public function test_seat_layouts_are_rejected_in_room_mode(): void
    {
        $owner = $this->owner();
        $this->register($owner, 'room');
        $screenId = $this->actingAs($owner, 'sanctum')->postJson('/api/screens', ['name' => 'Room 1', 'capacity' => 8])->json('screen.id');

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/screens/{$screenId}/seats", ['seats' => [['row_label' => 'A', 'seat_number' => 1]]])
            ->assertUnprocessable();
    }

    public function test_bench_counts_its_capacity_against_the_room(): void
    {
        $owner = $this->owner();
        $this->register($owner, 'seat');
        $screenId = $this->actingAs($owner, 'sanctum')->postJson('/api/screens', ['name' => 'Room 1', 'capacity' => 4])->json('screen.id');

        $this->actingAs($owner, 'sanctum')->postJson("/api/screens/{$screenId}/seats", ['seats' => [
            ['row_label' => 'A', 'seat_number' => 1, 'seat_type' => 'bench', 'capacity' => 3],
            ['row_label' => 'A', 'seat_number' => 2, 'seat_type' => 'bench', 'capacity' => 3],
        ]])->assertUnprocessable();

        $this->actingAs($owner, 'sanctum')->postJson("/api/screens/{$screenId}/seats", ['seats' => [
            ['row_label' => 'A', 'seat_number' => 1, 'seat_type' => 'bench', 'capacity' => 3],
            ['row_label' => 'A', 'seat_number' => 2, 'seat_type' => 'regular', 'capacity' => 5],
        ]])->assertCreated()
            ->assertJsonPath('seats.0.capacity', 3)
            ->assertJsonPath('seats.1.capacity', 1);
    }

    public function test_booking_mode_is_locked_once_active(): void
    {
        $owner = $this->owner();
        $this->register($owner, 'room');
        $this->completeSetup($owner, 'room');

        $this->actingAs($owner, 'sanctum')
            ->patchJson('/api/admin/branch', $this->profile(['booking_mode' => 'seat']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('booking_mode');
    }

    public function test_an_owner_has_only_one_establishment(): void
    {
        $owner = $this->owner();
        $this->register($owner, 'room', ['name' => 'First']);

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/admin/branches', $this->profile(['name' => 'Second']) + ['booking_mode' => 'seat'])
            ->assertUnprocessable();

        $this->actingAs($owner, 'sanctum')->getJson('/api/admin/branches')
            ->assertOk()
            ->assertJsonCount(1, 'branches');
    }

    public function test_owner_cannot_select_or_touch_another_owners_establishment(): void
    {
        $alice = $this->owner();
        $bob = $this->owner();
        $this->register($alice, 'seat');
        $bobBranch = $this->register($bob, 'seat');
        $bobScreen = $this->actingAs($bob, 'sanctum')->postJson('/api/screens', ['name' => 'Bob Room', 'capacity' => 4])->json('screen.id');

        $this->actingAs($alice, 'sanctum')->postJson("/api/admin/branches/{$bobBranch}/select")->assertNotFound();
        $this->actingAs($alice, 'sanctum')->patchJson("/api/screens/{$bobScreen}", ['name' => 'Mine', 'capacity' => 4])->assertNotFound();
        $this->actingAs($alice, 'sanctum')->getJson("/api/screens/{$bobScreen}/seats")->assertNotFound();
        $this->actingAs($alice, 'sanctum')->postJson("/api/screens/{$bobScreen}/photos", ['photo' => UploadedFile::fake()->image('x.png')])->assertNotFound();

        $this->assertSame('Bob Room', Screen::find($bobScreen)->name);
    }

    public function test_customers_cannot_use_owner_endpoints(): void
    {
        $customer = Customer::factory()->create([]);

        $this->actingAs($customer, 'sanctum')->getJson('/api/screens')->assertForbidden();
        $this->actingAs($customer, 'sanctum')->postJson('/api/admin/branches', $this->profile() + ['booking_mode' => 'room'])->assertForbidden();
    }

    public function test_platform_admin_suspends_and_reinstates(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');
        $this->completeSetup($owner, 'room');
        $platform = User::factory()->create(['role' => 'platform_admin']);

        $this->actingAs($platform, 'sanctum')->getJson('/api/platform/branches')
            ->assertOk()
            ->assertJsonPath('branches.0.owner.id', $owner->id);

        $this->actingAs($platform, 'sanctum')->patchJson("/api/platform/branches/{$id}/status", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('branch.status', 'suspended');

        // Owner edits never lift a suspension.
        $this->actingAs($owner, 'sanctum')->patchJson('/api/admin/branch', $this->profile())->assertOk();
        $this->assertSame('suspended', Branch::find($id)->status);

        $this->actingAs($platform, 'sanctum')->patchJson("/api/platform/branches/{$id}/status", ['status' => 'active'])
            ->assertJsonPath('branch.status', 'active');
    }

    public function test_reinstating_an_incomplete_establishment_returns_it_to_draft(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');
        $platform = User::factory()->create(['role' => 'platform_admin']);

        $this->actingAs($platform, 'sanctum')->patchJson("/api/platform/branches/{$id}/status", ['status' => 'suspended'])->assertOk();
        $this->actingAs($platform, 'sanctum')->patchJson("/api/platform/branches/{$id}/status", ['status' => 'active'])
            ->assertJsonPath('branch.status', 'draft');
    }

    public function test_owners_cannot_use_platform_endpoints(): void
    {
        $owner = $this->owner();
        $id = $this->register($owner, 'room');

        $this->actingAs($owner, 'sanctum')->getJson('/api/platform/branches')->assertForbidden();
        $this->actingAs($owner, 'sanctum')->patchJson("/api/platform/branches/{$id}/status", ['status' => 'active'])->assertForbidden();
    }

    public function test_establishment_photos_can_be_added_and_removed(): void
    {
        $owner = $this->owner();
        $this->register($owner, 'room');

        $url = $this->actingAs($owner, 'sanctum')
            ->post('/api/admin/branch/photos', ['photo' => UploadedFile::fake()->image('front.jpg')])
            ->assertCreated()
            ->json('branch.photos.0');

        $this->actingAs($owner, 'sanctum')->deleteJson('/api/admin/branch/photos', ['url' => $url])
            ->assertOk()
            ->assertJsonPath('branch.photos', []);
    }
}
