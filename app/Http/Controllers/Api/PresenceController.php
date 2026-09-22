<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    public function online(Request $request)
    {
        $request->user()->forceFill(['last_seen_at' => now()])->saveQuietly();

        return response()->noContent();
    }

    public function offline(Request $request)
    {
        $request->user()->forceFill(['last_seen_at' => null])->saveQuietly();

        return response()->noContent();
    }
}
