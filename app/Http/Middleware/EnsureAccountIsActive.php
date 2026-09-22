<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user()?->fresh();
        if ($user?->banned_at) {
            $user->tokens()->delete();

            return response()->json(['message' => 'Tài khoản đã bị quản trị viên khóa.'], 403);
        }

        return $next($request);
    }
}
