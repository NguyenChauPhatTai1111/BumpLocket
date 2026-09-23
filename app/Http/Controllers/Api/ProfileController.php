<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        return $this->resource($user);
    }

    public function update(Request $request)
    {
        $data = $request->validate(['name' => 'required|string|max:80', 'avatar' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:8192|dimensions:max_width=8192,max_height=8192']);
        $user = $request->user();
        $user->name = $data['name'];
        if ($request->hasFile('avatar')) {
            $path = $this->storeAvatar($request->file('avatar'));
            $old = $user->avatar_path;
            $user->avatar_path = $path;
            $user->avatar_updated_at = now();
            $user->save();
            if ($old) {
                Storage::disk('local')->delete($old);
            }
        } else {
            $user->save();
        }

        return $this->resource($user->refresh());
    }

    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string', 'max:128'],
            'password' => ['required', 'string', 'min:10', 'max:128', 'confirmed', 'different:current_password'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mật khẩu hiện tại không chính xác.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();

        return response()->json(['message' => 'Đổi mật khẩu thành công.']);
    }

    public function avatar(Request $request, User $user)
    {
        abort_unless($request->user()->is($user) || Friendship::accepted($request->user()->id, $user->id), 403);
        abort_unless($user->avatar_path && Storage::disk('local')->exists($user->avatar_path), 404);

        return response()->file(Storage::disk('local')->path($user->avatar_path), ['Cache-Control' => 'private, max-age=300', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function resource(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone, 'is_admin' => $user->is_admin, 'has_avatar' => (bool) $user->avatar_path, 'avatar_updated_at' => $user->avatar_updated_at];
    }

    private function storeAvatar($file): string
    {
        $image = imagecreatefromstring(file_get_contents($file->getRealPath()));
        abort_unless($image, 422, 'Không đọc được ảnh đại diện.');
        $width = imagesx($image);
        $height = imagesy($image);
        $side = min($width, $height);
        $canvas = imagecreatetruecolor(512, 512);
        imagecopyresampled($canvas, $image, 0, 0, (int) (($width - $side) / 2), (int) (($height - $side) / 2), 512, 512, $side, $side);
        ob_start();
        imagejpeg($canvas, null, 88);
        $bytes = ob_get_clean();
        imagedestroy($canvas);
        imagedestroy($image);
        $path = 'avatars/'.Str::uuid().'.jpg';
        abort_unless(Storage::disk('local')->put($path, $bytes), 500, 'Không lưu được ảnh đại diện.');

        return $path;
    }
}
