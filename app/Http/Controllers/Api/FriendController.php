<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BumpRequest;
use App\Models\Friendship;
use App\Models\User;
use App\Services\BumpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FriendController extends Controller
{
    public function index(Request $r)
    {
        $id = $r->user()->id;

        return Friendship::with(['sender:id,name,last_seen_at,avatar_path,avatar_updated_at', 'recipient:id,name,last_seen_at,avatar_path,avatar_updated_at'])
            ->where(fn ($q) => $q->where('user_id', $id)->orWhere('friend_id', $id))
            ->latest()->get()->map(function (Friendship $friendship) {
                $data = $friendship->toArray();
                if ($friendship->status === 'accepted') {
                    foreach (['sender', 'recipient'] as $relation) {
                        $user = $friendship->{$relation};
                        $data[$relation]['last_seen_at'] = $user->last_seen_at;
                        $data[$relation]['is_online'] = $user->last_seen_at?->greaterThan(now()->subSeconds(60)) ?? false;
                        $data[$relation]['has_avatar'] = (bool) $user->avatar_path;
                    }
                }

                return $data;
            });
    }

    public function store(Request $r)
    {
        $v = $r->validate(['contact' => 'required|string|max:190']);
        $me = $r->user()->id;
        $friend = User::where(filter_var($v['contact'], FILTER_VALIDATE_EMAIL) ? 'email' : 'phone', $v['contact'])->first();
        abort_unless($friend && $friend->id !== $me, 422, 'Không tìm thấy tài khoản phù hợp.');
        $f = Friendship::firstOrCreate(['pair_key' => Friendship::key($me, $friend->id)], ['user_id' => $me, 'friend_id' => $friend->id, 'status' => 'pending']);
        abort_if($f->status === 'blocked', 403, 'Không thể gửi lời mời.');

        return response()->json($f, 201);
    }

    public function update(Request $r, Friendship $friendship, BumpService $service)
    {
        $action = $r->validate(['action' => 'required|in:accept,reject,block,remove'])['action'];
        $id = $r->user()->id;

        return DB::transaction(function () use ($friendship, $action, $id, $service) {
            $f = Friendship::whereKey($friendship->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($id, [$f->user_id, $f->friend_id]), 403);
            if (in_array($action, ['accept', 'reject'])) {
                abort_unless($f->friend_id === $id && $f->status === 'pending', 409);
            }
            if ($action === 'accept') {
                $f->update(['status' => 'accepted']);
            } else {
                foreach (BumpRequest::whereIn('status', ['pending', 'accepted'])->where(fn ($q) => $q->where('from_user_id', $f->user_id)->where('to_user_id', $f->friend_id))->orWhere(fn ($q) => $q->whereIn('status', ['pending', 'accepted'])->where('from_user_id', $f->friend_id)->where('to_user_id', $f->user_id))->get() as $b) {
                    $service->end($b, $id, 'stopped');
                }
                if ($action === 'block') {
                    $f->update(['status' => 'blocked', 'blocked_by' => $id]);
                } elseif ($f->status !== 'blocked') {
                    $f->delete();
                } else {
                    abort(409, 'Quan hệ đã bị chặn.');
                }
            }

            return response()->noContent();
        });
    }
}
