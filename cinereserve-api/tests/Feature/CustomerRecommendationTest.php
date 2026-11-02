<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Genre;
use App\Models\Movie;
use App\Models\Reservation;
use App\Models\Schedule;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private Screen $screen;

    private Customer $customer;

    /** Seen in the past; shares "Sci-Fi" with $space only. */
    private Movie $watched;

    private Movie $space;

    protected function setUp(): void
    {
        parent::setUp();

        $this->branch = Branch::create(['name' => 'Central', 'slug' => 'central', 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);
        $this->screen = Screen::create(['branch_id' => $this->branch->id, 'name' => 'Screen 1', 'capacity' => 10]);
        $this->customer = Customer::factory()->create(['status' => 'active']);

        $this->watched = $this->movie('Dune', ['Sci-Fi', 'Drama']);
        $this->movie('Love Story', ['Romance']); // no shared genre: never a genre pick
        $this->space = $this->movie('Star Trip', ['Sci-Fi']);

        $this->book($this->customer, $this->watched, 'confirmed');
    }

    public function test_gemini_picks_are_returned_when_they_name_real_candidates(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'test-model']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [
            ['text' => json_encode([
                ['movie_id' => $this->space->id, 'reason' => 'More epic sci-fi like Dune'],
                ['movie_id' => $this->watched->id, 'reason' => 'Already seen'],
                ['movie_id' => 99999, 'reason' => 'Made up'],
            ])],
        ]]]]])]);

        $this->getRecommendations()
            ->assertOk()
            ->assertExactJson(['source' => 'ai', 'recommendations' => [
                ['movie_id' => $this->space->id, 'reason' => 'More epic sci-fi like Dune'],
            ]]);

        Http::assertSent(function (HttpRequest $request) {
            $prompt = $request['contents'][0]['parts'][0]['text'];

            return str_contains($request->url(), '/models/test-model:generateContent')
                && str_contains($prompt, 'Star Trip')
                && ! str_contains($prompt, $this->customer->email)
                && ! str_contains($prompt, $this->customer->name);
        });

        // Same bookings and feed: served from cache, Gemini not asked again.
        $this->getRecommendations()->assertJsonPath('source', 'ai');
        Http::assertSentCount(1);
    }

    public function test_it_falls_back_to_genre_overlap_when_gemini_fails(): void
    {
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);

        $this->getRecommendations()
            ->assertOk()
            ->assertExactJson(['source' => 'genre', 'recommendations' => [
                ['movie_id' => $this->space->id, 'reason' => 'Because you watched Dune'],
            ]]);
    }

    public function test_customer_without_bookings_gets_most_booked_movies(): void
    {
        config(['services.gemini.key' => null]);
        // Dune already has one paid booking from setUp; Star Trip gets two.
        $this->book(Customer::factory()->create(['status' => 'active']), $this->space, 'confirmed');
        $this->book(Customer::factory()->create(['status' => 'active']), $this->space, 'completed');
        $this->book(Customer::factory()->create(['status' => 'active']), $this->watched, 'pending'); // unpaid: not counted
        $this->book(Customer::factory()->create(['status' => 'active']), $this->watched, 'cancelled');
        $newcomer = Customer::factory()->create(['status' => 'active']);

        $this->actingAs($newcomer, 'sanctum')
            ->getJson('/api/customer/recommendations')
            ->assertOk()
            ->assertJsonPath('source', 'popular')
            ->assertJsonPath('recommendations.0', ['movie_id' => $this->space->id, 'reason' => null])
            ->assertJsonCount(3, 'recommendations');
    }

    public function test_only_customers_may_ask(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/customer/recommendations')->assertForbidden();
    }

    private function getRecommendations()
    {
        return $this->actingAs($this->customer, 'sanctum')->getJson('/api/customer/recommendations');
    }

    /** Active movie with one upcoming showtime, so it is in the bookable feed. */
    private function movie(string $title, array $genres): Movie
    {
        $movie = new Movie(['title' => $title, 'slug' => Str::slug($title), 'duration_minutes' => 120, 'status' => 'active']);
        $movie->branch_id = $this->branch->id;
        $movie->save();
        $movie->genres()->attach(collect($genres)->map(fn ($name) => Genre::firstOrCreate(['name' => $name])->id));

        Schedule::create([
            'movie_id' => $movie->id,
            'branch_id' => $this->branch->id,
            'screen_id' => $this->screen->id,
            'show_date' => now('Asia/Manila')->addDays(2 + $movie->id)->toDateString(), // one screen: a day each
            'start_time' => '18:00:00',
            'end_time' => '20:00:00',
            'ticket_price' => '250.00',
            'status' => 'active',
        ]);

        return $movie;
    }

    private function book(Customer $customer, Movie $movie, string $status): void
    {
        $reservation = new Reservation;
        $reservation->customer_id = $customer->id;
        $reservation->schedule_id = Schedule::where('movie_id', $movie->id)->value('id');
        $reservation->reservation_code = Str::random(12);
        $reservation->subtotal = '250.00';
        $reservation->total_amount = '250.00';
        $reservation->status = $status;
        $reservation->reserved_at = now();
        $reservation->save();
    }
}
