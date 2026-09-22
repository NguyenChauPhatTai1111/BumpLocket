<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DirectMessage extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }
}
