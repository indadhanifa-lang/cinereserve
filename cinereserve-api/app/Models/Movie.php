<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'title',
    'slug',
    'description',
    'poster_url',
    'trailer_url',
    'duration_minutes',
    'release_date',
    'language',
    'age_rating',
    'status',
])]
class Movie extends Model
{
    /** branch_id is deliberately not fillable: it always comes from the authenticated admin. */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class, 'movie_genres');
    }
}
