<?php

use App\Models\Reservation;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reservations:expire', function () {
    $count = Reservation::expireStale();
    $this->info("Expired {$count} pending reservation(s).");
})->purpose('Mark pending reservations whose seat hold has run out as expired');

Schedule::command('reservations:expire')->everyMinute()->withoutOverlapping();

Artisan::command('platform:admin {email} {name}', function (string $email, string $name) {
    $password = $this->secret('Password (min 8 characters)');
    if (strlen((string) $password) < 8) {
        $this->error('Password must be at least 8 characters.');

        return 1;
    }

    $user = User::firstOrNew(['email' => strtolower(trim($email))]);
    $user->name = $name;
    $user->password = $password;
    $user->role = 'platform_admin';
    $user->status = 'active';
    $user->save();

    $this->info("Platform administrator {$user->email} is ready.");
})->purpose('Create or promote a platform administrator account');
