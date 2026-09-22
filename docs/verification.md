# Verification — 2026-09-22

- PHP: Laravel Framework 11.56.1; migrated a new MySQL 8.4 database named bumplocket.
- PHPUnit: 14 tests, 76 assertions passed (13 feature tests + scaffold unit test).
- Feature tests cover email/phone authentication, mutual consent, non-friend/outsider denial,
  duplicate requests, sender cannot accept own request, rejection without consent, session expiry,
  immediate stop/block/logout, private photos, idempotent likes, invalid GPS, private channels, SSRF guard.
- Vite production build passed. Mapbox is code-split; its vendor chunk still triggers Vite's size warning.
- Browser test passed with desktop Edge + mobile viewport: login, friend invitation/accept,
  Bump approval, simulated GPS on both sides, stop, upload, like, comment, download,
  no page exceptions and no mobile horizontal overflow.
- Reverb integration test passed: authenticated private subscription and delivery of a queued event.
  A connection without an allowed Origin was rejected.
- Redis checked: RDB save empty, appendonly=no. Queue has no failed jobs.
- All browser accounts/photos created by the tests were removed by test teardown.
- API requests without authentication return JSON 401 even without an Accept header.

Not verified: push delivery to physical iPhone/Android, actual GPS sensors/background behavior,
or Mapbox rendering with a production token. A public WSS reverse proxy is not configured;
the deployed frontend uses 5-second foreground polling until supplied.

Composer audit reports Laravel 11 framework advisories; details in README.
No claim of production security clearance or guaranteed background delivery is made.

Old source backup:
C:/Users/nguye/AppData/Local/Temp/hythiep-before-bumplocket-20260922-111941.zip

Old generated assets and root node_modules:
C:/Users/nguye/AppData/Local/Temp/hythiep-assets-retired-20260922-114514/

The original MySQL thiepcuoisonline database was preserved. BumpLocket uses bumplocket.
