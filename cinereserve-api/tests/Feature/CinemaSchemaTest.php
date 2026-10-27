<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CinemaSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['database.default' => 'schema_testing', 'database.connections.schema_testing' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
    }

    public function test_fresh_schema_supports_bookings_and_ai_records(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $booking = $this->createBooking();

        $this->insert('payments', ['reservation_id' => $booking['reservation_id'], 'payment_method' => 'mock', 'amount' => 250]);
        $this->insert('payments', ['reservation_id' => $booking['reservation_id'], 'payment_method' => 'mock', 'amount' => 250]);
        $this->insert('tickets', ['reservation_id' => $booking['reservation_id'], 'ticket_code' => 'TICKET-1', 'qr_token' => 'unique-token']);
        $this->insert('reviews', ['user_id' => $booking['user_id'], 'movie_id' => $booking['movie_id'], 'rating' => 1]);
        $this->insert('reviews', ['user_id' => $booking['user_id'], 'movie_id' => $booking['movie_id'], 'rating' => 5]);
        $this->insert('notifications', ['user_id' => $booking['user_id'], 'title' => 'Booking received', 'message' => 'Your seats are reserved.']);
        $this->insert('movie_interactions', ['user_id' => $booking['user_id'], 'movie_id' => $booking['movie_id'], 'interaction_type' => 'reserved']);
        DB::table('ai_demand_predictions')->insert(['branch_id' => $booking['branch_id'], 'prediction_date' => '2026-09-22', 'predicted_bookings' => 10.5, 'created_at' => '2026-09-21 12:00:00']);
        DB::table('ai_recommendation_logs')->insert(['user_id' => $booking['user_id'], 'movie_id' => $booking['movie_id'], 'score' => 0.98765, 'created_at' => '2026-09-21 12:00:00']);

        $this->assertDatabaseHas('seats', ['id' => $booking['seat_id'], 'seat_type' => 'regular', 'price_modifier' => 0]);
        $this->assertDatabaseHas('reservations', ['id' => $booking['reservation_id'], 'status' => 'pending', 'discount_amount' => 0]);
        $this->assertDatabaseHas('tickets', ['ticket_code' => 'TICKET-1', 'status' => 'valid']);
        $this->assertDatabaseHas('reviews', ['rating' => 5, 'status' => 'published']);
        $this->assertDatabaseHas('notifications', ['read_at' => null]);
        $this->assertDatabaseHas('ai_demand_predictions', ['schedule_id' => null, 'predicted_bookings' => 10.5]);
        $this->assertDatabaseHas('ai_recommendation_logs', ['score' => 0.98765]);
        $this->assertDatabaseCount('payments', 2);
    }

    public function test_migrations_roll_back_and_can_run_again(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();

        $this->artisan('migrate:rollback', ['--force' => true])->assertSuccessful();

        $this->assertFalse(Schema::hasTable('seats'));
        $this->assertFalse(Schema::hasTable('ai_recommendation_logs'));
        $this->assertFalse(Schema::hasTable('users'));
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->assertModelExists(User::factory()->create());
    }

    #[DataProvider('invalidRatings')]
    public function test_reviews_reject_invalid_ratings(?int $rating): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $booking = $this->createBooking();

        $this->expectException(QueryException::class);
        $this->insert('reviews', ['user_id' => $booking['user_id'], 'movie_id' => $booking['movie_id'], 'rating' => $rating]);
    }

    public static function invalidRatings(): array
    {
        return ['below minimum' => [0], 'above maximum' => [6], 'missing rating' => [null]];
    }

    #[DataProvider('duplicateRecords')]
    public function test_schema_rejects_duplicate_business_keys(string $table, array $attributes): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->createBooking();

        $this->expectException(QueryException::class);
        $this->insert($table, $attributes);
    }

    public static function duplicateRecords(): array
    {
        return [
            'seat in screen' => ['seats', ['screen_id' => 1, 'row_label' => 'A', 'seat_number' => 1]],
            'showtime in screen' => ['schedules', ['movie_id' => 1, 'branch_id' => 1, 'screen_id' => 1, 'show_date' => '2026-09-22', 'start_time' => '18:00:00', 'end_time' => '20:00:00', 'ticket_price' => 250]],
            'seat in reservation' => ['reservation_seats', ['reservation_id' => 1, 'seat_id' => 1, 'price' => 250]],
            'booking code' => ['reservations', ['user_id' => 1, 'schedule_id' => 1, 'reservation_code' => 'BOOKING-1', 'subtotal' => 250, 'total_amount' => 250, 'reserved_at' => '2026-09-21 12:00:00']],
        ];
    }

    public function test_seats_reject_nonexistent_screens(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();

        $this->expectException(QueryException::class);
        $this->insert('seats', ['screen_id' => 999, 'row_label' => 'A', 'seat_number' => 1]);
    }

    public function test_required_timestamps_cannot_be_null(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();

        $this->expectException(QueryException::class);
        DB::table('organizations')->insert(['name' => 'Missing timestamps', 'slug' => 'missing']);
    }

    private function insert(string $table, array $attributes): int
    {
        return DB::table($table)->insertGetId($attributes + ['created_at' => '2026-09-21 12:00:00', 'updated_at' => '2026-09-21 12:00:00']);
    }

    /** @return array<string, int> */
    private function createBooking(): array
    {
        $organizationId = $this->insert('organizations', ['name' => 'Cinema', 'slug' => 'cinema']);
        $branchId = $this->insert('branches', ['organization_id' => $organizationId, 'name' => 'Central', 'slug' => 'central', 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);
        $screenId = $this->insert('screens', ['branch_id' => $branchId, 'name' => 'Screen 1', 'capacity' => 100]);
        $seatId = $this->insert('seats', ['screen_id' => $screenId, 'row_label' => 'A', 'seat_number' => 1]);
        $movieId = $this->insert('movies', ['title' => 'Test Movie', 'slug' => 'test-movie', 'duration_minutes' => 120]);
        $scheduleId = $this->insert('schedules', ['movie_id' => $movieId, 'branch_id' => $branchId, 'screen_id' => $screenId, 'show_date' => '2026-09-22', 'start_time' => '18:00:00', 'end_time' => '20:00:00', 'ticket_price' => 250]);
        $user = User::factory()->create();
        $reservationId = $this->insert('reservations', ['user_id' => $user->id, 'schedule_id' => $scheduleId, 'reservation_code' => 'BOOKING-1', 'subtotal' => 250, 'total_amount' => 250, 'reserved_at' => '2026-09-21 12:00:00']);
        $this->insert('reservation_seats', ['reservation_id' => $reservationId, 'seat_id' => $seatId, 'price' => 250]);

        return ['branch_id' => $branchId, 'screen_id' => $screenId, 'seat_id' => $seatId, 'movie_id' => $movieId, 'schedule_id' => $scheduleId, 'user_id' => $user->id, 'reservation_id' => $reservationId];
    }
}
