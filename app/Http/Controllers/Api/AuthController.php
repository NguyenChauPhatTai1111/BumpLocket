<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BumpRequest;
use App\Models\User;
use App\Services\BumpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        if (preg_match('/[\r\n]/', (string) $r->input('email', ''))) {
            throw ValidationException::withMessages(['email' => 'Email không hợp lệ.']);
        }
        $v = $r->validate(['name' => 'required|string|max:80', 'email' => 'nullable|required_without:phone|email|max:190|unique:users', 'phone' => 'nullable|required_without:email|regex:/^\\+?[0-9]{9,15}$/|unique:users', 'password' => 'required|string|min:10|max:128|confirmed']);
        $u = User::create($v);

        return response()->json(['user' => $u->publicProfile(), 'token' => $u->createToken('web', ['*'], now()->addDays(7))->plainTextToken], 201);
    }

    public function login(Request $r)
    {
        $v = $r->validate(['login' => 'required|string|max:190', 'password' => 'required|string|max:128']);
        $u = User::where(filter_var($v['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'phone', $v['login'])->first();
        if (! $u || ! Hash::check($v['password'], $u->password)) {
            throw ValidationException::withMessages(['login' => 'Thông tin đăng nhập chưa đúng.']);
        }

        if ($u->banned_at) {
            throw ValidationException::withMessages(['login' => 'Tài khoản đã bị quản trị viên khóa.']);
        }

        return ['user' => $u->publicProfile(), 'token' => $u->createToken('web', ['*'], now()->addDays(7))->plainTextToken];
    }

    public function logout(Request $r, BumpService $service)
    {
        $id = $r->user()->id;
        BumpRequest::whereIn('status', ['pending', 'accepted'])->where(fn ($q) => $q->where('from_user_id', $id)->orWhere('to_user_id', $id))->each(fn ($b) => $service->end($b, $id));
        $r->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }
}
