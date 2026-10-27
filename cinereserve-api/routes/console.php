<?php

use App\Models\Reservation;
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
