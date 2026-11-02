<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Branches stand on their own: each signup is one cinema branch, so the
     * organization layer above it is gone. Organization rows are dropped.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organization_id');
        });

        Schema::dropIfExists('organizations');
    }

    /**
     * Restores the schema only; the dropped organization rows can't come back,
     * so branches.organization_id is left nullable.
     */
    public function down(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('slug', 160)->unique();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->foreignId('organization_id')->nullable()->after('id')->constrained('organizations');
        });
    }
};
