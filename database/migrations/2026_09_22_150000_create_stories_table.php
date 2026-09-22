<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('image_path')->nullable();
            $table->string('caption', 500)->nullable();
            $table->string('background_color', 20)->default('#31472b');
            $table->string('music_id')->nullable();
            $table->string('music_name')->nullable();
            $table->string('music_artist')->nullable();
            $table->text('music_audio_url')->nullable();
            $table->text('music_share_url')->nullable();
            $table->string('music_license_url')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->index(['user_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stories');
    }
};
