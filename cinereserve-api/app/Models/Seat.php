<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'screen_id',
    'row_label',
    'seat_number',
    'seat_type',
    'price_modifier',
    'status',
])]
class Seat extends Model
{
    public function screen(): BelongsTo
    {
        return $this->belongsTo(Screen::class);
    }
}
