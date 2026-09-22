<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable();
            $table->timestamp('avatar_updated_at')->nullable();
        });
        Schema::table('moments', fn (Blueprint $table) => $table->string('image_path')->nullable()->change());
        Schema::create('direct_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['from_user_id', 'to_user_id', 'created_at']);
            $table->index(['to_user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('direct_messages');
        Schema::table('moments', fn (Blueprint $table) => $table->string('image_path')->nullable(false)->change());
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['avatar_path', 'avatar_updated_at']));
    }
};
