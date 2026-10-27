<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fresh installs no longer create this column (removed from the
        // original create_organizations_table migration), so this only has
        // work to do on databases migrated before that change.
        if (Schema::hasColumn('organizations', 'logo_url')) {
            Schema::table('organizations', function (Blueprint $table) {
                $table->dropColumn('logo_url');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->text('logo_url')->nullable();
        });
    }
};
