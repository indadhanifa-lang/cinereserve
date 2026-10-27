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
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();                                    // BIGSERIAL / primary key
            $table->string('name', 150);                     // VARCHAR(150), NOT NULL
            $table->string('slug', 160)->unique();           // VARCHAR(160), UNIQUE
            $table->string('email', 150)->nullable();        // VARCHAR(150), nullable
            $table->string('phone', 30)->nullable();         // VARCHAR(30), nullable
            $table->string('status', 20)->default('active'); // VARCHAR(20), default "active"
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
