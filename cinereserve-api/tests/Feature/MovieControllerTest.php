<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Movie;
use App\Models\Organization;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MovieControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_movie_with_genres_and_list_it(): void
    {
        [$branch] = $this->twoBranches();
        $admin = $this->admin($branch);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/movies', [
            'title' => 'Dune: Part Three',
            'duration_minutes' => 155,
            'genres' => 'Sci-Fi, Adventure',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('movie.slug', 'dune-part-three');
        $this->assertEqualsCanonicalizing(['Sci-Fi', 'Adventure'], $response->json('movie.genres'));
        $this->assertDatabaseHas('movies', ['title' => 'Dune: Part Three', 'branch_id' => $branch->id]);

        $list = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/movies');
        $list->assertOk()->assertJsonCount(1, 'movies');
    }

    public function test_duplicate_title_gets_a_unique_slug_instead_of_500(): void
    {
        [$branch] = $this->twoBranches();
        $admin = $this->admin($branch);
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/movies', ['title' => 'Dune', 'duration_minutes' => 150]);

        $second = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/movies', ['title' => 'Dune', 'duration_minutes' => 150]);

        $second->assertCreated();
        $this->assertNotSame('dune', $second->json('movie.slug'));
    }

    public function test_index_returns_only_movies_from_the_admin_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $this->movie($adminBranch, 'Ours');
        $this->movie($otherBranch, 'Theirs');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/movies');

        $response->assertOk();
        $response->assertJsonCount(1, 'movies');
        $response->assertJsonPath('movies.0.title', 'Ours');
    }

    public function test_store_ignores_a_client_sent_branch_id(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/movies', [
            'title' => 'Sneaky',
            'duration_minutes' => 90,
            'branch_id' => $otherBranch->id,
        ])->assertCreated();

        $this->assertDatabaseHas('movies', ['title' => 'Sneaky', 'branch_id' => $adminBranch->id]);
    }

    public function test_admin_can_update_own_movie_and_replace_genres(): void
    {
        [$branch] = $this->twoBranches();
        $admin = $this->admin($branch);
        $movie = $this->movie($branch, 'Old Title');
        $slug = $movie->slug;

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/movies/{$movie->id}", [
            'title' => 'New Title',
            'duration_minutes' => 120,
            'status' => 'inactive',
            'genres' => 'Drama',
        ]);

        $response->assertOk();
        $response->assertJsonPath('movie.title', 'New Title');
        $response->assertJsonPath('movie.slug', $slug);
        $response->assertJsonPath('movie.genres', ['Drama']);
        $this->assertDatabaseHas('movies', ['id' => $movie->id, 'duration_minutes' => 120, 'status' => 'inactive']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/movies/{$movie->id}", [
            'title' => 'New Title',
            'duration_minutes' => 120,
            'genres' => '',
        ])->assertOk()->assertJsonPath('movie.genres', []);
    }

    public function test_admin_cannot_update_a_movie_from_another_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $foreignMovie = $this->movie($otherBranch, 'Theirs');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/movies/{$foreignMovie->id}", [
            'title' => 'Hijacked',
            'duration_minutes' => 90,
        ])->assertNotFound();

        $this->assertDatabaseHas('movies', ['id' => $foreignMovie->id, 'title' => 'Theirs']);
    }

    public function test_admin_can_toggle_status_only_on_own_branch_movies(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $movie = $this->movie($adminBranch, 'Ours');
        $foreignMovie = $this->movie($otherBranch, 'Theirs');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/movies/{$movie->id}/status", ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('movie.status', 'inactive');
        $this->assertDatabaseHas('movies', ['id' => $movie->id, 'status' => 'inactive', 'title' => 'Ours']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/movies/{$movie->id}/status", ['status' => 'archived'])
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/movies/{$foreignMovie->id}/status", ['status' => 'inactive'])
            ->assertNotFound();
        $this->assertDatabaseMissing('movies', ['id' => $foreignMovie->id, 'status' => 'inactive']);
    }

    public function test_admin_without_a_branch_gets_a_404(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => null]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/movies')->assertNotFound();
    }

    public function test_schedule_cannot_use_a_movie_from_another_branch(): void
    {
        [$adminBranch, $otherBranch] = $this->twoBranches();
        $admin = $this->admin($adminBranch);
        $screen = Screen::create(['branch_id' => $adminBranch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        $foreignMovie = $this->movie($otherBranch, 'Theirs');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/schedules', [
            'movie_id' => $foreignMovie->id,
            'screen_id' => $screen->id,
            'show_date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'end_time' => '20:00',
            'ticket_price' => 250,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'The selected movie does not belong to your branch.');
        $this->assertDatabaseCount('schedules', 0);
    }

    public function test_created_schedule_response_includes_active_status(): void
    {
        [$branch] = $this->twoBranches();
        $admin = $this->admin($branch);
        $screen = Screen::create(['branch_id' => $branch->id, 'name' => 'Screen 1', 'capacity' => 40]);
        $movie = $this->movie($branch, 'Ours');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/schedules', [
            'movie_id' => $movie->id,
            'screen_id' => $screen->id,
            'show_date' => now()->addDay()->toDateString(),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'ticket_price' => 250,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('schedule.status', 'active');
    }

    private function movie(Branch $branch, string $title): Movie
    {
        $movie = new Movie([
            'title' => $title,
            'slug' => str($title)->slug().'-'.$branch->id,
            'duration_minutes' => 100,
        ]);
        $movie->branch_id = $branch->id;
        $movie->save();

        return $movie;
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
        $first = Organization::create(['name' => 'Cinema Co', 'slug' => 'cinema-co']);
        $second = Organization::create(['name' => 'Other Co', 'slug' => 'other-co']);

        return [
            Branch::create([
                'organization_id' => $first->id,
                'name' => 'Central',
                'slug' => 'central',
                'address' => 'Main Street',
                'city' => 'Cagayan de Oro',
            ]),
            Branch::create([
                'organization_id' => $second->id,
                'name' => 'Uptown',
                'slug' => 'uptown',
                'address' => 'Uptown Avenue',
                'city' => 'Cagayan de Oro',
            ]),
        ];
    }
}
