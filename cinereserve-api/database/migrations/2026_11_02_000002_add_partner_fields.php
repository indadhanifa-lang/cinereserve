<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Business partner columns: who owns an establishment and its public
     * profile, room details for By-Room booking, bench capacity for By-Seat
     * layouts, and whether a reservation rents a whole room.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            $table->text('description')->nullable()->after('name');
            // Existing branches are regular cinemas; partner signups are mini_cinema.
            $table->string('category', 30)->default('cinema')->after('description');
            $table->json('operating_hours')->nullable();
            $table->json('photos')->nullable();
        });

        // The first admin of each existing branch becomes its owner.
        DB::table('branches')->update([
            'owner_id' => DB::raw("(select min(users.id) from users where users.branch_id = branches.id and users.role = 'admin')"),
        ]);

        Schema::table('screens', function (Blueprint $table) {
            $table->decimal('rental_price', 10, 2)->nullable()->after('capacity');
            $table->json('photos')->nullable();
        });

        Schema::table('seats', function (Blueprint $table) {
            // Benches seat several people but are booked as one unit.
            $table->unsignedSmallInteger('capacity')->default(1)->after('seat_type');
        });

        Schema::table('reservations', function (Blueprint $table) {
            // "room" reservations rent the whole screen and have no reservation_seats.
            $table->string('booking_type', 10)->default('seat')->after('schedule_id');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', fn (Blueprint $table) => $table->dropColumn('booking_type'));
        Schema::table('seats', fn (Blueprint $table) => $table->dropColumn('capacity'));
        Schema::table('screens', fn (Blueprint $table) => $table->dropColumn(['rental_price', 'photos']));
        Schema::table('branches', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
            $table->dropColumn(['description', 'category', 'operating_hours', 'photos']);
        });
    }
};
