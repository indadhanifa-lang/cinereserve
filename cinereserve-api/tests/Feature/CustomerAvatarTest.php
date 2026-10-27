<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CustomerAvatarTest extends TestCase
{
    use RefreshDatabase;

    /** 1x1 transparent PNG. */
    private const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    /** 1x1 transparent GIF. */
    private const GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    public function test_unauthenticated_avatar_upload_returns_401(): void
    {
        $this->postJson('/api/customer/avatar')->assertUnauthorized();
    }

    public function test_customer_can_upload_avatar(): void
    {
        Storage::fake('public');
        $customer = $this->createCustomer();

        $response = $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [
            'avatar' => $this->makeUpload(base64_decode(self::PNG_BASE64), 'avatar.png', 'image/png'),
        ], ['Accept' => 'application/json']);

        $response->assertOk();
        $response->assertJsonStructure([
            'user' => ['id', 'name', 'email', 'phone', 'avatar_url', 'role'],
        ]);

        $avatarUrl = $response->json('user.avatar_url');
        $this->assertMatchesRegularExpression('#^/storage/avatars/[0-9a-f-]+\.png$#', $avatarUrl);
        Storage::disk('public')->assertExists('avatars/'.basename($avatarUrl));
        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'avatar_url' => $avatarUrl,
        ]);
    }

    public function test_upload_replaces_and_deletes_previous_avatar(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('avatars/old-avatar.webp', 'old-bytes');

        $customer = $this->createCustomer();
        $customer->avatar_url = '/storage/avatars/old-avatar.webp';
        $customer->save();

        $response = $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [
            'avatar' => $this->makeUpload(base64_decode(self::PNG_BASE64), 'avatar.png', 'image/png'),
        ], ['Accept' => 'application/json']);

        $response->assertOk();
        Storage::disk('public')->assertMissing('avatars/old-avatar.webp');
        Storage::disk('public')->assertExists('avatars/'.basename($response->json('user.avatar_url')));
    }

    public function test_previous_file_outside_avatars_directory_is_never_deleted(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('posters/keep-me.jpg', 'poster-bytes');

        $customer = $this->createCustomer();
        $customer->avatar_url = '/storage/posters/keep-me.jpg';
        $customer->save();

        $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [
            'avatar' => $this->makeUpload(base64_decode(self::PNG_BASE64), 'avatar.png', 'image/png'),
        ], ['Accept' => 'application/json'])->assertOk();

        Storage::disk('public')->assertExists('posters/keep-me.jpg');
    }

    public function test_upload_only_updates_the_authenticated_customer_even_with_user_id_input(): void
    {
        Storage::fake('public');
        $customer = $this->createCustomer();
        $otherCustomer = $this->createCustomer();

        $response = $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [
            'avatar' => $this->makeUpload(base64_decode(self::PNG_BASE64), 'avatar.png', 'image/png'),
            'user_id' => $otherCustomer->id,
        ], ['Accept' => 'application/json']);

        $response->assertOk();
        $response->assertJsonPath('user.id', $customer->id);
        $this->assertNull($otherCustomer->refresh()->avatar_url);
    }

    public function test_upload_without_avatar_returns_422(): void
    {
        $customer = $this->createCustomer();

        $response = $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [], [
            'Accept' => 'application/json',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('avatar');
    }

    #[DataProvider('invalidAvatarProvider')]
    public function test_invalid_avatar_returns_422(string $contents, string $filename, string $mimeType): void
    {
        Storage::fake('public');
        $customer = $this->createCustomer();

        $response = $this->actingAs($customer, 'sanctum')->post('/api/customer/avatar', [
            'avatar' => $this->makeUpload($contents, $filename, $mimeType),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('avatar');
        $this->assertNull($customer->refresh()->avatar_url);
    }

    public static function invalidAvatarProvider(): array
    {
        return [
            'non-image content' => ['plain text bytes', 'avatar.jpg', 'text/plain'],
            'disallowed gif format' => [base64_decode(self::GIF_BASE64), 'avatar.gif', 'image/gif'],
            'larger than 5 MB' => [
                base64_decode(self::PNG_BASE64).str_repeat('A', 5 * 1024 * 1024),
                'avatar.png',
                'image/png',
            ],
        ];
    }

    public function test_me_returns_avatar_url(): void
    {
        $customer = $this->createCustomer();
        $customer->avatar_url = '/storage/avatars/existing.png';
        $customer->save();

        $this->actingAs($customer, 'sanctum')->getJson('/api/customer/me')
            ->assertOk()
            ->assertJsonPath('user.avatar_url', '/storage/avatars/existing.png');
    }

    public function test_me_returns_null_avatar_url_when_never_uploaded(): void
    {
        $customer = $this->createCustomer();

        $this->actingAs($customer, 'sanctum')->getJson('/api/customer/me')
            ->assertOk()
            ->assertJsonPath('user.avatar_url', null);
    }

    private function createCustomer(): User
    {
        return User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
        ]);
    }

    private function makeUpload(string $contents, string $filename, string $mimeType): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'cin');
        file_put_contents($path, $contents);

        return new UploadedFile($path, $filename, $mimeType, null, true);
    }
}
