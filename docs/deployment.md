# Deployment

Backend and frontend are independently deployable. Standard production:
- Laravel document root points to `public/`; API requests route to public/index.php.
- Static hosting serves `public/app/` (from frontend build) with SPA fallback.
- Set VITE_API_URL to the actual API, FRONTEND_ORIGINS to exact origins.
- Keep .env, storage/app/private, source, SQL dumps and backups outside public reach.

Current Laragon .htaccess supports the existing /thiepcuoisonline/ path, blocks source
and routes static assets to public/app. The old wedding public/build and public/templates
were moved to a temporary archive outside the web root. Old MySQL wedding DB is retained.

## Redis and Reverb

Use a dedicated non-persistent Redis instance for GPS:
`redis-server --bind 127.0.0.1 --save "" --appendonly no`.
Do not expose Redis to the Internet. Prefixes are applied by Laravel's cache driver.

Backend .env REVERB_HOST/PORT/SCHEME point to an internal Reverb server.
Frontend VITE_REVERB_HOST/PORT/SCHEME point to a browser-accessible TLS host, e.g.
ws.example.com:443/https. Shared key must match.
REVERB_ALLOWED_ORIGINS is a comma-separated list of allowed browser hostnames.
Proxy both /app (WebSocket upgrade) and /apps (Pusher API if external) correctly.
Do not set frontend localhost on a public deployment: that means the visitor's own device.
Until a public WSS endpoint is configured, foreground REST polling remains available.

Run queue:work continuously and schedule:run every minute (or schedule:work locally).
Restart workers when application code/config changes: php artisan queue:restart.
Use Supervisor/systemd or Windows service tooling for durable process management.
The supplied PowerShell script is a local development helper only.

## Mapbox / Web Push

Put a restricted public pk.* Mapbox token in frontend/.env VITE_MAPBOX_TOKEN and rebuild.
Restrict allowed URLs to production domain and local dev domain. Never use a secret token.
Coordinates are necessarily sent to the map provider while maps are rendered.

Run php artisan push:keys, put keys in backend .env, and restart workers.
On Windows ensure OPENSSL_CONF references a valid openssl.cnf for VAPID crypto;
the local launcher sets Laragon's path.
Serve sw.js over HTTPS within the app scope and do not apply SPA fallback to it.
Subscription endpoint hosts are restricted to browser push providers to prevent SSRF.
Push jobs check that requests remain pending and unexpired before sending.
Notification clicks open the app; they never grant location consent automatically.

Test real devices: browser notification permission, PWA install on iOS, user audio
interaction, hidden-tab notification, accepted/rejected/expired Bump, denied GPS,
stop from either device, connection loss, device sleep, and stale tab resume.

## Known framework advisory

Laravel 11 was explicitly requested. Composer audit currently flags Laravel framework
advisories noted in README. Upgrade before public launch; do not describe this build as
security-cleared production software. This is separate from the application consent tests.
