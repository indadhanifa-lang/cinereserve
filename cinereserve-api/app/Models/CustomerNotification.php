<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A customer-app notification (the notifications table). Not Laravel's
 * notification system: rows are written directly, one per customer.
 */
class CustomerNotification extends Model
{
    protected $table = 'notifications';

    /**
     * Attributes assigned directly (project convention — no fillable).
     *
     * @var array<string, string>
     */
    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    /**
     * Tells every active customer about a movie once it is active at a
     * branch customers can see. A movie is only ever announced once, so
     * re-saving it or toggling it off and on again sends nothing new.
     */
    // ponytail: synchronous chunked insert, one row per customer; move to a queued job if the customer count makes saving a movie slow.
    public static function announceMovie(Movie $movie): void
    {
        $movie->loadMissing('branch');

        if ($movie->status !== 'active' || $movie->branch?->status !== 'active') {
            return;
        }
        if (static::where('movie_id', $movie->id)->exists()) {
            return;
        }

        $now = now();
        Customer::where('status', 'active')->select('id')->chunkById(500, function ($customers) use ($movie, $now) {
            static::insert($customers->map(fn (Customer $customer) => [
                'customer_id' => $customer->id,
                'movie_id' => $movie->id,
                'type' => 'new_movie',
                'title' => Str::limit('New movie at '.$movie->branch->name, 150),
                'message' => $movie->title.' is now available to book.',
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }
}
