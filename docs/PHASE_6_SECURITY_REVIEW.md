# Phase 6 Security Review

Review date: 15 July 2026  
Scope: application-layer controls implemented through Phase 6.

## Authorization matrix

| Capability | Anonymous | Admin | Super Admin |
|---|---:|---:|---:|
| Active public profile/vCard | Read | Read | Read |
| Submit allowlisted public event | Yes, same-origin and rate-limited | Yes | Yes |
| Company dashboard/analytics | No | Assigned active company only | Selected active company |
| Global dashboard/analytics | No | No | Yes |
| Analytics CSV | No | Assigned active company only | Selected company or explicit global scope |
| Profile/company settings | No | Assigned company only | Any active company |
| Admin management | No | No | Yes |
| Audit log | No | No | Read-only |

Every admin query derives scope from the authenticated session and validated company selection. Client-supplied company/profile IDs are filters, not authorization evidence. The analytics export runs the same scope resolver as the page.

## Security controls verified in code/tests

- Argon2id passwords, opaque hashed sessions/CSRF tokens, SameSite cookies, and Secure cookies when `APP_URL` is HTTPS.
- Exact-origin, Fetch Metadata, request-marker, and CSRF validation on administrative mutations.
- Database-backed login and public throttling without IP storage.
- Strict event schema, active-profile lookup, visible-target validation, bot/prefetch exclusion, UI dispatch guards, and server deduplication.
- Atomic event/counter transaction with bounded retries only for Prisma `P2034` write conflict/deadlock.
- Multi-company analytics isolation and Super Admin-only global/audit scope.
- Recursive audit redaction for password, token, secret, CSRF, credential, authorization, cookie, and session keys.
- URL protocols allowlisted at write and read; public HTTP(S) URLs cannot contain credentials; `javascript:` is rejected.
- Upload MIME allowlist, decoded-signature validation, pixel/dimension limits, Sharp re-encoding, randomized paths, and path containment checks.
- Generic 500 responses; ORM details and stack traces remain server-side.
- Production CSP, frame denial, MIME sniffing denial, strict referrer policy, permissions policy, COOP/CORP, and one-year HSTS.
- Retention cleanup and checksum-verified backup/restore workflow.

## Dependency audit

`npm audit --omit=dev --json` on 15 July 2026 reports 6 moderate, 0 high, and 0 critical findings. No upstream fix is available in the installed stable dependency graph:

- PostCSS advisory inherited through Next.js. Application colors are strict `#RRGGBB`; the application does not stringify user-provided CSS.
- Hono static middleware advisory inherited through Prisma development tooling. Prisma development servers/static middleware are not exposed in the deployed application.

These are accepted temporary upstream risks, not ignored findings. Re-run the audit on each dependency update and upgrade immediately when fixed stable versions are available.

## Deployment caveats

- HSTS is useful only when nginx exposes the application exclusively through HTTPS. Redirect HTTP to HTTPS before production traffic.
- CSP permits inline Next.js scripts/styles for framework compatibility. A nonce-based CSP can further reduce exposure in a later hardening release.
- Local uploads require one persistent application instance and an uploads backup. Object storage is preferred before horizontal scaling.
- Secrets must come from protected Ubuntu environment/service configuration. Do not use a production root database account.

