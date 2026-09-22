<?php

namespace Tests\Feature;

use App\Models\BumpRequest;
use App\Models\Friendship;
use App\Models\User;
use App\Services\BumpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BumpLocketTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bob;

    private User $outsider;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Storage::fake('local');
        [$this->alice,$this->bob,$this->outsider] = User::factory()->count(3)->create()->all();
        Friendship::create(['user_id' => $this->alice->id, 'friend_id' => $this->bob->id, 'pair_key' => Friendship::key($this->alice->id, $this->bob->id), 'status' => 'accepted']);
        Sanctum::actingAs($this->alice);
    }

    private function requestBump(): int
    {
        return $this->postJson('/api/bumps', ['to_user_id' => $this->bob->id, 'duration_minutes' => 15, 'consent' => true])->assertCreated()->json('id');
    }

    private function accept(int $id): void
    {
        Sanctum::actingAs($this->bob);
        $this->patchJson("/api/bumps/$id", ['action' => 'accept', 'consent' => true])->assertOk();
    }

    public function test_requires_mutual_consent_and_friendship(): void
    {
        $this->postJson('/api/bumps', ['to_user_id' => $this->outsider->id, 'duration_minutes' => 15, 'consent' => true])->assertForbidden();
        $this->postJson('/api/bumps', ['to_user_id' => $this->bob->id, 'duration_minutes' => 15])->assertUnprocessable();
        $id = $this->requestBump();
        $this->putJson("/api/bumps/$id/location", ['lat' => 10, 'lng' => 106, 'accuracy' => 5])->assertGone();
        $this->patchJson("/api/bumps/$id", ['action' => 'accept', 'consent' => true])->assertForbidden();
        Sanctum::actingAs($this->bob);
        $this->patchJson("/api/bumps/$id", ['action' => 'accept'])->assertUnprocessable();
    }

    public function test_locations_are_private_expiring_and_deleted_on_stop(): void
    {
        $id = $this->requestBump();
        $this->accept($id);
        $this->putJson("/api/bumps/$id/location", ['lat' => 10.77, 'lng' => 106.7, 'accuracy' => 5])->assertNoContent();
        Sanctum::actingAs($this->outsider);
        $this->getJson("/api/bumps/$id/locations")->assertForbidden();
        Sanctum::actingAs($this->alice);
        $this->getJson("/api/bumps/$id/locations")->assertOk()->assertJsonCount(1, 'positions');
        $this->deleteJson("/api/bumps/$id")->assertNoContent();
        $this->getJson("/api/bumps/$id/locations")->assertGone();
        $this->putJson("/api/bumps/$id/location", ['lat' => 10, 'lng' => 106, 'accuracy' => 5])->assertGone();
        $s = app(BumpService::class);
        $this->assertNull($s->cache()->get($s->key(BumpRequest::find($id), $this->bob->id)));
        $this->assertDatabaseHas('location_access_logs', ['bump_request_id' => $id, 'action' => 'viewed', 'actor_id' => $this->alice->id]);
    }

    public function test_expired_invitation_cannot_be_accepted(): void
    {
        $id = $this->requestBump();
        $this->travel(3)->minutes();
        Sanctum::actingAs($this->bob);
        $this->patchJson("/api/bumps/$id", ['action' => 'accept', 'consent' => true])->assertConflict();
    }

    public function test_recipient_can_reject_without_location_consent(): void
    {
        $id = $this->requestBump();
        Sanctum::actingAs($this->bob);
        $this->patchJson("/api/bumps/$id", ['action' => 'reject'])->assertNoContent();
        $this->assertDatabaseHas('bump_requests', ['id' => $id, 'status' => 'rejected']);
    }

    public function test_active_session_expires_and_cleanup_runs(): void
    {
        $id = $this->requestBump();
        $this->accept($id);
        $this->putJson("/api/bumps/$id/location", ['lat' => 10, 'lng' => 106, 'accuracy' => 5])->assertNoContent();
        $this->travel(16)->minutes();
        $this->getJson("/api/bumps/$id/locations")->assertGone();
        $this->artisan('bumps:expire')->assertSuccessful();
        $this->assertDatabaseHas('bump_requests', ['id' => $id, 'status' => 'expired']);
    }

    public function test_repeated_request_and_accept_are_rejected(): void
    {
        $id = $this->requestBump();
        $this->postJson('/api/bumps', ['to_user_id' => $this->bob->id, 'duration_minutes' => 15, 'consent' => true])->assertConflict();
        $this->accept($id);
        $this->patchJson("/api/bumps/$id", ['action' => 'accept', 'consent' => true])->assertConflict();
    }

    public function test_blocking_terminates_session_and_prevents_new_bumps(): void
    {
        $id = $this->requestBump();
        $this->accept($id);
        $f = Friendship::first();
        $this->patchJson("/api/friends/$f->id", ['action' => 'block'])->assertNoContent();
        $this->getJson("/api/bumps/$id/locations")->assertGone();
        $this->postJson('/api/bumps', ['to_user_id' => $this->alice->id, 'duration_minutes' => 15, 'consent' => true])->assertForbidden();
    }

    public function test_photo_upload_and_access_are_restricted_to_friends(): void
    {
        $id = $this->postJson('/api/moments', ['image' => UploadedFile::fake()->image('moment.jpg'), 'caption' => 'Hello'])->assertCreated()->json('id');
        Sanctum::actingAs($this->bob);
        $this->get("/api/moments/$id/image")->assertOk();
        $this->putJson("/api/moments/$id/like")->assertNoContent();
        $this->putJson("/api/moments/$id/like")->assertNoContent();
        $this->assertDatabaseCount('moment_likes', 1);
        $this->postJson("/api/moments/$id/comments", ['body' => 'Nice'])->assertCreated();
        Sanctum::actingAs($this->outsider);
        $this->getJson("/api/moments/$id/image")->assertForbidden();
        $this->getJson('/api/moments')->assertJsonCount(0, 'data');
        $this->deleteJson("/api/moments/$id")->assertForbidden();
    }

    public function test_private_channels_and_invalid_gps_are_denied(): void
    {
        $this->postJson('/api/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-user.'.$this->bob->id])->assertForbidden();
        $id = $this->requestBump();
        $this->accept($id);
        $this->putJson("/api/bumps/$id/location", ['lat' => 200, 'lng' => 106, 'accuracy' => 5])->assertUnprocessable();
    }

    public function test_push_rejects_arbitrary_internal_endpoints(): void
    {
        $this->postJson('/api/push/subscriptions', ['endpoint' => 'https://127.0.0.1/internal', 'keys' => ['p256dh' => 'x', 'auth' => 'y']])->assertUnprocessable();
    }

    public function test_register_accepts_email_or_phone_but_never_privileged_fields(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Test email', 'email' => 'new@example.test', 'password' => 'long-password-123', 'password_confirmation' => 'long-password-123', 'role' => 'admin'])
            ->assertCreated()->assertJsonStructure(['token', 'user' => ['id', 'name']])->assertJsonMissingPath('user.email');
        $this->postJson('/api/auth/register', ['name' => 'Test phone', 'phone' => '+84901234567', 'password' => 'long-password-123', 'password_confirmation' => 'long-password-123'])
            ->assertCreated();
        $this->postJson('/api/auth/login', ['login' => '+84901234567', 'password' => 'long-password-123'])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/auth/login', ['login' => '+84901234567', 'password' => 'wrong'])->assertUnprocessable();
    }

    public function test_logout_stops_active_location_sessions(): void
    {
        $id = $this->requestBump();
        $this->accept($id);
        $this->postJson('/api/auth/logout')->assertNoContent();
        $this->assertDatabaseHas('bump_requests', ['id' => $id, 'status' => 'stopped']);
    }

    public function test_friends_can_see_presence_but_pending_users_cannot(): void
    {
        Sanctum::actingAs($this->bob);
        $this->postJson('/api/presence/online')->assertNoContent();
        Sanctum::actingAs($this->alice);
        $this->getJson('/api/friends')->assertOk()->assertJsonPath('0.recipient.is_online', true)->assertJsonStructure(['0' => ['recipient' => ['last_seen_at']]]);

        Friendship::create(['user_id' => $this->alice->id, 'friend_id' => $this->outsider->id, 'pair_key' => Friendship::key($this->alice->id, $this->outsider->id), 'status' => 'pending']);
        $pending = collect($this->getJson('/api/friends')->assertOk()->json())->firstWhere('status', 'pending');
        $this->assertArrayNotHasKey('last_seen_at', $pending['sender']);
        $this->assertArrayNotHasKey('last_seen_at', $pending['recipient']);

        Sanctum::actingAs($this->bob);
        $this->postJson('/api/presence/offline')->assertNoContent();
        Sanctum::actingAs($this->alice);
        $accepted = collect($this->getJson('/api/friends')->assertOk()->json())->firstWhere('status', 'accepted');
        $this->assertFalse($accepted['recipient']['is_online']);
    }
}
