<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\Request;

class PushController extends Controller
{
    public function store(Request $r)
    {
        $v = $r->validate(['endpoint' => 'required|url:https|max:2000', 'keys.p256dh' => 'required|string|max:200', 'keys.auth' => 'required|string|max:100']);
        // Allow only browser push services; never send HTTP requests to arbitrary client URLs.
        $host = parse_url($v['endpoint'], PHP_URL_HOST);
        abort_unless(in_array(parse_url($v['endpoint'], PHP_URL_PORT), [null, 443], true) && ! parse_url($v['endpoint'], PHP_URL_USER), 422);
        abort_unless($host === 'fcm.googleapis.com' || $host === 'updates.push.services.mozilla.com' || str_ends_with($host, '.push.services.mozilla.com') || $host === 'web.push.apple.com' || str_ends_with($host, '.notify.windows.com'), 422, 'Push endpoint không được hỗ trợ.');
        PushSubscription::updateOrCreate(['endpoint_hash' => hash('sha256', $v['endpoint'])], ['user_id' => $r->user()->id, 'endpoint' => $v['endpoint'], 'public_key' => $v['keys']['p256dh'], 'auth_token' => $v['keys']['auth']]);

        return response()->noContent();
    }

    public function destroy(Request $r)
    {
        $v = $r->validate(['endpoint' => 'required|string']);
        PushSubscription::where('user_id', $r->user()->id)->where('endpoint_hash', hash('sha256', $v['endpoint']))->delete();

        return response()->noContent();
    }
}
