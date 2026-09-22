<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StoriesTest extends TestCase
{
    use RefreshDatabase;

    public function test_story_is_private_to_friends_and_disappears_after_24_hours(): void
    {
        Storage::fake('local');
        [$alice, $bob, $outsider] = User::factory()->count(3)->create()->all();
        Friendship::create(['user_id' => $alice->id, 'friend_id' => $bob->id, 'pair_key' => Friendship::key($alice->id, $bob->id), 'status' => 'accepted']);
        Sanctum::actingAs($alice);
        $id = $this->postJson('/api/stories', ['caption' => 'Tin 24 giờ', 'image' => UploadedFile::fake()->image('story.jpg')])->assertCreated()->json('id');

        Sanctum::actingAs($bob);
        $this->getJson('/api/stories')->assertOk()->assertJsonPath('0.caption', 'Tin 24 giờ');
        $this->get("/api/stories/{$id}/image")->assertOk();
        Sanctum::actingAs($outsider);
        $this->get("/api/stories/{$id}/image")->assertForbidden();
        $this->travel(24)->hours();
        $this->travel(1)->second();
        Sanctum::actingAs($bob);
        $this->getJson('/api/stories')->assertJsonCount(0);
        $this->get("/api/stories/{$id}/image")->assertGone();
        Sanctum::actingAs($alice);
        $this->getJson('/api/stories/archive')->assertOk()->assertJsonPath('data.0.is_expired', true);
        $this->get("/api/stories/{$id}/image")->assertOk();
    }

    public function test_music_search_is_normalized_and_untrusted_music_url_is_rejected(): void
    {
        config(['services.jamendo.client_id' => 'test']);
        Http::fake(['api.jamendo.com/*' => Http::response(['results' => [[
            'id' => '12', 'name' => 'Morning', 'artist_name' => 'Artist', 'audio' => 'https://prod-1.storage.jamendo.com/audio.mp3', 'shareurl' => 'https://www.jamendo.com/track/12', 'license_ccurl' => 'https://creativecommons.org/licenses/by/4.0/', 'album_image' => 'https://usercontent.jamendo.com/image.jpg',
        ]]])]);
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/music/search?q=morning')->assertOk()->assertJsonPath('0.artist', 'Artist');
        $this->postJson('/api/stories', ['caption' => 'Bad source', 'music_id' => '1', 'music_name' => 'Bad', 'music_artist' => 'Bad', 'music_audio_url' => 'https://evil.example/audio.mp3', 'music_share_url' => 'https://www.jamendo.com/track/1'])->assertUnprocessable();
        $this->assertDatabaseCount((new Story)->getTable(), 0);
    }

    public function test_friend_can_react_to_story_and_toggle_reaction(): void
    {
        [$alice, $bob] = User::factory()->count(2)->create()->all();
        Friendship::create(['user_id' => $alice->id, 'friend_id' => $bob->id, 'pair_key' => Friendship::key($alice->id, $bob->id), 'status' => 'accepted']);
        Sanctum::actingAs($alice);
        $story = $this->postJson('/api/stories', ['caption' => 'Hello'])->assertCreated()->json('id');
        Sanctum::actingAs($bob);
        $this->putJson("/api/stories/{$story}/reaction", ['reaction' => 'haha'])->assertOk();
        $this->getJson('/api/stories')->assertJsonPath('0.reaction_counts.haha', 1)->assertJsonPath('0.my_reaction', 'haha');
        $this->deleteJson("/api/stories/{$story}/reaction")->assertNoContent();
        $this->getJson('/api/stories')->assertJsonMissingPath('0.reaction_counts.haha')->assertJsonPath('0.my_reaction', null);
    }
}
