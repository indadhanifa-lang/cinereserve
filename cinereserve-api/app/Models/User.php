<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A partner-portal account: business owner, staff or platform admin.
 * Customers are App\Models\Customer.
 */
#[Fillable(['name', 'email', 'password', 'phone', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /** The establishment currently selected in the portal; admin endpoints scope by it. */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'current_branch_id');
    }

    /** Establishments this user may manage, with pivot role owner or staff. */
    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class)->withPivot('role')->withTimestamps();
    }
}
