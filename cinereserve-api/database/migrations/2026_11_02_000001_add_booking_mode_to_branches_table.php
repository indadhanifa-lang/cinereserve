<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How a mini cinema sells screenings: whole private rooms ("room") or
     * individual seats ("seat"). Existing branches already sell by seat.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->string('booking_mode', 10)->default('seat')->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('booking_mode');
        });
    }
};
