<?php

namespace App\Services;

use App\Events\LocationUpdated;
use App\Models\BumpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BumpService
{
    public function cache()
    {
        return Cache::store(config('bumplocket.location_store'));
    }

    public function key(BumpRequest $b, int $id): string
    {
        return 'bump:'.$b->id.':'.$id;
    }

    public function audit(BumpRequest $b, int $actor, string $action): void
    {
        DB::table('location_access_logs')->insert(['bump_request_id' => $b->id, 'actor_id' => $actor, 'action' => $action, 'created_at' => now()]);
    }

    public function end(BumpRequest $b, int $actor, string $status = 'stopped'): void
    {
        DB::transaction(function () use ($b, $actor, $status) {
            $b = BumpRequest::whereKey($b->id)->lockForUpdate()->firstOrFail();
            if (! in_array($b->status, ['pending', 'accepted'])) {
                return;
            }
            $b->update(['status' => $status, 'ended_at' => now()]);
            foreach ([$b->from_user_id, $b->to_user_id] as $id) {
                $this->cache()->forget($this->key($b, $id));
                LocationUpdated::dispatch($b->id, $id, $status);
            }
            $this->audit($b, $actor, $status);
        });
    }

    public function expire(BumpRequest $b): void
    {
        if ($b->expires_at->isPast() && in_array($b->status, ['pending', 'accepted'])) {
            $this->end($b,$b->from_user_id,'expired');
        }
    }
}
