<?php

namespace App\Events;

use App\Models\BumpRequest;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class BumpRequested implements ShouldBroadcast
{
    use Dispatchable;

    public bool $afterCommit = true;

    public function __construct(public int $bumpId, public int $userId) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'BumpRequested';
    }

    public function broadcastWith(): array
    {
        return ['id' => $this->bumpId];
    }

    public function broadcastWhen(): bool
    {
        return BumpRequest::whereKey($this->bumpId)->whereIn('status', ['pending', 'accepted'])->where('expires_at', '>', now())->exists();
    }
}
