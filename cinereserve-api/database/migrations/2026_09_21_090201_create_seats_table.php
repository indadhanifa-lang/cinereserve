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
        Schema::create('seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('screen_id')->constrained('screens');
            $table->string('row_label', 10);
            $table->integer('seat_number');
            $table->string('seat_type', 30)->default('regular');
            $table->decimal('price_modifier', 10, 2)->default(0);
            $table->string('status', 20)->default('active');
            $table->unique(['screen_id', 'row_label', 'seat_number']);
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seats');
    }
};
