<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Auth\Notifications\ResetPassword;
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

    public function test_user_can_change_password_with_the_current_password(): void
    {
        $user = User::factory()->create(['password' => 'old-password-123']);
        Sanctum::actingAs($user);

        $this->putJson('/api/profile/password', [
            'current_password' => 'old-password-123',
            'password' => 'new-password-456',
            'password_confirmation' => 'new-password-456',
        ])->assertOk()->assertJsonPath('message', 'Đổi mật khẩu thành công.');

        $this->assertTrue(Hash::check('new-password-456', $user->fresh()->password));
    }

    public function test_user_cannot_change_password_with_an_incorrect_current_password(): void
    {
        $user = User::factory()->create(['password' => 'old-password-123']);
        Sanctum::actingAs($user);

        $this->putJson('/api/profile/password', [
            'current_password' => 'wrong-password',
            'password' => 'new-password-456',
            'password_confirmation' => 'new-password-456',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('old-password-123', $user->fresh()->password));
    }

    public function test_user_can_request_and_complete_a_password_reset(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'reset@example.test', 'password' => 'old-password-123']);
        $user->createToken('old-session');

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonStructure(['message']);

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-password-456',
            'password_confirmation' => 'new-password-456',
        ])->assertOk()->assertJsonPath('message', 'Đặt lại mật khẩu thành công.');

        $this->assertTrue(Hash::check('new-password-456', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_forgot_password_does_not_reveal_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'unknown@example.test'])
            ->assertOk()
            ->assertJsonStructure(['message']);
    }
}
