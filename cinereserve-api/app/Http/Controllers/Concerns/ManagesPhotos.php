<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Gallery uploads for models with a JSON `photos` column of public URLs
 * (establishments and rooms). Files live on the public disk under $folder.
 */
trait ManagesPhotos
{
    private const MAX_PHOTOS = 10;

    private function addPhoto(Request $request, Model $model, string $folder): ?JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:4096'],
        ]);

        $photos = $model->photos ?? [];
        if (count($photos) >= self::MAX_PHOTOS) {
            return response()->json(['message' => 'You can upload up to '.self::MAX_PHOTOS.' photos.'], 422);
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        $file = $request->file('photo');
        $path = $file->storeAs($folder, Str::uuid().'.'.$file->extension(), 'public');

        $photos[] = $disk->url($path);
        $model->photos = $photos;
        $model->save();

        return null;
    }

    private function removePhoto(Request $request, Model $model, string $folder): ?JsonResponse
    {
        $url = (string) $request->validate([
            'url' => ['required', 'string'],
        ])['url'];

        $photos = $model->photos ?? [];
        if (! in_array($url, $photos, true)) {
            return response()->json(['message' => 'Photo not found.'], 404);
        }

        // Only the model's own listed URL is ever deleted, never a client path.
        if (str_contains($url, '/storage/'.$folder.'/')) {
            Storage::disk('public')->delete($folder.'/'.basename($url));
        }

        $model->photos = array_values(array_diff($photos, [$url]));
        $model->save();

        return null;
    }
}
