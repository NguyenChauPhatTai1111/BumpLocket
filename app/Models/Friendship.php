<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Friendship extends Model
{
    protected $guarded = [];

    public function sender()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'friend_id');
    }

    public static function key(int $a, int $b): string
    {
        return min($a, $b).':'.max($a, $b);
    }

    public static function accepted(int $a, int $b): bool
    {
        return static::where('pair_key', static::key($a, $b))->where('status', 'accepted')->exists();
    }

    public static function friendIds(int $id)
    {
        return static::where('status', 'accepted')->where(fn ($q) => $q->where('user_id', $id)->orWhere('friend_id', $id))->get()->map(fn ($f) => $f->user_id === $id ? $f->friend_id : $f->user_id);
    }
}
