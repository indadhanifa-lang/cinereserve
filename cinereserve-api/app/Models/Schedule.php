<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'movie_id',
    'branch_id',
    'screen_id',
    'show_date',
    'start_time',
    'end_time',
    'ticket_price',
    'status',
])]
class Schedule extends Model
{
    /**
     * Allowed schedule lifecycle values. New schedules always start as
     * "active"; changing status belongs to the future Edit Schedule feature.
     */
    public const array STATUSES = ['active', 'cancelled', 'completed'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    public function screen(): BelongsTo
    {
        return $this->belongsTo(Screen::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
