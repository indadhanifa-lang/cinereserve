<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Movies become branch-owned like screens and schedules. Existing movies
     * go to the branch that already schedules them; unscheduled ones go to
     * the oldest branch so nothing disappears from every catalog.
     */
    public function up(): void
    {
        Schema::table('movies', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('id')->constrained('branches');
            $table->index('branch_id');
        });

        DB::statement('
            UPDATE movies
            SET branch_id = (
                SELECT schedules.branch_id FROM schedules
                WHERE schedules.movie_id = movies.id
                ORDER BY schedules.id
                LIMIT 1
            )
        ');

        $firstBranchId = DB::table('branches')->min('id');
        if ($firstBranchId) {
            DB::table('movies')->whereNull('branch_id')->update(['branch_id' => $firstBranchId]);
        }
    }

    public function down(): void
    {
        Schema::table('movies', function (Blueprint $table) {
            $table->dropIndex(['branch_id']);
            $table->dropConstrainedForeignId('branch_id');
        });
    }
};
