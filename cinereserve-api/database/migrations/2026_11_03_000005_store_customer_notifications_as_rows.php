<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Customer notifications become one notifications row per customer, so
     * the seen/cleared timestamps on customers are no longer needed. A
     * new-movie row points at its movie for the poster and the booking link.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('movie_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
            $table->index(['customer_id', 'read_at']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['notifications_seen_at', 'notifications_cleared_at']);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('notifications_seen_at')->nullable()->after('status');
            $table->timestamp('notifications_cleared_at')->nullable()->after('notifications_seen_at');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['customer_id', 'read_at']);
            $table->dropConstrainedForeignId('movie_id');
        });
    }
};
