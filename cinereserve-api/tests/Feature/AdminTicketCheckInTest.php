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

class AdminTicketCheckInTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        // Nov 3 2026, 6 PM in Manila.
        $this->travelTo('2026-11-03 10:00:00');
        $this->branch = Branch::create(['name' => 'Central', 'slug' => 'central', 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'current_branch_id' => $this->branch->id]);
    }

    public function test_it_checks_in_a_valid_ticket_for_today_once(): void
    {
        $this->ticket($this->branch, '2026-11-03', 'TKT-TODAY');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/tickets/check-in', ['code' => ' tkt-today '])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'used')
            // Stored UTC, returned as Manila time.
            ->assertJsonPath('ticket.checked_in_at', '2026-11-03 18:00:00');

        $this->assertDatabaseHas('tickets', ['ticket_code' => 'TKT-TODAY', 'status' => 'used', 'checked_in_at' => '2026-11-03 10:00:00']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/tickets/check-in', ['code' => 'TKT-TODAY'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Already checked in at Nov 3, 6:00 PM.');
    }

    public function test_it_rejects_tickets_for_another_day_or_another_branch(): void
    {
        $this->ticket($this->branch, '2026-11-09', 'TKT-LATER');
        $other = Branch::create(['name' => 'North', 'slug' => 'north', 'address' => 'North Street', 'city' => 'Cagayan de Oro']);
        $this->ticket($other, '2026-11-03', 'TKT-OTHER');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/tickets/check-in', ['code' => 'TKT-LATER'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This ticket is for Nov 9, 2026, not today.');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/tickets/check-in', ['code' => 'TKT-OTHER'])
            ->assertNotFound();

        $this->assertDatabaseMissing('tickets', ['status' => 'used']);
    }

    private function ticket(Branch $branch, string $showDate, string $code): void
    {
        $screen = Screen::create(['branch_id' => $branch->id, 'name' => "Room {$code}", 'capacity' => 10]);
        $movie = Movie::create(['title' => "Movie {$code}", 'slug' => strtolower($code), 'duration_minutes' => 120]);
        $scheduleId = DB::table('schedules')->insertGetId([
            'movie_id' => $movie->id,
            'branch_id' => $branch->id,
            'screen_id' => $screen->id,
            'show_date' => $showDate,
            'start_time' => '19:00:00',
            'end_time' => '21:00:00',
            'ticket_price' => 250,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $reservationId = DB::table('reservations')->insertGetId([
            'customer_id' => Customer::factory()->create()->id,
            'schedule_id' => $scheduleId,
            'reservation_code' => "RES-{$code}",
            'subtotal' => 250,
            'total_amount' => 250,
            'status' => 'confirmed',
            'reserved_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('tickets')->insert([
            'reservation_id' => $reservationId,
            'ticket_code' => $code,
            'qr_token' => "qr-{$code}",
            'status' => 'valid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
