<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The room price now covers the room's capacity; extra persons past it pay
 * extra_guest_fee. included_guests is no longer part of the schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('screens', 'included_guests')) {
            Schema::table('screens', fn (Blueprint $table) => $table->dropColumn('included_guests'));
        }
    }

    public function down(): void
    {
        // Nothing to restore: the column is no longer part of the schema.
    }
};
