<?php

use App\Events\LocationUpdated;
use App\Models\BumpRequest;
use App\Models\Friendship;
use App\Models\Moment;
use App\Models\User;
use App\Services\BumpService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Storage;

// CLI-only fixtures for browser tests. Never a public HTTP endpoint.
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (($argv[1] ?? '') === 'create') {
    $nonce = bin2hex(random_bytes(5));
    $password = bin2hex(random_bytes(12));
    $a = User::create(['name' => 'An · Browser test', 'email' => "browser-$nonce-a@example.test", 'password' => $password]);
    $b = User::create(['name' => 'Bình · Browser test', 'email' => "browser-$nonce-b@example.test", 'password' => $password]);
    echo json_encode(['a' => ['id' => $a->id, 'email' => $a->email, 'name' => $a->name], 'b' => ['id' => $b->id, 'email' => $b->email, 'name' => $b->name], 'password' => $password]);
} elseif (($argv[1] ?? '') === 'broadcast') {
    $user = User::whereKey((int) ($argv[2] ?? 0))->where('email', 'like', 'browser-%@example.test')->firstOrFail();
    LocationUpdated::dispatch(0, $user->id, 'test');
    echo 'Queued test event.';
} elseif (($argv[1] ?? '') === 'cleanup') {
    $ids = array_map('intval', array_slice($argv, 2));
    $users = User::whereIn('id', $ids)->where('email', 'like', 'browser-%@example.test')->get();
    foreach ($users as $user) {
        foreach (BumpRequest::where('from_user_id', $user->id)->orWhere('to_user_id', $user->id)->get() as $b) {
            app(BumpService::class)->end($b, $user->id);
        }
        foreach (Moment::where('user_id', $user->id)->get() as $m) {
            Storage::disk('local')->delete($m->image_path);
        }
        Friendship::where('user_id', $user->id)->orWhere('friend_id', $user->id)->delete();
        $user->tokens()->delete();
        $user->delete();
    }
    echo 'Browser fixtures removed.';
}
