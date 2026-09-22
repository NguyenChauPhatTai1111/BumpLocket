<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUsersTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admin_can_manage_users_and_ban_revokes_access(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $member = User::factory()->create();

        $this->actingAs($member)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/admin/users')->assertOk()->assertJsonPath('total', 2);
        $this->actingAs($admin)->patchJson("/api/admin/users/{$member->id}/ban")->assertOk()->assertJsonPath('is_banned', true);
        $this->actingAs($member)->getJson('/api/me')->assertForbidden();
    }

    public function test_admin_cannot_ban_delete_or_demote_self(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}/ban")->assertUnprocessable();
        $this->actingAs($admin)->deleteJson("/api/admin/users/{$admin->id}")->assertUnprocessable();
        $this->actingAs($admin)->putJson("/api/admin/users/{$admin->id}", [
            'name' => $admin->name,
            'email' => $admin->email,
            'phone' => null,
            'password' => '',
            'is_admin' => false,
        ])->assertUnprocessable();
    }
}
