# Authentication and Authorization

## API documentation

The OpenAPI document is served at `/api/openapi.json`; Swagger UI is available at `/api/docs`.

All auth routes are mounted under `/api/v1/auth`. JSON validation is strict: unknown fields are rejected. Email addresses are trimmed and lowercased. Passwords must be 12-128 characters and contain lowercase, uppercase, and numeric characters.

## Client transports

### Mobile and other bearer clients

Omit `X-Auth-Transport` and pass access tokens with `Authorization: Bearer <accessToken>`. Login and refresh responses contain the bearer access token, opaque refresh token, expiry, user, and session ID. Mobile clients should keep tokens in Expo SecureStore when client-side auth is implemented; do not persist tokens in localStorage.

### Browser cookie clients

Set `X-Auth-Transport: cookie`. First call `GET /api/v1/auth/csrf`; send the returned value as `X-CSRF-Token` on every state-changing request. The signed, readable `csrf_token` cookie must also be sent. The access and refresh cookies are HttpOnly, SameSite=Lax, scoped to `/api/v1`, and Secure when `COOKIE_SECURE=true`. Cookie login and refresh responses never include token values in JSON. Credentialed CORS accepts only configured `WEB_ORIGINS`.

## Endpoints

| Method | Path                                       | Purpose                                                | Important responses                           |
| ------ | ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
| `GET`  | `/api/v1/auth/csrf`                        | Issue signed CSRF cookie/token for browser clients     | `200`                                         |
| `POST` | `/api/v1/auth/register`                    | Create a customer and send email verification          | `202` generic response, `400`, `429`          |
| `POST` | `/api/v1/auth/email/verify`                | Consume a single-use verification token                | `204`, `400`                                  |
| `POST` | `/api/v1/auth/login`                       | Authenticate a verified customer                       | `200`, `401` generic credentials error, `429` |
| `POST` | `/api/v1/auth/refresh`                     | Rotate refresh token; reuse revokes its session        | `200`, `401`, `429`                           |
| `POST` | `/api/v1/auth/logout`                      | Revoke the supplied refresh session                    | `204`                                         |
| `POST` | `/api/v1/auth/change-password`             | Change password and revoke every active session        | `204`, `400`, `401`                           |
| `POST` | `/api/v1/auth/password-reset/request`      | Send a reset token without revealing account existence | `202` generic response, `429`                 |
| `POST` | `/api/v1/auth/password-reset/confirm`      | Consume a single-use reset token and revoke sessions   | `204`, `400`                                  |
| `GET`  | `/api/v1/auth/sessions`                    | List the caller's active sessions                      | `200`, `401`                                  |
| `POST` | `/api/v1/auth/sessions/{sessionId}/revoke` | Revoke one session belonging to the caller             | `204`, `404`                                  |
| `GET`  | `/api/v1/auth/admin/auth-audit-events`     | Read paginated auth audit events                       | `200`, `401`, `403`                           |

Registration body: `{"email":"customer@example.com","password":"..."}`. Registration does not return tokens; the customer must verify their email before login.

Bearer refresh body: `{"refreshToken":"..."}`. Cookie refresh uses the HttpOnly cookie and an empty JSON object. Logout accepts the same refresh body for bearer clients and revokes that token's session; cookie clients send the cookie. Password reset request body is `{"email":"..."}`; confirmation body is `{"token":"...","password":"..."}`.

Reset and email-verification tokens are cryptographically random, stored only as SHA-256 hashes, single-use, and time-limited. Refresh tokens are opaque, stored only as hashes, rotated atomically, and expire with their session. Replaying a consumed refresh token revokes the whole session family. Access JWTs are short-lived and every request also checks the session in PostgreSQL so revocation takes effect immediately.

## Roles and permissions

Roles are assigned server-side; registration always creates `CUSTOMER`. The backend requires both an allowed role and every requested permission. Current permission mapping:

- `CUSTOMER`: `profile:read`, `profile:write`, `auth:sessions:read`, `auth:sessions:revoke`
- `ADMIN`: `profile:read`, session read/revoke, `auth:audit:read`, `users:roles:manage`
- `PHARMACIST`: `profile:read`, `auth:sessions:read`, `prescriptions:verify`
- `DELIVERY_AGENT`: `profile:read`, `auth:sessions:read`, `deliveries:update`

The audit endpoint currently requires the `ADMIN` role and `auth:audit:read` permission. Role or permission failures return the same `403` response.

## Mail and local setup

`MAIL_TRANSPORT=console` is the development default and writes verification/reset messages to server logs. `MAIL_TRANSPORT=smtp` requires `SMTP_HOST`; configure `SMTP_USER` and `SMTP_PASSWORD` together when the provider requires authentication. Set `MAIL_FROM`, `SMTP_PORT`, and `SMTP_SECURE` for the provider. SMTP activation requires credentials supplied outside source control.

For database-backed tests, copy `.env.example` to `.env`, start PostgreSQL with `npm run db:up`, apply migrations with `npm run db:migrate`, then run `npm test`. The auth integration suite loads `.env` and cleans up its uniquely prefixed test accounts.

Configure `ACCESS_TOKEN_SECRET` with at least 32 random characters. Tune token lifetimes with `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `PASSWORD_RESET_TTL_MINUTES`, and `EMAIL_VERIFICATION_TTL_HOURS`. Set `COOKIE_SECURE=true` behind HTTPS. See `.env.example` for every variable.

All auth routes have an in-memory limit of 20 requests per IP per 15 minutes. Login and refresh use a tighter 5-request limit, as do password-reset request/confirm routes. Auth events and rate-limit events are stored in `auth_audit_events`; secrets and token values are never written to audit records.
