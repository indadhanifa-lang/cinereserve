<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'organization_id',
    'name',
    'slug',
    'address',
    'city',
    'province',
    'phone',
    'email',
    'latitude',
    'longitude',
    'logo_url',
    'primary_color',
    'secondary_color',
    'status',
])]
class Branch extends Model
{
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
