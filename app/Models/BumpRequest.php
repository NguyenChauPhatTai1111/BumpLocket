<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BumpRequest extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'accepted_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function includes(int $id): bool
    {
        return in_array($id, [$this->from_user_id, $this->to_user_id], true);
    }

    public function active(): bool
    {
        return $this->status === 'accepted' && $this->expires_at->isFuture();
    }
}
