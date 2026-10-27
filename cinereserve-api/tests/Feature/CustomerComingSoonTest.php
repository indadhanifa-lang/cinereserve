<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Movie;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerComingSoonTest extends TestCase
{
    use RefreshDatabase;

    public function test_showtimes_feed_lists_only_active_unreleased_movies_by_release_date(): void
    {
        $organization = Organization::create(['name' => 'Cinema Co', 'slug' => 'cinema-co']);
        $branch = Branch::create([
            'organization_id' => $organization->id,
            'name' => 'Central',
            'slug' => 'central',
            'address' => 'Main Street',
            'city' => 'Cagayan de Oro',
        ]);

        $movie = function (string $title, ?string $releaseDate, string $status = 'active') use ($branch): void {
            $movie = new Movie(['title' => $title, 'slug' => str($title)->slug(), 'duration_minutes' => 120, 'release_date' => $releaseDate, 'status' => $status]);
            $movie->branch_id = $branch->id;
            $movie->save();
        };

        $movie('Later', now()->addMonth()->toDateString());
        $movie('Sooner', now()->addWeek()->toDateString());
        $movie('Released', now()->subWeek()->toDateString());
        $movie('Today', now()->toDateString());
        $movie('No Date', null);
        $movie('Hidden', now()->addWeek()->toDateString(), 'inactive');

        $customer = User::factory()->create(['role' => 'customer', 'status' => 'active']);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/customer/showtimes')
            ->assertOk()
            ->assertJsonPath('coming_soon.*.title', ['Sooner', 'Later']);
    }
}
