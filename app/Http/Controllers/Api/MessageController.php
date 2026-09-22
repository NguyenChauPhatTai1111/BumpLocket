<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DirectMessage;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function conversations(Request $request)
    {
        $me = $request->user()->id;

        return User::whereIn('id', Friendship::friendIds($me))->get(['id', 'name', 'avatar_path', 'avatar_updated_at', 'last_seen_at'])->map(function (User $friend) use ($me) {
            $latest = DirectMessage::where(fn ($q) => $q->where('from_user_id', $me)->where('to_user_id', $friend->id))
                ->orWhere(fn ($q) => $q->where('from_user_id', $friend->id)->where('to_user_id', $me))->latest()->first();

            return [
                'friend' => $this->friendResource($friend),
                'latest_message' => $latest?->only(['id', 'from_user_id', 'body', 'created_at']),
                'unread_count' => DirectMessage::where('from_user_id', $friend->id)->where('to_user_id', $me)->whereNull('read_at')->count(),
            ];
        })->sortByDesc(fn ($item) => $item['latest_message']['created_at'] ?? '')->values();
    }

    public function index(Request $request, User $user)
    {
        $me = $request->user()->id;
        abort_unless(Friendship::accepted($me, $user->id), 403, 'Chỉ có thể nhắn tin với bạn bè.');
        DirectMessage::where('from_user_id', $user->id)->where('to_user_id', $me)->whereNull('read_at')->update(['read_at' => now()]);

        return DirectMessage::where(fn ($q) => $q->where('from_user_id', $me)->where('to_user_id', $user->id))
            ->orWhere(fn ($q) => $q->where('from_user_id', $user->id)->where('to_user_id', $me))
            ->latest()->limit(100)->get()->reverse()->values();
    }

    public function store(Request $request, User $user)
    {
        $me = $request->user()->id;
        abort_unless(Friendship::accepted($me, $user->id), 403, 'Chỉ có thể nhắn tin với bạn bè.');
        $data = $request->validate(['body' => 'required|string|max:2000']);
        $body = trim($data['body']);
        abort_if($body === '', 422, 'Tin nhắn không được để trống.');

        return response()->json(DirectMessage::create(['from_user_id' => $me, 'to_user_id' => $user->id, 'body' => $body]), 201);
    }

    private function friendResource(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'has_avatar' => (bool) $user->avatar_path, 'avatar_updated_at' => $user->avatar_updated_at, 'is_online' => $user->last_seen_at?->greaterThan(now()->subSeconds(60)) ?? false];
    }
}
