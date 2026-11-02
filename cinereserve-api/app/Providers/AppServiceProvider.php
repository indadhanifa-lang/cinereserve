<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Reset links open the partner portal's reset page, not this API.
        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('app.admin_url')
            .'/reset-password?token='.$token.'&email='.urlencode($user->email));
    }
}
