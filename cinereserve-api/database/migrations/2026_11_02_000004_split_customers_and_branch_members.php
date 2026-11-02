<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tables whose user_id always pointed at a customer account. */
    private const CUSTOMER_TABLES = ['reservations', 'notifications', 'reviews', 'movie_interactions', 'ai_recommendation_logs'];

    private const CUSTOMER_COLUMNS = [
        'id', 'name', 'email', 'password', 'phone', 'avatar_url',
        'email_verified_at', 'status', 'remember_token', 'created_at', 'updated_at',
    ];

    /**
     * Normalizes accounts:
     * - customers (mobile app accounts) move out of users into their own table;
     *   users keeps business owners, staff and platform administrators.
     * - who manages which establishment moves into a branch_user pivot,
     *   replacing branches.owner_id; users.branch_id becomes
     *   current_branch_id, the establishment the user has selected.
     */
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('email', 150)->unique();
            $table->string('password', 255);
            $table->string('phone', 30)->nullable();
            $table->text('avatar_url')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('status', 20)->default('active');
            $table->rememberToken();
            $table->timestamps();
        });

        // Ids are kept, so every existing customer reference stays valid.
        DB::table('customers')->insertUsing(
            self::CUSTOMER_COLUMNS,
            DB::table('users')->where('role', 'customer')->select(self::CUSTOMER_COLUMNS),
        );
        $this->resetSequence('customers');

        foreach (self::CUSTOMER_TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->renameColumn('user_id', 'customer_id');
            });
            Schema::table($name, function (Blueprint $table) {
                $table->foreign('customer_id')->references('id')->on('customers');
            });
        }

        // SQLite (tests only) rebuilds the table to change a foreign key and
        // drops the rating CHECK on the way; put it back with a trigger.
        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared("CREATE TRIGGER reviews_rating_check BEFORE INSERT ON reviews
                WHEN NEW.rating NOT BETWEEN 1 AND 5 BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: rating'); END");
        }

        $customerIds = DB::table('customers')->select('id');
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->whereIn('tokenable_id', $customerIds)
            ->update(['tokenable_type' => 'App\\Models\\Customer']);
        DB::table('users')->where('role', 'customer')->delete();

        Schema::create('branch_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // owner = registered the establishment; staff = assigned to run it.
            $table->string('role', 20)->default('staff');
            $table->timestamps();
            $table->unique(['branch_id', 'user_id']);
        });

        DB::table('branch_user')->insertUsing(
            ['branch_id', 'user_id', 'role', 'created_at', 'updated_at'],
            DB::table('branches')->whereNotNull('owner_id')
                ->selectRaw("id, owner_id, 'owner', created_at, updated_at"),
        );
        DB::table('branch_user')->insertUsing(
            ['branch_id', 'user_id', 'role', 'created_at', 'updated_at'],
            DB::table('users')
                ->whereNotNull('branch_id')
                ->whereNotExists(fn ($query) => $query->from('branch_user')
                    ->whereColumn('branch_user.branch_id', 'users.branch_id')
                    ->whereColumn('branch_user.user_id', 'users.id'))
                ->selectRaw("branch_id, id, 'staff', created_at, updated_at"),
        );

        Schema::table('branches', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('branch_id', 'current_branch_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('current_branch_id', 'branch_id');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });
        DB::table('branches')->update([
            'owner_id' => DB::raw("(select min(user_id) from branch_user where branch_user.branch_id = branches.id and branch_user.role = 'owner')"),
        ]);
        Schema::dropIfExists('branch_user');

        // Customer ids may collide with staff ids, so customers get new user ids.
        $offset = (int) DB::table('users')->max('id');
        DB::table('users')->insertUsing(
            [...self::CUSTOMER_COLUMNS, 'role'],
            DB::table('customers')->selectRaw(
                'id + '.$offset.', name, email, password, phone, avatar_url, email_verified_at, status, remember_token, created_at, updated_at, ?',
                ['customer'],
            ),
        );
        $this->resetSequence('users');

        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\Customer')
            ->update([
                'tokenable_type' => 'App\\Models\\User',
                'tokenable_id' => DB::raw('tokenable_id + '.$offset),
            ]);

        foreach (self::CUSTOMER_TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['customer_id']);
                $table->renameColumn('customer_id', 'user_id');
            });
            DB::table($name)->update(['user_id' => DB::raw('user_id + '.$offset)]);
            Schema::table($name, function (Blueprint $table) {
                $table->foreign('user_id')->references('id')->on('users');
            });
        }

        Schema::dropIfExists('customers');
    }

    /** Explicit ids were inserted, so Postgres must continue after the highest one. */
    private function resetSequence(string $table): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("select setval(pg_get_serial_sequence('{$table}', 'id'), coalesce((select max(id) from {$table}), 0) + 1, false)");
        }
    }
};
