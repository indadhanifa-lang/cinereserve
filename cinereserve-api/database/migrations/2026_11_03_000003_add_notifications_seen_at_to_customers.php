<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * New-movie notifications are read from the movies table, so one
     * timestamp per customer is enough to know what is still unread.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('notifications_seen_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('notifications_seen_at'));
    }
};
