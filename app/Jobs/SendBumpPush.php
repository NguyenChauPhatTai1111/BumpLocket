<?php

namespace App\Jobs;

use App\Models\BumpRequest;
use App\Models\PushSubscription;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class SendBumpPush implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(public int $bumpId) {}

    public function handle(): void
    {
        $b = BumpRequest::with('sender')->find($this->bumpId);
        if (! $b || $b->status !== 'pending' || $b->expires_at->isPast() || ! config('bumplocket.vapid_private')) {
            return;
        }
        $push = new WebPush(['VAPID' => ['subject' => config('bumplocket.vapid_subject'), 'publicKey' => config('bumplocket.vapid_public'), 'privateKey' => config('bumplocket.vapid_private')]]);
        foreach (PushSubscription::where('user_id', $b->to_user_id)->get() as $sub) {
            $payload = json_encode(['title' => 'Bạn nhận được một Bump', 'body' => $b->sender->name.' muốn chia sẻ vị trí với bạn. Mở để đồng ý hoặc từ chối.', 'bumpId' => $b->id, 'url' => rtrim(config('bumplocket.frontend_url'), '/').'/', 'tag' => 'bump-'.$b->id]);
            $report = $push->sendOneNotification(Subscription::create(['endpoint' => $sub->endpoint, 'publicKey' => $sub->public_key, 'authToken' => $sub->auth_token]), $payload, ['TTL' => max(0, now()->diffInSeconds($b->expires_at))]);
            if ($report->isSubscriptionExpired()) {
                $sub->delete();
            }
        }
    }
}
