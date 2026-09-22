<?php

use App\Models\BumpRequest;
use App\Services\BumpService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Minishlink\WebPush\VAPID;

Artisan::command('bumps:expire', function () {
    BumpRequest::whereIn('status', ['pending', 'accepted'])->where('expires_at', '<=', now())->each(fn ($b) => app(BumpService::class)->expire($b));
});
Schedule::command('bumps:expire')->everyMinute()->withoutOverlapping();
Schedule::call(fn () => DB::table('location_access_logs')->where('created_at', '<', now()->subDays(30))->delete())->daily();
Artisan::command('push:keys', function () {
    $keys = VAPID::createVapidKeys();
    $this->line('VAPID_PUBLIC_KEY='.$keys['publicKey']);
    $this->line('VAPID_PRIVATE_KEY='.$keys['privateKey']);
})->purpose('Generate VAPID keys; store privately in .env.');
