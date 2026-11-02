<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'branch_id',
    'name',
    'screen_type',
    'capacity',
    'rental_price',
    'extra_guest_fee',
    'status',
])]
class Screen extends Model
{
    // ponytail: flat sanity cap on party size once extra persons are allowed;
    // make it a per-room field if owners need a real limit.
    public const MAX_GUESTS = 100;

    /**
     * By-Room parties: the room price covers capacity people and everyone
     * past that pays extra_guest_fee. Without a fee the price is flat, so
     * nobody counts as extra.
     */
    public function extraGuests(int $guests): int
    {
        if ($this->extra_guest_fee === null) {
            return 0;
        }

        return max(0, $guests - (int) $this->capacity);
    }

    /** Most people one By-Room booking may bring: capacity, unless extras pay. */
    public function maxGuests(): int
    {
        return $this->extra_guest_fee === null ? (int) $this->capacity : self::MAX_GUESTS;
    }

    protected function casts(): array
    {
        return [
            'photos' => 'array',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
