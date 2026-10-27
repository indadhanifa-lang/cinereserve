<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Genre;
use App\Models\Movie;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MovieController extends Controller
{
    private const MOVIE_FIELDS = [
        'id', 'title', 'slug', 'description', 'poster_url', 'trailer_url',
        'duration_minutes', 'release_date', 'language', 'age_rating', 'status',
    ];

    private const RULES = [
        'title' => ['required', 'string', 'max:200'],
        'description' => ['nullable', 'string'],
        'duration_minutes' => ['required', 'integer', 'min:1'],
        'release_date' => ['nullable', 'date'],
        'language' => ['nullable', 'string', 'max:50'],
        'age_rating' => ['nullable', 'string', 'max:20'],
        'status' => ['nullable', 'in:active,inactive'],
        'poster' => ['nullable', 'image', 'max:8192'],
        'genres' => ['nullable', 'string'],
    ];

    /**
     * Only the authenticated admin's own branch movies are returned;
     * branch_id never comes from the client.
     */
    public function index(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $movies = Movie::where('branch_id', $branchId)
            ->with('genres:id,name')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Movie $movie) => $movie->only(self::MOVIE_FIELDS) + [
                'genres' => $movie->genres->pluck('name'),
            ]);

        return response()->json(['movies' => $movies]);
    }

    public function store(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate(self::RULES);

        $movie = new Movie;
        $movie->fill([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'duration_minutes' => $data['duration_minutes'],
            'release_date' => $data['release_date'] ?? null,
            'language' => $data['language'] ?? null,
            'age_rating' => $data['age_rating'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
        $movie->branch_id = $branchId;
        $movie->slug = $this->uniqueSlug($data['title']);

        $this->storePoster($request, $movie);
        $movie->save();

        if (! empty($data['genres'])) {
            $this->syncGenres($movie, $data['genres']);
        }

        return response()->json([
            'movie' => $movie->only(self::MOVIE_FIELDS) + ['genres' => $movie->genres->pluck('name')],
        ], 201);
    }

    /**
     * Sent as multipart POST (PHP does not parse multipart PUT bodies).
     * The slug is kept stable; the poster is replaced only when a new
     * file is uploaded; an empty `genres` value clears all genres.
     */
    public function update(Request $request, string $id)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate(self::RULES);

        $movie = Movie::where('id', $id)
            ->where('branch_id', $branchId)
            ->first();

        if (! $movie) {
            return response()->json(['message' => 'Movie not found.'], 404);
        }

        $movie->fill([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'duration_minutes' => $data['duration_minutes'],
            'release_date' => $data['release_date'] ?? null,
            'language' => $data['language'] ?? null,
            'age_rating' => $data['age_rating'] ?? null,
            'status' => $data['status'] ?? $movie->status,
        ]);

        $this->storePoster($request, $movie);
        $movie->save();
        $this->syncGenres($movie, $data['genres'] ?? '');

        return response()->json([
            'movie' => $movie->only(self::MOVIE_FIELDS) + ['genres' => $movie->genres()->pluck('name')],
        ]);
    }

    /** Quick active/inactive toggle from the catalog list. */
    public function updateStatus(Request $request, string $id)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate([
            'status' => ['required', 'in:active,inactive'],
        ]);

        $movie = Movie::where('id', $id)
            ->where('branch_id', $branchId)
            ->first();

        if (! $movie) {
            return response()->json(['message' => 'Movie not found.'], 404);
        }

        $movie->update(['status' => $data['status']]);

        return response()->json(['movie' => ['id' => $movie->id, 'status' => $movie->status]]);
    }

    // ponytail: replaced posters stay on disk; delete the old file if storage use matters.
    private function storePoster(Request $request, Movie $movie): void
    {
        if (! $request->hasFile('poster')) {
            return;
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        $path = $request->file('poster')->storeAs('posters', Str::uuid().'.'.$request->file('poster')->extension(), 'public');
        $movie->poster_url = $disk->url($path);
    }

    /** "Sci-Fi, Adventure" → genre ids (created on demand), synced to the movie. */
    private function syncGenres(Movie $movie, string $genres): void
    {
        $genreIds = collect(explode(',', $genres))
            ->map(fn ($name) => trim($name))
            ->filter()
            ->unique()
            ->map(fn ($name) => Genre::firstOrCreate(['name' => $name])->id);

        $movie->genres()->sync($genreIds);
    }

    /**
     * Str::slug(title) with a short random suffix on collision retry, so a
     * duplicate title never surfaces a raw unique-constraint 500 to the admin.
     */
    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'movie';
        $slug = $base;

        while (Movie::where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(5));
        }

        return $slug;
    }

    /**
     * Branch ownership comes from the authenticated admin only; any
     * branch_id sent by the client is ignored.
     *
     * @return int|JsonResponse
     */
    private function ownBranchId(Request $request)
    {
        $branchId = $request->user()->branch_id;

        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        return $branchId;
    }
}
