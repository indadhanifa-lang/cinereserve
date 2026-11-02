<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * By-Room pricing for groups: the room price covers capacity people,
     * each extra person adds extra_guest_fee. The reservation keeps the
     * party size the customer booked for.
     */
    public function up(): void
    {
        Schema::table('screens', function (Blueprint $table) {
            $table->decimal('extra_guest_fee', 10, 2)->nullable()->after('rental_price');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->unsignedSmallInteger('guests')->nullable()->after('booking_type');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', fn (Blueprint $table) => $table->dropColumn('guests'));
        Schema::table('screens', fn (Blueprint $table) => $table->dropColumn('extra_guest_fee'));
    }
};
