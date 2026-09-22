<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class LocationUpdated implements ShouldBroadcast
{
    use Dispatchable;

    public bool $afterCommit = true;

    // Only invalidate client state: coordinates never enter queue payloads.
    public function __construct(public int $bumpId, public int $userId, public string $status = 'updated') {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'LocationUpdated';
    }

    public function broadcastWith(): array
    {
        return ['id' => $this->bumpId, 'status' => $this->status];
    }
}
