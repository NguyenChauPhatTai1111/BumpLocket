<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Moment extends Model
{
    protected $guarded = [];

    protected $hidden = ['image_path'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function likes()
    {
        return $this->hasMany(MomentLike::class);
    }

    public function comments()
    {
        return $this->hasMany(MomentComment::class);
    }
}
