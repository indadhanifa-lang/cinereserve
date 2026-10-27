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
        Schema::create('ai_demand_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches');
            $table->foreignId('schedule_id')->nullable()->constrained('schedules');
            $table->date('prediction_date');
            $table->smallInteger('prediction_hour')->nullable();
            $table->decimal('predicted_bookings', 10, 2);
            $table->decimal('predicted_occupancy', 5, 2)->nullable();
            $table->string('model_name', 100)->nullable();
            $table->timestamp('created_at');
            $table->index(['branch_id', 'prediction_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_demand_predictions');
    }
};
