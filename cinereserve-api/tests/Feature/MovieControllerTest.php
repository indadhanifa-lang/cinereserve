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
