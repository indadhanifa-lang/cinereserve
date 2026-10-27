<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Movie;
use App\Models\Organization;
use App\Models\Reservation;
use App\Models\Schedule;
use App\Models\Screen;
use App\Models\Seat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerPaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private Schedule $schedule;

    /** @var array<int, int> */
    private array $seatIds;

    protected function setUp(): void
    {
        parent::setUp();

        $organization = Organization::create(['name' => 'Cinema Co', 'slug' => 'cinema-co']);
        $this->branch = Branch::create([
            'organization_id' => $organization->id,
            'name' => 'Central',
            'slug' => 'central',
            'address' => 'Main Street',
            'city' => 'Cagayan de Oro',
        ]);
        $screen = Screen::create(['branch_id' => $this->branch->id, 'name' => 'Screen 1', 'capacity' => 10]);

        $movie = new Movie(['title' => 'The Last Star', 'slug' => 'the-last-star', 'duration_minutes' => 118]);
        $movie->branch_id = $this->branch->id;
        $movie->save();

        $this->schedule = Schedule::create([
            'movie_id' => $movie->id,
            'branch_id' => $this->branch->id,
            'screen_id' => $screen->id,
            'show_date' => now('Asia/Manila')->addDay()->toDateString(),
            'start_time' => '18:00:00',
            'end_time' => '20:00:00',
            'ticket_price' => '250.00',
            'status' => 'active',
        ]);

        $this->seatIds = [
            Seat::create(['screen_id' => $screen->id, 'row_label' => 'A', 'seat_number' => 1, 'price_modifier' => '0.00', 'status' => 'active'])->id,
            Seat::create(['screen_id' => $screen->id, 'row_label' => 'A', 'seat_number' => 2, 'price_modifier' => '50.00', 'status' => 'active'])->id,
        ];
    }

    public function test_customer_can_reserve_and_pay_and_gets_a_ticket(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);

        $summary = $this->actingAs($customer, 'sanctum')
            ->getJson("/api/customer/reservations/{$reservationId}/payment");
        $summary->assertOk();
        // Compared numerically: SQLite drops the ".00" that PostgreSQL's numeric(10,2) keeps.
        $this->assertEquals(550, (float) $summary->json('reservation.total_amount'));
        // 10-minute hold, counted server-side.
        $this->assertEqualsWithDelta(600, $summary->json('reservation.expires_in_seconds'), 5);

        $response = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock']);

        $response->assertCreated();
        $this->assertEquals(550, (float) $response->json('payment.amount'));
        $response->assertJsonPath('payment.status', 'paid');
        $response->assertJsonPath('reservation.status', 'confirmed');
        $response->assertJsonPath('ticket.status', 'valid');
        $response->assertJsonMissingPath('ticket.qr_token');

        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('tickets', 1);
        $this->assertDatabaseHas('admin_notifications', [
            'branch_id' => $this->branch->id,
            'type' => 'booking_confirmed',
        ]);
    }

    public function test_paying_twice_returns_the_same_payment_without_duplicates(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);

        $first = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock']);
        $second = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock']);

        $second->assertOk();
        $this->assertSame($first->json('payment.id'), $second->json('payment.id'));
        $this->assertSame($first->json('ticket.id'), $second->json('ticket.id'));
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('tickets', 1);
        $this->assertDatabaseCount('admin_notifications', 2); // reservation_created + booking_confirmed
    }

    public function test_another_customer_cannot_view_or_pay_the_reservation(): void
    {
        $reservationId = $this->reserve($this->customer());
        $stranger = $this->customer();

        $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/customer/reservations/{$reservationId}/payment")
            ->assertNotFound();
        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock'])
            ->assertNotFound();

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_expired_hold_cannot_be_paid(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);

        $this->travel(11)->minutes();

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This reservation has expired.');

        $this->assertSame('pending', Reservation::find($reservationId)->status);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_expire_command_marks_lapsed_holds_expired_and_leaves_live_ones(): void
    {
        $customer = $this->customer();
        $lapsedId = $this->reserve($customer);

        $this->travel(11)->minutes();
        $liveId = $this->reserve($this->customer());

        $this->artisan('reservations:expire')->assertSuccessful();

        $this->assertSame('expired', Reservation::find($lapsedId)->status);
        $this->assertSame('pending', Reservation::find($liveId)->status);

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$lapsedId}/pay", ['payment_method' => 'mock'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This reservation has expired.');
    }

    public function test_admin_reservations_shows_lapsed_holds_as_expired_without_the_scheduler(): void
    {
        $reservationId = $this->reserve($this->customer());
        $this->travel(11)->minutes();

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => $this->branch->id]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reservations')
            ->assertOk()
            ->assertJsonPath('reservations.0.id', $reservationId)
            ->assertJsonPath('reservations.0.status', 'expired');
    }

    public function test_confirmed_reservations_are_never_expired(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock'])
            ->assertCreated();

        $this->travel(11)->minutes();
        $this->artisan('reservations:expire')->assertSuccessful();

        $this->assertSame('confirmed', Reservation::find($reservationId)->status);
    }

    public function test_unknown_payment_methods_are_rejected(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'paypal'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('payment_method');
    }

    public function test_the_chosen_payment_method_is_recorded(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'gcash'])
            ->assertCreated()
            ->assertJsonPath('payment.payment_method', 'gcash')
            ->assertJsonPath('reservation.status', 'confirmed');
    }

    public function test_paid_seats_cannot_be_reserved_again(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock'])
            ->assertCreated();

        $this->actingAs($this->customer(), 'sanctum')
            ->postJson('/api/customer/reservations', [
                'schedule_id' => $this->schedule->id,
                'seat_ids' => [$this->seatIds[0]],
            ])
            ->assertStatus(409);
    }

    public function test_admin_sees_payments_of_own_branch_only(): void
    {
        $customer = $this->customer();
        $reservationId = $this->reserve($customer);
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$reservationId}/pay", ['payment_method' => 'mock'])
            ->assertCreated();

        $ownAdmin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => $this->branch->id]);
        $this->actingAs($ownAdmin, 'sanctum')->getJson('/api/admin/payments')
            ->assertOk()
            ->assertJsonCount(1, 'payments')
            ->assertJsonPath('payments.0.status', 'paid');

        $otherOrganization = Organization::create(['name' => 'Other Co', 'slug' => 'other-co']);
        $otherBranch = Branch::create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Uptown',
            'slug' => 'uptown',
            'address' => 'Uptown Avenue',
            'city' => 'Cagayan de Oro',
        ]);
        $otherAdmin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'branch_id' => $otherBranch->id]);
        $this->actingAs($otherAdmin, 'sanctum')->getJson('/api/admin/payments')
            ->assertOk()
            ->assertJsonCount(0, 'payments');
    }

    private function customer(): User
    {
        return User::factory()->create(['role' => 'customer', 'status' => 'active']);
    }

    private function reserve(User $customer): int
    {
        $response = $this->actingAs($customer, 'sanctum')->postJson('/api/customer/reservations', [
            'schedule_id' => $this->schedule->id,
            'seat_ids' => $this->seatIds,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('reservation.total_amount', '550.00');

        return (int) $response->json('reservation.id');
    }
}
