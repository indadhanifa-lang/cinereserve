<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Movie;
use App\Models\Reservation;
use App\Models\Screen;
use App\Models\Seat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Customer side of mini cinemas: listings, suspension, and on-demand
 * bookings (any catalog movie, any open time) by room or by seat.
 */
class PartnerBookingTest extends TestCase
{
    use RefreshDatabase;

    private Screen $room;

    private Movie $movie;

    private function establishment(string $mode, string $status = 'active', string $name = 'Starlight'): Screen
    {
        $branch = new Branch(['name' => $name, 'slug' => str($name)->slug(), 'address' => 'Main Street', 'city' => 'Cebu City', 'booking_mode' => $mode]);
        $branch->category = 'mini_cinema';
        $branch->status = $status;
        // Open every day 10:30 AM to 2:00 AM.
        $branch->operating_hours = collect(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
            ->mapWithKeys(fn ($day) => [$day => ['open' => '10:30', 'close' => '02:00']])
            ->all();
        $branch->save();

        $this->room = Screen::create(['branch_id' => $branch->id, 'name' => 'Room 1', 'capacity' => 6, 'rental_price' => '1500.00']);

        $this->movie = new Movie(['title' => $name.' Feature', 'slug' => str($name)->slug().'-feature', 'duration_minutes' => 120]);
        $this->movie->branch_id = $branch->id;
        $this->movie->save();

        return $this->room;
    }

    private function customer(): Customer
    {
        return Customer::factory()->create(['status' => 'active']);
    }

    private function tomorrow(): string
    {
        return now('Asia/Manila')->addDay()->toDateString();
    }

    private function book(Customer $customer, string $start, array $extra = [])
    {
        return $this->actingAs($customer, 'sanctum')->postJson('/api/customer/bookings', $extra + [
            'screen_id' => $this->room->id,
            'movie_id' => $this->movie->id,
            'date' => $this->tomorrow(),
            'start_time' => $start,
        ]);
    }

    public function test_room_bookings_charge_each_guest_past_capacity(): void
    {
        $this->establishment('room');

        // No extra-person fee: the room can't take more than its capacity.
        $this->book($this->customer(), '10:00', ['guests' => 7])->assertUnprocessable();

        $this->room->update(['extra_guest_fee' => '50.00']);

        $this->book($this->customer(), '13:00', ['guests' => 9])
            ->assertCreated()
            ->assertJsonPath('reservation.guests', 9)
            ->assertJsonPath('reservation.total_amount', '1650.00');
        $this->book($this->customer(), '19:00', ['guests' => 6])
            ->assertCreated()
            ->assertJsonPath('reservation.total_amount', '1500.00');
        $this->book($this->customer(), '22:00', ['guests' => Screen::MAX_GUESTS + 1])->assertUnprocessable();
    }

    public function test_only_active_establishments_are_listed(): void
    {
        $this->establishment('room', 'active', 'Live One');
        $this->establishment('room', 'draft', 'Draft One');
        $this->establishment('seat', 'suspended', 'Suspended One');

        $this->getJson('/api/public/branches')
            ->assertOk()
            ->assertJsonCount(1, 'branches')
            ->assertJsonPath('branches.0.name', 'Live One');
    }

    public function test_mini_cinema_details_list_movies_not_showtimes(): void
    {
        $draft = $this->establishment('room', 'draft');
        $live = $this->establishment('room', 'active', 'Live');

        $this->getJson("/api/public/branches/{$draft->branch_id}")->assertNotFound();
        $this->getJson("/api/public/branches/{$live->branch_id}")
            ->assertOk()
            ->assertJsonPath('rooms.0.name', 'Room 1')
            ->assertJsonPath('movies.0.title', 'Live Feature')
            ->assertJsonPath('schedules', []);
    }

    public function test_mini_cinema_bookings_never_show_as_public_showtimes(): void
    {
        $this->establishment('room');
        $this->book($this->customer(), '19:00')->assertCreated();

        $this->actingAs($this->customer(), 'sanctum')->getJson('/api/customer/showtimes')
            ->assertOk()
            ->assertJsonCount(0, 'movies')
            ->assertJsonCount(1, 'cinema_movies')
            ->assertJsonPath('cinema_movies.0.title', 'Starlight Feature')
            ->assertJsonPath('cinema_movies.0.branch.id', $this->room->branch_id)
            ->assertJsonPath('cinema_movies.0.branch.booking_mode', 'room');
    }

    public function test_draft_cinema_movies_are_hidden(): void
    {
        $this->establishment('room', 'draft');

        $this->actingAs($this->customer(), 'sanctum')->getJson('/api/customer/showtimes')
            ->assertOk()
            ->assertJsonCount(0, 'cinema_movies');
    }

    public function test_suspended_establishment_rejects_new_bookings(): void
    {
        $this->establishment('room', 'suspended');

        $this->book($this->customer(), '19:00')->assertStatus(409);
    }

    public function test_room_booking_lasts_the_movie_and_blocks_overlaps(): void
    {
        $this->establishment('room');

        $this->book($this->customer(), '19:00')
            ->assertCreated()
            ->assertJsonPath('reservation.booking_type', 'room')
            ->assertJsonPath('reservation.total_amount', '1500.00');

        // 19:00 + 120 min = 21:00, so 20:00 overlaps and 21:00 is free.
        $this->book($this->customer(), '20:00')->assertStatus(409);
        $this->book($this->customer(), '21:00')->assertCreated();

        $this->actingAs($this->customer(), 'sanctum')
            ->getJson("/api/customer/rooms/{$this->room->id}/slot?movie_id={$this->movie->id}&date={$this->tomorrow()}&start_time=19:30")
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonCount(2, 'busy');
    }

    public function test_booking_must_fit_opening_hours_including_past_midnight(): void
    {
        $this->establishment('room');

        $this->book($this->customer(), '09:00')->assertUnprocessable();
        // 23:30 + 2h ends 1:30 AM, before the 2:00 AM close.
        $this->book($this->customer(), '23:30')->assertCreated();
        // 00:30 + 2h ends 2:30 AM, after closing.
        $this->book($this->customer(), '00:30')->assertUnprocessable();
    }

    public function test_expired_hold_frees_the_room(): void
    {
        $this->establishment('room');

        $id = $this->book($this->customer(), '19:00')->json('reservation.id');
        Reservation::whereKey($id)->update(['expires_at' => now()->subMinute()]);

        $this->book($this->customer(), '19:30')->assertCreated();
    }

    public function test_room_booking_can_be_paid_and_ticketed(): void
    {
        $this->establishment('room');
        $customer = $this->customer();

        $id = $this->book($customer, '19:00')->json('reservation.id');

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/customer/reservations/{$id}/pay", ['payment_method' => 'gcash'])
            ->assertCreated()
            ->assertJsonPath('reservation.status', 'confirmed')
            ->assertJsonPath('reservation.booking_type', 'room');

        $this->actingAs($customer, 'sanctum')->getJson('/api/customer/tickets')
            ->assertOk()
            ->assertJsonPath('tickets.0.reservation.booking_type', 'room');
    }

    public function test_seat_mode_shares_a_slot_for_the_same_movie_and_time(): void
    {
        $this->establishment('seat');
        $bench = Seat::create([
            'screen_id' => $this->room->id, 'row_label' => 'A', 'seat_number' => 1,
            'seat_type' => 'bench', 'capacity' => 4, 'price_modifier' => '500.00', 'status' => 'active',
        ]);
        $seat = Seat::create(['screen_id' => $this->room->id, 'row_label' => 'A', 'seat_number' => 2, 'status' => 'active']);

        $this->book($this->customer(), '19:00')->assertUnprocessable()->assertJsonValidationErrors('seat_ids');

        // Bench priced once: room seat price 1500 + bench modifier 500.
        $this->book($this->customer(), '19:00', ['seat_ids' => [$bench->id]])
            ->assertCreated()
            ->assertJsonPath('reservation.total_amount', '2000.00');

        // Same movie and time joins the slot; the bench is taken, the other seat isn't.
        $this->book($this->customer(), '19:00', ['seat_ids' => [$bench->id]])->assertStatus(409);
        $this->book($this->customer(), '19:00', ['seat_ids' => [$seat->id]])->assertCreated();

        // A different start time overlapping the slot is refused.
        $this->book($this->customer(), '19:30', ['seat_ids' => [$seat->id]])->assertStatus(409);
    }

    public function test_old_schedule_endpoint_refuses_mini_cinemas(): void
    {
        $this->establishment('room');
        $id = $this->book($this->customer(), '19:00')->json('reservation.id');
        $scheduleId = Reservation::find($id)->schedule_id;

        $this->actingAs($this->customer(), 'sanctum')
            ->postJson('/api/customer/reservations', ['schedule_id' => $scheduleId])
            ->assertUnprocessable();
    }

    public function test_owner_dashboard_counts_rooms_in_use_and_todays_bookings(): void
    {
        $this->establishment('room');
        $customer = $this->customer();
        foreach (['19:00', '23:30'] as $start) {
            $id = $this->book($customer, $start)->json('reservation.id');
            $this->actingAs($customer, 'sanctum')
                ->postJson("/api/customer/reservations/{$id}/pay", ['payment_method' => 'gcash'])
                ->assertCreated();
        }
        $owner = User::factory()->create(['current_branch_id' => $this->room->branch_id]);
        $day = now('Asia/Manila')->addDay();

        $this->travelTo($day->copy()->setTime(12, 0));
        $this->actingAs($owner, 'sanctum')->getJson('/api/admin/dashboard/overview')
            ->assertJsonPath('rooms_in_use', 0)
            ->assertJsonPath('bookings_today', 2)
            ->assertJsonPath('rooms_booked_today', 1)
            ->assertJsonPath('next_booking_start', '19:00:00');

        $this->travelTo($day->copy()->setTime(19, 30));
        $this->actingAs($owner, 'sanctum')->getJson('/api/admin/dashboard/overview')
            ->assertJsonPath('rooms_in_use', 1)
            ->assertJsonPath('next_booking_start', '23:30:00');

        // 23:30 + 2h runs to 1:30 AM the next day.
        $this->travelTo($day->copy()->addDay()->setTime(0, 30));
        $this->actingAs($owner, 'sanctum')->getJson('/api/admin/dashboard/overview')
            ->assertJsonPath('rooms_in_use', 1);
    }
}
