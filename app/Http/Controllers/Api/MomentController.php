<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\Moment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MomentController extends Controller
{
    private function access(Request $r, Moment $m): void
    {
        abort_unless($m->user_id === $r->user()->id || Friendship::accepted($m->user_id, $r->user()->id), 403);
    }

    public function index(Request $r)
    {
        $r->validate(['mine' => 'nullable|boolean']);
        $query = Moment::with('user:id,name,avatar_path,avatar_updated_at')->withCount(['likes', 'comments'])->withExists(['likes as liked' => fn ($q) => $q->where('user_id', $r->user()->id)]);
        $query->when($r->boolean('mine'), fn ($q) => $q->where('user_id', $r->user()->id), fn ($q) => $q->whereIn('user_id', Friendship::friendIds($r->user()->id)->push($r->user()->id)));

        return $query->latest()->paginate(20)->through(function (Moment $moment) {
            $data = $moment->toArray();
            $data['has_image'] = (bool) $moment->image_path;
            $data['user']['has_avatar'] = (bool) $moment->user->avatar_path;

            return $data;
        });
    }

    public function store(Request $r)
    {
        $v = $r->validate(['image' => 'nullable|required_without:caption|image|mimes:jpg,jpeg,png,webp|max:8192|dimensions:max_width=8192,max_height=8192', 'caption' => 'nullable|required_without:image|string|max:500']);
        $path = null;
        if ($r->hasFile('image')) {
            $path = $this->storeImage($r->file('image'));
        }
        try {
            $m = Moment::create(['user_id' => $r->user()->id, 'image_path' => $path, 'caption' => $v['caption'] ?? null]);
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $e;
        }

        return response()->json($m, 201);
    }

    private function storeImage($file): string
    {
        [$width, $height] = getimagesize($file->getRealPath());
        abort_if($width * $height > 20000000, 422, 'Ảnh tối đa 20 megapixel. Hãy chọn ảnh nhỏ hơn.');
        $image = imagecreatefromstring(file_get_contents($file->getRealPath()));
        abort_unless($image, 422, 'Không đọc được ảnh.');
        if ($file->getMimeType() === 'image/jpeg' && function_exists('exif_read_data')) {
            $orientation = (@exif_read_data($file->getRealPath()) ?: [])['Orientation'] ?? 1;
            if (in_array($orientation, [3, 6, 8])) {
                $rotated = imagerotate($image, [3 => 180, 6 => -90, 8 => 90][$orientation], 0);
                imagedestroy($image);
                $image = $rotated;
            }
        }
        // Re-encode pixels: discard EXIF GPS and camera metadata before sharing.
        $width = imagesx($image);
        $height = imagesy($image);
        $ratio = min(1, 2048 / max($width, $height));
        $canvas = imagecreatetruecolor((int) ($width * $ratio), (int) ($height * $ratio));
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, imagesx($canvas), imagesy($canvas), $width, $height);
        ob_start();
        imagejpeg($canvas, null, 88);
        $bytes = ob_get_clean();
        imagedestroy($canvas);
        imagedestroy($image);
        $path = 'moments/'.Str::uuid().'.jpg';
        abort_unless(Storage::disk('local')->put($path, $bytes), 500, 'Không lưu được ảnh.');

        return $path;
    }

    public function image(Request $r, Moment $moment)
    {
        $this->access($r, $moment);
        abort_unless($moment->image_path, 404);

        return response()->file(Storage::disk('local')->path($moment->image_path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function destroy(Request $r, Moment $moment)
    {
        abort_unless($moment->user_id === $r->user()->id, 403);
        if ($moment->image_path) {
            Storage::disk('local')->delete($moment->image_path);
        }
        $moment->delete();

        return response()->noContent();
    }

    public function like(Request $r, Moment $moment)
    {
        $this->access($r, $moment);
        $moment->likes()->firstOrCreate(['user_id' => $r->user()->id]);

        return response()->noContent();
    }

    public function unlike(Request $r, Moment $moment)
    {
        $this->access($r, $moment);
        $moment->likes()->where('user_id', $r->user()->id)->delete();

        return response()->noContent();
    }

    public function comments(Request $r, Moment $moment)
    {
        $this->access($r, $moment);

        return $moment->comments()->with('user:id,name')->latest()->paginate(30);
    }

    public function comment(Request $r, Moment $moment)
    {
        $this->access($r, $moment);
        $v = $r->validate(['body' => 'required|string|max:500']);

        return response()->json($moment->comments()->create($v + ['user_id' => $r->user()->id])->load('user:id,name'), 201);
    }
}
