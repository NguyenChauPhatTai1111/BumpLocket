<?php

return [
    'location_store' => env('LOCATION_CACHE_STORE', 'redis'),
    'vapid_public' => env('VAPID_PUBLIC_KEY'),
    'vapid_private' => env('VAPID_PRIVATE_KEY'),
    'vapid_subject' => env('VAPID_SUBJECT', 'mailto:admin@example.com'),
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
];
