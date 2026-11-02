<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Movie;
use App\Models\Screen;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_counts_bookings_by_manila_booking_date_even_for_upcoming_shows(): void
    {
        $this->travelTo('2026-11-03 04:00:00');
        $branch = Branch::create(['name' => 'Central', 'slug' => 'central', 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'current_branch_id' => $branch->id]);
        $screen = Screen::create(['branch_id' => $branch->id, 'name' => 'Room 1', 'capacity' => 10]);
        $movie = Movie::create(['title' => 'Upcoming', 'slug' => 'upcoming', 'duration_minutes' => 120]);

        $scheduleId = DB::table('schedules')->insertGetId([
            'movie_id' => $movie->id,
            'branch_id' => $branch->id,
            'screen_id' => $screen->id,
            'show_date' => '2026-11-07',
            'start_time' => '18:00:00',
            'end_time' => '20:00:00',
            'ticket_price' => 250,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 18:30 UTC on Nov 2 is 02:30 on Nov 3 in Manila.
        $bookedAt = '2026-11-02 18:30:00';
        $reservationId = DB::table('reservations')->insertGetId([
            'customer_id' => Customer::factory()->create()->id,
            'schedule_id' => $scheduleId,
            'reservation_code' => 'BOOKING-1',
            'subtotal' => 250,
            'total_amount' => 250,
            'status' => 'confirmed',
            'reserved_at' => $bookedAt,
            'created_at' => $bookedAt,
            'updated_at' => $bookedAt,
        ]);
        DB::table('payments')->insert([
            'reservation_id' => $reservationId,
            'payment_method' => 'gcash',
            'amount' => 250,
            'status' => 'paid',
            'paid_at' => $bookedAt,
            'created_at' => $bookedAt,
            'updated_at' => $bookedAt,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reports?from=2026-11-03&to=2026-11-03')
            ->assertOk()
            ->assertJsonPath('revenue_by_day', [['date' => '2026-11-03', 'revenue' => '250.00', 'bookings' => 1]])
            ->assertJsonPath('bookings_by_status.confirmed', 1)
            ->assertJsonPath('top_movies.0.title', 'Upcoming')
            ->assertJsonCount(12, 'revenue_by_month')
            ->assertJsonPath('revenue_by_month.0', ['month' => '2025-12', 'revenue' => '0.00', 'bookings' => 0])
            ->assertJsonPath('revenue_by_month.11', ['month' => '2026-11', 'revenue' => '250.00', 'bookings' => 1]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reports?from=2026-11-02&to=2026-11-02')
            ->assertOk()
            ->assertJsonPath('revenue_by_day', []);
    }
}
