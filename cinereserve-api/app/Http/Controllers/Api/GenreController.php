<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Genre;
use Illuminate\Http\Request;

class GenreController extends Controller
{
    public function index()
    {
        return response()->json([
            'genres' => Genre::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:genres,name'],
        ]);

        $genre = Genre::create(['name' => $data['name']]);

        return response()->json(['genre' => $genre->only(['id', 'name'])], 201);
    }
}
