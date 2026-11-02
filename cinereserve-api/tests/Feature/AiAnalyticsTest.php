<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Movie;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // Tuesday Nov 3 2026, noon in Manila.
        $this->travelTo('2026-11-03 04:00:00');
        $branch = Branch::create(['name' => 'Central', 'slug' => 'central', 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'current_branch_id' => $branch->id]);
        $screen = Screen::create(['branch_id' => $branch->id, 'name' => 'Room 1', 'capacity' => 10]);
        $movie = Movie::create(['title' => 'Hello Love', 'slug' => 'hello-love', 'duration_minutes' => 120]);

        // Two confirmed bookings last Saturday 7 PM, one this coming Saturday,
        // and a cancelled one that must not count.
        $past = $this->schedule($branch->id, $screen->id, $movie->id, '2026-10-31', '19:00:00');
        $this->reserve($past, 'confirmed', 'A');
        $this->reserve($past, 'confirmed', 'B');
        $this->reserve($past, 'cancelled', 'C');
        $this->reserve($this->schedule($branch->id, $screen->id, $movie->id, '2026-11-07', '19:00:00'), 'confirmed', 'D');
    }

    public function test_it_builds_heatmap_forecast_and_movie_stats_from_confirmed_show_dates(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/ai-analytics')
            ->assertOk()
            ->assertJsonPath('from', '2026-09-08')
            ->assertJsonPath('to', '2026-11-02')
            ->assertJsonPath('total_bookings', 2)
            ->assertJsonPath('heatmap', [['weekday' => 6, 'hour' => 19, 'bookings' => 2]])
            ->assertJsonCount(7, 'forecast')
            // Saturday Nov 7: 2 bookings over 8 Saturdays, 1 already booked.
            ->assertJsonPath('forecast.4', ['date' => '2026-11-07', 'expected_bookings' => 0.3, 'expected_revenue' => '62.50', 'booked' => 1, 'showings' => 1])
            ->assertJsonPath('movies.0.title', 'Hello Love')
            ->assertJsonPath('movies.0.bookings', 2)
            ->assertJsonPath('movies.0.bookings_per_showing', 2)
            ->assertJsonPath('movies.0.trend', null);
    }

    public function test_insights_send_only_aggregates_to_gemini_and_return_bullets(): void
    {
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => "Here you go:\n- Add a **Saturday 7 PM** show.\n- Promo on Mondays."]]]]],
        ])]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai-analytics/insights')
            ->assertOk()
            ->assertExactJson(['insights' => ['Add a Saturday 7 PM show.', 'Promo on Mondays.']]);

        Http::assertSent(fn (HttpRequest $request) => str_contains($request['systemInstruction']['parts'][0]['text'], '"title":"Hello Love"')
            && ! str_contains($request['systemInstruction']['parts'][0]['text'], 'BOOKING-'));
    }

    public function test_insights_report_unavailable_without_a_gemini_key(): void
    {
        config(['services.gemini.key' => null]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai-analytics/insights')
            ->assertStatus(503);
    }

    private function schedule(int $branchId, int $screenId, int $movieId, string $date, string $time): int
    {
        return DB::table('schedules')->insertGetId([
            'movie_id' => $movieId,
            'branch_id' => $branchId,
            'screen_id' => $screenId,
            'show_date' => $date,
            'start_time' => $time,
            'end_time' => '21:00:00',
            'ticket_price' => 250,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function reserve(int $scheduleId, string $status, string $code): void
    {
        DB::table('reservations')->insert([
            'customer_id' => Customer::factory()->create()->id,
            'schedule_id' => $scheduleId,
            'reservation_code' => "BOOKING-{$code}",
            'subtotal' => 250,
            'total_amount' => 250,
            'status' => $status,
            'reserved_at' => now(),
            'expires_at' => now()->addDay(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
