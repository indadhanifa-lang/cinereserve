<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reservation extends Model
{
    /**
     * Persist the "expired" status for pending reservations whose seat hold
     * has run out. Seat occupancy and pay() already treat such holds as dead
     * by checking expires_at; this only makes the stored status say so, for
     * admin listings, dashboard counts and customer history. Idempotent and
     * safe to run from both the scheduler and read paths.
     */
    public static function expireStale(): int
    {
        return static::query()
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired', 'updated_at' => now()]);
    }

    /**
     * Reservations that currently hold a schedule: confirmed, or pending
     * with a live hold. Used for whole-room bookings, where any such
     * reservation makes the room unavailable.
     */
    public static function blockingSchedule(int $scheduleId): Builder
    {
        return static::query()
            ->where('schedule_id', $scheduleId)
            ->where(function (Builder $query) {
                $query->where('status', 'confirmed')
                    ->orWhere(function (Builder $pending) {
                        $pending->where('status', 'pending')
                            ->where(fn (Builder $hold) => $hold->whereNull('expires_at')->orWhere('expires_at', '>', now()));
                    });
            });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function reservationSeats(): HasMany
    {
        return $this->hasMany(ReservationSeat::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
