<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Room amenities were dropped from the product. Databases that already ran
 * the earlier partner fields migration still have the column.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('screens', 'amenities')) {
            Schema::table('screens', fn (Blueprint $table) => $table->dropColumn('amenities'));
        }
    }

    public function down(): void
    {
        // Nothing to restore: the column is no longer part of the schema.
    }
};
