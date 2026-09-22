# REST API

Prefix `/api`; JSON responses; bearer Sanctum token for protected endpoints.
Laragon subfolder frontend uses `/thiepcuoisonline/public/api`.
Errors: 401 unauthenticated, 403 unauthorized, 409 stale/duplicate action,
410 expired/inactive location session, 422 validation, 429 throttled.

| Method | Route | Body / effect |
| --- | --- | --- |
| GET | /config | Public VAPID key only |
| POST | /auth/register | name, email OR phone, password (10+), password_confirmation |
| POST | /auth/login | login (email/phone), password; returns user and 7-day token |
| POST | /auth/logout | Revoke current token |
| GET | /me | id, name |
| GET | /friends | Incoming/outgoing pending, accepted and blocked relations |
| POST | /friends | contact: exact registered email/phone |
| PATCH | /friends/{id} | action: accept / reject / remove / block |
| GET | /moments?page=1 | Own and accepted friends' moments, counts, liked flag |
| POST | /moments | multipart image (JPEG/PNG/WebP <=8 MB), caption <=500 |
| GET | /moments/{id}/image | Authenticated private image; Cache-Control no-store |
| DELETE | /moments/{id} | Owner only; remove file and associated data |
| PUT / DELETE | /moments/{id}/like | Idempotent like/unlike |
| GET | /moments/{id}/comments | Paginated comments, authorized viewers only |
| POST | /moments/{id}/comments | body <=500 |
| GET | /bumps | Current pending/accepted sessions for caller |
| POST | /bumps | to_user_id, duration_minutes 15/30, consent:true |
| PATCH | /bumps/{id} | action: accept/reject; consent:true required on accept |
| DELETE | /bumps/{id} | Either participant stops/cancels; remove both positions |
| PUT | /bumps/{id}/location | lat -90..90, lng -180..180, accuracy >=0 |
| GET | /bumps/{id}/locations | Session positions and expires_at; audit access, no-store |
| POST | /push/subscriptions | endpoint, keys.p256dh, keys.auth from PushManager |
| DELETE | /push/subscriptions | endpoint; only own subscription |
| POST | /broadcasting/auth | socket_id, channel_name; only private-user.{own id} |

No `location_shares` database table is needed: `bump:{request}:{user}` Redis keys
hold lat/lng/accuracy/user_id/updated_at until expires_at. Coordinates never enter SQL.

Database tables: users, personal_access_tokens, friendships, moments, moment_likes,
moment_comments, bump_requests, location_access_logs, push_subscriptions,
plus Laravel cache/jobs/failed_jobs/session support tables.

Reverb channels:
- Echo `private('user.' + id)`, Pusher channel `private-user.{id}`.
- `.BumpRequested`: id; fetch /bumps to verify current authoritative state.
- `.LocationUpdated`: id, status; fetch /bumps/{id}/locations, or clear on stop.
- Only server broadcasts are allowed. No browser client-events for coordinates.

Lifecycle: pending (2 minutes) -> accepted (15/30 minutes from acceptance) ->
stopped/expired. A recipient can reject pending. Acceptance cannot extend or reopen a
session, and duplicate active requests for the same friendship are rejected under a lock.
