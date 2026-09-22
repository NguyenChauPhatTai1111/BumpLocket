<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('email')->nullable()->change();
            $t->string('phone', 25)->nullable()->unique();
        });
        Schema::create('friendships', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('friend_id')->constrained('users')->cascadeOnDelete();
            $t->string('pair_key')->unique();
            $t->string('status')->default('pending')->index();
            $t->foreignId('blocked_by')->nullable()->constrained('users');
            $t->timestamps();
        });
        Schema::create('moments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('image_path');
            $t->string('caption', 500)->nullable();
            $t->timestamps();
        });
        Schema::create('moment_likes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('moment_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unique(['moment_id', 'user_id']);
            $t->timestamps();
        });
        Schema::create('moment_comments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('moment_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('body', 500);
            $t->timestamps();
        });
        Schema::create('bump_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $t->string('status')->default('pending');
            $t->unsignedTinyInteger('duration_minutes')->default(15);
            $t->timestamp('expires_at')->index();
            $t->timestamp('accepted_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->timestamps();
            $t->index(['to_user_id', 'status']);
        });
        Schema::create('location_access_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('bump_request_id')->constrained()->cascadeOnDelete();
            $t->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $t->string('action', 40);
            $t->timestamp('created_at')->useCurrent();
        });
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->text('endpoint');
            $t->string('endpoint_hash', 64)->unique();
            $t->text('public_key');
            $t->text('auth_token');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['push_subscriptions', 'location_access_logs', 'bump_requests', 'moment_comments', 'moment_likes', 'moments', 'friendships'] as $table) {
            Schema::dropIfExists($table);
        } Schema::table('users', fn (Blueprint $t) => $t->dropColumn('phone'));
    }
};
