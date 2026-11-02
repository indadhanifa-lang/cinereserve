<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Movie;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerComingSoonTest extends TestCase
{
    use RefreshDatabase;

    public function test_showtimes_feed_lists_only_active_unreleased_movies_by_release_date(): void
    {
        $branch = Branch::create([
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

        $customer = Customer::factory()->create(['status' => 'active']);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/customer/showtimes')
            ->assertOk()
            ->assertJsonPath('coming_soon.*.title', ['Sooner', 'Later']);
    }
}
