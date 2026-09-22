<?php

namespace App\Http\Controllers\Api;

use App\Events\BumpRequested;
use App\Events\LocationUpdated;
use App\Http\Controllers\Controller;
use App\Jobs\SendBumpPush;
use App\Models\BumpRequest;
use App\Models\Friendship;
use App\Services\BumpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BumpController extends Controller
{
    public function index(Request $r, BumpService $s)
    {
        $id = $r->user()->id;
        $items = BumpRequest::with(['sender:id,name', 'recipient:id,name'])->where(fn ($q) => $q->where('from_user_id', $id)->orWhere('to_user_id', $id))->whereIn('status', ['pending', 'accepted'])->get();
        foreach ($items as $b) {
            $s->expire($b);
        }

        return $items->filter(fn ($b) => $b->fresh()->expires_at->isFuture())->values();
    }

    public function store(Request $r, BumpService $s)
    {
        $v = $r->validate(['to_user_id' => 'required|integer|exists:users,id', 'duration_minutes' => 'required|integer|in:15,30', 'consent' => 'required|accepted']);
        $me = $r->user()->id;

        return DB::transaction(function () use ($v, $me, $s) {
            $friend = Friendship::where('pair_key', Friendship::key($me, $v['to_user_id']))->lockForUpdate()->first();
            abort_unless($friend && $friend->status === 'accepted', 403, 'Chỉ được Bump với bạn bè đã chấp nhận.');
            $existing = BumpRequest::whereIn('status', ['pending', 'accepted'])->where('expires_at', '>', now())->whereIn('from_user_id', [$me, $v['to_user_id']])->whereIn('to_user_id', [$me, $v['to_user_id']])->exists();
            abort_if($existing, 409, 'Hai bạn đang có một phiên hoặc lời mời Bump.');
            $b = BumpRequest::create(['from_user_id' => $me, 'to_user_id' => $v['to_user_id'], 'duration_minutes' => $v['duration_minutes'], 'expires_at' => now()->addMinutes(2)]);
            $s->audit($b, $me, 'requested_with_consent');
            BumpRequested::dispatch($b->id, $b->to_user_id);
            SendBumpPush::dispatch($b->id)->afterCommit();

            return response()->json($b, 201);
        });
    }

    public function respond(Request $r, BumpRequest $bump, BumpService $s)
    {
        $v = $r->validate(['action' => 'required|in:accept,reject', 'consent' => 'exclude_unless:action,accept|required|accepted']);

        return DB::transaction(function () use ($r, $bump, $s, $v) {
            $b = BumpRequest::whereKey($bump->id)->lockForUpdate()->firstOrFail();
            abort_unless($b->to_user_id === $r->user()->id, 403);
            abort_unless($b->status === 'pending' && $b->expires_at->isFuture(), 409, 'Lời mời đã hết hạn hoặc đã xử lý.');
            abort_unless(Friendship::accepted($b->from_user_id, $b->to_user_id), 403);
            if ($v['action'] === 'reject') {
                $s->end($b, $r->user()->id, 'rejected');

                return response()->noContent();
            }
            $b->update(['status' => 'accepted', 'accepted_at' => now(), 'expires_at' => now()->addMinutes($b->duration_minutes)]);
            $s->audit($b, $r->user()->id, 'accepted_with_consent');
            foreach ([$b->from_user_id, $b->to_user_id] as $id) {
                BumpRequested::dispatch($b->id, $id);
            }

            return $b;
        });
    }

    public function stop(Request $r, BumpRequest $bump, BumpService $s)
    {
        abort_unless($bump->includes($r->user()->id), 403);
        $s->end($bump, $r->user()->id);

        return response()->noContent();
    }

    public function locate(Request $r, BumpRequest $bump, BumpService $s)
    {
        $v = $r->validate(['lat' => 'required|numeric|between:-90,90', 'lng' => 'required|numeric|between:-180,180', 'accuracy' => 'required|numeric|min:0|max:100000']);

        return DB::transaction(function () use ($r, $bump, $s, $v) {
            $b = BumpRequest::whereKey($bump->id)->lockForUpdate()->firstOrFail();
            abort_unless($b->includes($r->user()->id), 403);
            abort_unless($b->active() && Friendship::accepted($b->from_user_id, $b->to_user_id), 410, 'Phiên chia sẻ đã kết thúc.');
            $s->cache()->put($s->key($b, $r->user()->id), $v + ['user_id' => $r->user()->id, 'updated_at' => now()->toIso8601String()], $b->expires_at);
            foreach ([$b->from_user_id, $b->to_user_id] as $id) {
                LocationUpdated::dispatch($b->id, $id);
            }

            return response()->noContent();
        });
    }

    public function locations(Request $r, BumpRequest $bump, BumpService $s)
    {
        return DB::transaction(function () use ($r, $bump, $s) {
            $b = BumpRequest::whereKey($bump->id)->lockForUpdate()->firstOrFail();
            abort_unless($b->includes($r->user()->id), 403);
            abort_unless($b->active() && Friendship::accepted($b->from_user_id, $b->to_user_id), 410);
            $s->audit($b, $r->user()->id, 'viewed');

            return response()->json(['expires_at' => $b->expires_at, 'positions' => collect([$b->from_user_id, $b->to_user_id])->map(fn ($id) => $s->cache()->get($s->key($b,$id)))->filter()->values()])->header('Cache-Control','no-store');
        });
    }
}
