<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'phone', 'password', 'is_admin', 'banned_at'];

    protected $hidden = ['password', 'remember_token', 'email', 'phone', 'last_seen_at', 'avatar_path'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'email_verified_at' => 'datetime', 'is_admin' => 'boolean', 'banned_at' => 'datetime', 'last_seen_at' => 'datetime', 'avatar_updated_at' => 'datetime'];
    }

    public function publicProfile(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'is_admin' => $this->is_admin, 'has_avatar' => (bool) $this->avatar_path, 'avatar_updated_at' => $this->avatar_updated_at];
    }
}
