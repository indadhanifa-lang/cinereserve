<?php

namespace Database\Seeders;

use App\Models\Genre;
use Illuminate\Database\Seeder;

class GenreSeeder extends Seeder
{
    /**
     * Kept in sync with the COMMON_GENRES pill list in
     * cinereserve-admin/app/dashboard/movies/new/page.tsx.
     */
    private const GENRES = [
        'Action',
        'Adventure',
        'Animation',
        'Biography',
        'Comedy',
        'Crime',
        'Documentary',
        'Drama',
        'Family',
        'Fantasy',
        'History',
        'Horror',
        'Musical',
        'Mystery',
        'Romance',
        'Sci-Fi',
        'Sport',
        'Thriller',
        'War',
        'Western',
    ];

    public function run(): void
    {
        foreach (self::GENRES as $name) {
            Genre::firstOrCreate(['name' => $name]);
        }
    }
}
