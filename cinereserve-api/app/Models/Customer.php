<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A customer-app account. Business owners, staff and platform admins live in
 * users; the two never share a table, so neither can sign in as the other.
 */
#[Fillable(['name', 'email', 'password', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class Customer extends Authenticatable
{
    /** @use HasFactory<CustomerFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Always "customer", so role checks shared with users (route `role`
     * middleware, `$user->role !== 'customer'`) keep working on either model.
     */
    protected function role(): Attribute
    {
        return Attribute::get(fn () => 'customer');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
