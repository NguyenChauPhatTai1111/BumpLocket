<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate(['search' => 'nullable|string|max:100', 'page' => 'nullable|integer|min:1']);
        $search = $validated['search'] ?? null;

        return User::query()
            ->when($search, fn ($query) => $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")))
            ->latest()->paginate(15)->through(fn (User $user) => $this->resource($user));
    }

    public function store(Request $request)
    {
        $user = User::create($request->validate($this->rules()));

        return response()->json($this->resource($user), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate($this->rules($user));
        if ($user->is($request->user()) && array_key_exists('is_admin', $data) && ! $data['is_admin']) {
            throw ValidationException::withMessages(['is_admin' => 'Bạn không thể tự bỏ quyền quản trị của mình.']);
        }
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }
        $user->update($data);

        return $this->resource($user->refresh());
    }

    public function ban(Request $request, User $user)
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'Bạn không thể tự khóa tài khoản của mình.']);
        }
        $user->update(['banned_at' => $user->banned_at ? null : now()]);
        if ($user->banned_at) {
            $user->tokens()->delete();
        }

        return $this->resource($user->refresh());
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'Bạn không thể tự xóa tài khoản của mình.']);
        }
        $user->delete();

        return response()->noContent();
    }

    private function rules(?User $user = null): array
    {
        return [
            'name' => 'required|string|max:80',
            'email' => ['nullable', 'required_without:phone', 'email', 'max:190', Rule::unique('users')->ignore($user)],
            'phone' => ['nullable', 'required_without:email', 'regex:/^\+?[0-9]{9,15}$/', Rule::unique('users')->ignore($user)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:10', 'max:128'],
            'is_admin' => 'sometimes|boolean',
        ];
    }

    private function resource(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_admin' => $user->is_admin,
            'is_banned' => (bool) $user->banned_at,
            'created_at' => $user->created_at,
        ];
    }
}
