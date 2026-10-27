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
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained('movies');
            $table->foreignId('branch_id')->constrained('branches');
            $table->foreignId('screen_id')->constrained('screens');
            $table->date('show_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->decimal('ticket_price', 10, 2);
            $table->string('status', 20)->default('active');
            $table->unique(['screen_id', 'show_date', 'start_time']);
            $table->index(['branch_id', 'show_date']);
            $table->index(['movie_id', 'show_date']);
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
