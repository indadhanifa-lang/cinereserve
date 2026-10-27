<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;

class ReelWorldBranchSeeder extends Seeder
{
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Organization
        |--------------------------------------------------------------------------
        */

        $organization = Organization::updateOrCreate(
            [
                'slug' => 'reel-world-movie-cafe',
            ],
            [
                'name' => 'Reel World Movie Cafe',
                'email' => 'reelworldcdo@gmail.com',
                'phone' => '09279354667',
                'status' => 'active',
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Branch
        |--------------------------------------------------------------------------
        */

        $branch = Branch::updateOrCreate(
            [
                'slug' => 'reel-world-movie-cafe-grand-central',
            ],
            [
                'organization_id' => $organization->id,

                'name' => 'Reel World Movie Cafe',

                'address' => 'Grand Central Building, Hayes St, Barangay 4, Cagayan De Oro City, 9000 Misamis Oriental, Philippines',

                'city' => 'Cagayan De Oro City',
                'province' => 'Misamis Oriental',

                'phone' => '09279354667',
                'email' => 'reelworldcdo@gmail.com',

                'latitude' => 8.4762001,
                'longitude' => 124.6444302,

                'logo_url' => null,

                'primary_color' => '#7C3AED',
                'secondary_color' => '#A78BFA',

                'status' => 'active',
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Assign Admin to Branch
        |--------------------------------------------------------------------------
        |
        | Replace this email with your actual Reel World admin email.
        |
        */

        User::where('email', 'reelworld@gmail.com')
            ->where('role', 'admin')
            ->update([
                'branch_id' => $branch->id,
            ]);
    }
}
