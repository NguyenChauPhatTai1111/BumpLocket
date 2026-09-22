<?php

return ['paths' => ['api/*', 'broadcasting/auth'], 'allowed_methods' => ['*'], 'allowed_origins' => explode(',', env('FRONTEND_ORIGINS', 'http://localhost:5173')), 'allowed_origins_patterns' => [], 'allowed_headers' => ['*'], 'exposed_headers' => [], 'max_age' => 0, 'supports_credentials' => false];
