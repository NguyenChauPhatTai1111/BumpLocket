<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\Story;
use App\Models\StoryReaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StoryController extends Controller
{
    public function index(Request $request)
    {
        return Story::with('user:id,name,avatar_path,avatar_updated_at')
            ->whereIn('user_id', Friendship::friendIds($request->user()->id)->push($request->user()->id))
            ->where('expires_at', '>', now())->latest()->get()->map(fn (Story $story) => $this->payload($story, $request));
    }

    public function archive(Request $request)
    {
        return Story::with('user:id,name,avatar_path,avatar_updated_at')->where('user_id', $request->user()->id)->latest()->paginate(20)->through(fn (Story $story) => $this->payload($story, $request));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'image' => 'nullable|required_without:caption|image|mimes:jpg,jpeg,png,webp|max:8192|dimensions:max_width=8192,max_height=8192',
            'caption' => 'nullable|required_without:image|string|max:500',
            'background_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'music_id' => 'nullable|string|max:40',
            'music_name' => 'nullable|required_with:music_id|string|max:190',
            'music_artist' => 'nullable|required_with:music_id|string|max:190',
            'music_audio_url' => 'nullable|required_with:music_id|url:https|max:2000',
            'music_share_url' => 'nullable|required_with:music_id|url:https|max:2000',
            'music_license_url' => 'nullable|url:http,https|max:500',
        ]);
        foreach (['music_audio_url', 'music_share_url', 'music_license_url'] as $field) {
            if (! empty($data[$field])) {
                $host = strtolower(parse_url($data[$field], PHP_URL_HOST) ?: '');
                abort_unless($host === 'youtube.com' || $host === 'www.youtube.com' || $host === 'youtu.be' || $host === 'music.youtube.com' || ($field === 'music_license_url' && $host === 'creativecommons.org'), 422, 'Chỉ hỗ trợ liên kết YouTube hợp lệ.');
            }
        }
        $path = $request->hasFile('image') ? $this->storeImage($request->file('image')) : null;
        try {
            $story = Story::create([
                'user_id' => $request->user()->id,
                'image_path' => $path,
                'caption' => $data['caption'] ?? null,
                'background_color' => $data['background_color'] ?? '#31472b',
                'music_id' => $data['music_id'] ?? null,
                'music_name' => $data['music_name'] ?? null,
                'music_artist' => $data['music_artist'] ?? null,
                'music_audio_url' => $data['music_audio_url'] ?? null,
                'music_share_url' => $data['music_share_url'] ?? null,
                'music_license_url' => $data['music_license_url'] ?? null,
                'expires_at' => now()->addDay(),
            ]);
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $e;
        }

        return response()->json($story, 201);
    }

    public function image(Request $request, Story $story)
    {
        abort_unless($story->expires_at->isFuture() || $story->user_id === $request->user()->id, 410);
        abort_unless($story->user_id === $request->user()->id || Friendship::accepted($story->user_id, $request->user()->id), 403);
        abort_unless($story->image_path, 404);

        return response()->file(Storage::disk('local')->path($story->image_path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function destroy(Request $request, Story $story)
    {
        abort_unless($story->user_id === $request->user()->id, 403);
        if ($story->image_path) {
            Storage::disk('local')->delete($story->image_path);
        }
        $story->delete();

        return response()->noContent();
    }

    public function react(Request $request, Story $story)
    {
        abort_unless($story->expires_at->isFuture(), 410);
        abort_unless($story->user_id === $request->user()->id || Friendship::accepted($story->user_id, $request->user()->id), 403);
        $reaction = $request->validate(['reaction' => 'required|in:like,haha,angry,care'])['reaction'];
        StoryReaction::updateOrCreate(['story_id' => $story->id, 'user_id' => $request->user()->id], ['reaction' => $reaction]);

        return response()->json(['reaction' => $reaction]);
    }

    public function unreact(Request $request, Story $story)
    {
        abort_unless($story->expires_at->isFuture(), 410);
        abort_unless($story->user_id === $request->user()->id || Friendship::accepted($story->user_id, $request->user()->id), 403);
        StoryReaction::where('story_id', $story->id)->where('user_id', $request->user()->id)->delete();

        return response()->noContent();
    }

    private function storeImage($file): string
    {
        $image = imagecreatefromstring(file_get_contents($file->getRealPath()));
        abort_unless($image, 422, 'Không đọc được ảnh tin.');
        $width = imagesx($image);
        $height = imagesy($image);
        abort_if($width * $height > 20000000, 422, 'Ảnh tối đa 20 megapixel.');
        $ratio = min(1, 1920 / max($width, $height));
        $canvas = imagecreatetruecolor((int) ($width * $ratio), (int) ($height * $ratio));
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 20, 20, 20));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, imagesx($canvas), imagesy($canvas), $width, $height);
        ob_start();
        imagejpeg($canvas, null, 88);
        $bytes = ob_get_clean();
        imagedestroy($canvas);
        imagedestroy($image);
        $path = 'stories/'.Str::uuid().'.jpg';
        abort_unless(Storage::disk('local')->put($path, $bytes), 500, 'Không lưu được ảnh tin.');

        return $path;
    }

    private function payload(Story $story, Request $request): array
    {
        $data = $story->toArray();
        $data['has_image'] = (bool) $story->image_path;
        $data['is_expired'] = $story->expires_at->isPast();
        $data['user']['has_avatar'] = (bool) $story->user->avatar_path;
        $data['reaction_counts'] = $story->reactions()->selectRaw('reaction, COUNT(*) as total')->groupBy('reaction')->pluck('total', 'reaction');
        $data['my_reaction'] = $story->reactions()->where('user_id', $request->user()->id)->value('reaction');

        return $data;
    }
}
