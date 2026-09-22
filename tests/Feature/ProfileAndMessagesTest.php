<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileAndMessagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_avatar_and_text_posts_work(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $profile = $this->postJson('/api/profile', ['name' => 'Tên mới', 'avatar' => UploadedFile::fake()->image('avatar.jpg', 800, 600)])
            ->assertOk()->assertJsonPath('name', 'Tên mới')->assertJsonPath('has_avatar', true)->json();
        $this->get("/api/users/{$user->id}/avatar")->assertOk();
        $this->postJson('/api/moments', ['caption' => 'Bài chỉ có nội dung'])->assertCreated();
        $this->getJson('/api/moments?mine=1')->assertOk()->assertJsonPath('data.0.has_image', false)->assertJsonPath('data.0.caption', 'Bài chỉ có nội dung');
        $this->assertNotNull($profile['avatar_updated_at']);
    }

    public function test_only_accepted_friends_can_message_each_other(): void
    {
        [$alice, $bob, $stranger] = User::factory()->count(3)->create()->all();
        Friendship::create(['user_id' => $alice->id, 'friend_id' => $bob->id, 'pair_key' => Friendship::key($alice->id, $bob->id), 'status' => 'accepted']);
        Sanctum::actingAs($alice);

        $this->postJson("/api/messages/{$bob->id}", ['body' => 'Chào bạn'])->assertCreated();
        $this->postJson("/api/messages/{$stranger->id}", ['body' => 'Không hợp lệ'])->assertForbidden();
        Sanctum::actingAs($bob);
        $this->getJson("/api/messages/{$alice->id}")->assertOk()->assertJsonPath('0.body', 'Chào bạn');
        $this->getJson('/api/messages')->assertOk()->assertJsonPath('0.unread_count', 0);
    }
}
