<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** "Clear" hides every new-movie notification added up to this time. */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('notifications_cleared_at')->nullable()->after('notifications_seen_at');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('notifications_cleared_at'));
    }
};
