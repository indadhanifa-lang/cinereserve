<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'email', 'phone', 'status'])]
class Organization extends Model
{
    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }
}
