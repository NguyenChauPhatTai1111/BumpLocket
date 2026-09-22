<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PushSubscription extends Model
{
    protected $guarded = [];

    protected $hidden = ['endpoint', 'auth_token', 'public_key'];
}
