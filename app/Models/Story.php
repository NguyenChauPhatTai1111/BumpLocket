<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    protected $guarded = [];

    protected $hidden = ['image_path'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reactions()
    {
        return $this->hasMany(StoryReaction::class);
    }
}
