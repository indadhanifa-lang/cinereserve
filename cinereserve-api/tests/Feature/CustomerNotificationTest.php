<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_adding_a_movie_writes_one_notification_row_per_active_customer(): void
    {
        $admin = $this->admin('Koze');
        $customer = Customer::factory()->create(['status' => 'active']);
        $other = Customer::factory()->create(['status' => 'active']);
        Customer::factory()->create(['status' => 'inactive']);

        $this->addMovie($admin, 'Sinners');
        $this->addMovie($admin, 'Hidden', 'inactive');

        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseHas('notifications', ['customer_id' => $customer->id, 'type' => 'new_movie', 'title' => 'New movie at Koze', 'message' => 'Sinners is now available to book.']);
        $this->assertDatabaseHas('notifications', ['customer_id' => $other->id]);

        // Turning a movie on announces it once; toggling again sends nothing new.
        $hidden = $this->getJson('/api/admin/movies')->json('movies.0.id');
        $this->patchJson("/api/admin/movies/{$hidden}/status", ['status' => 'active'])->assertOk();
        $this->patchJson("/api/admin/movies/{$hidden}/status", ['status' => 'inactive'])->assertOk();
        $this->patchJson("/api/admin/movies/{$hidden}/status", ['status' => 'active'])->assertOk();

        $this->assertDatabaseCount('notifications', 4);
    }

    public function test_customer_reads_marks_and_clears_only_their_own_rows(): void
    {
        $admin = $this->admin('Koze');
        $customer = Customer::factory()->create(['status' => 'active']);
        $other = Customer::factory()->create(['status' => 'active']);
        $this->addMovie($admin, 'Sinners');
        $this->addMovie($admin, 'Spider-Man');

        $feed = $this->actingAs($customer, 'sanctum')->getJson('/api/customer/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('notifications.*.message', ['Spider-Man is now available to book.', 'Sinners is now available to book.']);

        $this->patchJson('/api/customer/notifications/'.$feed->json('notifications.0.id').'/read')
            ->assertJsonPath('unread_count', 1);

        $this->postJson('/api/customer/notifications/seen')->assertOk();
        $this->assertDatabaseMissing('notifications', ['customer_id' => $customer->id, 'read_at' => null]);

        $this->postJson('/api/customer/notifications/clear')->assertOk();
        $this->assertDatabaseMissing('notifications', ['customer_id' => $customer->id]);
        $this->assertDatabaseHas('notifications', ['customer_id' => $other->id, 'read_at' => null]);
    }

    private function admin(string $branchName): User
    {
        $branch = Branch::create(['name' => $branchName, 'slug' => str($branchName)->slug(), 'address' => 'Main Street', 'city' => 'Cagayan de Oro']);

        return User::factory()->create(['role' => 'admin', 'status' => 'active', 'current_branch_id' => $branch->id]);
    }

    private function addMovie(User $admin, string $title, string $status = 'active'): void
    {
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/movies', ['title' => $title, 'duration_minutes' => 120, 'status' => $status])
            ->assertCreated();
    }
}
