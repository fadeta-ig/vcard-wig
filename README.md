# Corporate vCard & QR Contact Generator

Internal multi-company application for managing corporate digital contact cards. Phase 1 through Phase 6 provide the secure application foundation, company and administrator management, tenant isolation, public digital contact pages, vCard/QR exports, analytics, audit visibility, and operational hardening.

## Current delivery status

Completed:

- Next.js App Router, React, TypeScript, ESLint, Vitest, and production build gates.
- Prisma 7 schema and repeatable MariaDB/MySQL migration.
- Multi-company data model with administrator memberships.
- Indonesian/English UI switch.
- Username/email login, Argon2id password hashing, opaque database sessions, logout, and session expiry.
- Forced change for temporary passwords.
- Server-bound CSRF validation and same-origin enforcement.
- Database-backed login throttling without storing IP addresses.
- Responsive admin shell and dashboard.
- Company CRUD, configurable branding/QR defaults, logo/favicon processing, and soft disable.
- Admin CRUD, multi-company assignment, role/status controls, password reset, session revocation, and lockout guards.
- Audit records for authentication and administrative mutations.
- Contact profile CRUD with server-side pagination, search, filters, sorting, and archive visibility rules.
- Draft/Active/Inactive/Archived lifecycle with explicit, audited transition rules.
- Modular social links with platform/icon allowlists, active visibility, and ordering.
- Profile photo validation and WebP processing to 600×600 plus 160×160 thumbnail.
- Per-field visibility, section ordering, and unsaved-data preview for mobile/tablet/desktop.
- Server-rendered public profiles at `/c/{slug}` with company branding and responsive 520 px digital-card layout.
- Public phone, email, WhatsApp, website, social-media, and share actions with a clipboard fallback.
- Server-side public DTO filtering: hidden fields, inactive social links, internal IDs, and creator data are never sent to the browser.
- Draft/Archived 404 behavior, PII-free Inactive page, Indonesian/English public UI, canonical/Open Graph metadata, and status-aware robots policy.
- Public contact API at `/api/public/contacts/{slug}` with a no-store cache policy and a privacy page that documents the no-IP analytics policy.
- vCard 3.0 downloads with CRLF, UTF-8 octet-aware line folding, safe escaping, structured contact mapping, visibility filtering, and optional JPEG-compatible photos.
- Dynamic Profile URL and direct-vCard QR generation with PNG/SVG export, configurable size/margin/error correction/colors, optional company logo, contrast validation, and fingerprint caching.
- Admin QR/vCard workspace at `/admin/profiles/{id}/qr`; the public "Save to Contacts" action downloads the live `.vcf` file.
- Privacy-preserving activity events for views, vCard, phone, WhatsApp, email, social, and share actions without IP/IP-hash storage.
- Per-company dashboard and analytics with date/event/profile filters, CSV export, top profiles, recent profiles, and a 14-day trend; Super Admin global scope is explicit and separate.
- Super Admin-only read-only audit log with search, filters, pagination, recursive sensitive-value redaction, and bilingual UI.
- Centralized public rate limits, event/counter transactions with deadlock retry, retention cleanup, CSP/HSTS/security headers, and checksum-verified database backup/restore scripts.

## Runtime versions

The lockfile currently resolves:

- Node.js 24.11.1 in the development environment.
- Next.js 16.2.10 and React 19.2.7.
- Prisma ORM/Client 7.8.0 with the MariaDB driver adapter.
- TypeScript 6.0.3.
- MariaDB 10.4.32 at `127.0.0.1:3307` for local development.

Use `npm ci` on other machines to reproduce the locked dependency tree.

## Local setup

Prerequisites:

- Node.js 22 or newer.
- MySQL or MariaDB available locally.
- A database user able to migrate the development database.

Steps:

1. Install dependencies:

   ```powershell
   npm.cmd ci
   ```

2. Copy `.env.example` to `.env` and fill the database settings. Real passwords must not be committed.

3. Create the development database when it does not exist:

   ```sql
   CREATE DATABASE vcard_wig
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

4. Apply migrations and generate the client:

   ```powershell
   npm.cmd run db:deploy
   npm.cmd run db:generate
   ```

5. Seed the initial Super Admin. Pass the password only through the process environment:

   ```powershell
   $env:SEED_ADMIN_PASSWORD = "replace-with-a-private-password"
   npm.cmd run db:seed
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```

   The seed is idempotent by username. A temporary password shorter than 12 characters is accepted only when it has at least 8 characters; the account is then forced to replace it with a password of at least 12 characters.

6. Start development:

   ```powershell
   npm.cmd run dev
   ```

   Open `http://localhost:3000/admin/login`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma CLI connection URL. URL-encode special characters. |
| `DATABASE_HOST`, `DATABASE_PORT` | Runtime database host and port. |
| `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | Runtime adapter credentials and database. |
| `DATABASE_CONNECTION_LIMIT` | Runtime pool limit; default local value is 5. |
| `APP_URL` | Canonical runtime origin used for Origin/CSRF validation, cookie transport security, public canonical URLs, and Open Graph URLs. |
| `NEXT_PUBLIC_APP_URL` | Public origin available to browser-visible features. |
| `SESSION_TTL_HOURS` | Fixed session lifetime, default 8 hours. |
| `ANALYTICS_RETENTION_DAYS` | Event retention, default 365 days. |
| `EXPIRED_SESSION_RETENTION_DAYS` | Grace period after session expiry, default 30 days. |
| `BACKUP_DIR`, `MYSQL_DUMP_BIN`, `MYSQL_CLIENT_BIN` | Optional backup/restore tool paths and output directory. |
| `SEED_ADMIN_*` | Initial Super Admin seed values. The real password is never stored in `.env.example`. |

For production, both URL variables must be `https://vcard.wijayainovasi.co.id`. `APP_URL` controls the Secure cookie flag, so it must match the URL users actually access.

Database and canonical-origin values are runtime-bound: build the artifact once, then provide the target environment when starting it. This prevents development database settings from being baked into the Ubuntu production artifact.

## Quality commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Integration tests use the isolated `vcard_wig_test` database and run test files serially to prevent shared-database races. Create it and run `npm.cmd run db:deploy` against its URL before the first test run.

## Database commands

| Command | Use |
|---|---|
| `npm.cmd run db:generate` | Generate Prisma Client. |
| `npm.cmd run db:migrate -- --name <name>` | Create/apply a migration during development. |
| `npm.cmd run db:deploy` | Apply committed migrations in staging/production. |
| `npm.cmd run db:status` | Inspect migration status. |
| `npm.cmd run db:seed` | Explicitly seed the Super Admin. |
| `npm.cmd run db:backup` | Create a consistent SQL backup and SHA-256 checksum. |
| `npm.cmd run db:restore -- <file.sql> <clean_database>` | Checksum-verify and restore into a separate database. |
| `npm.cmd run maintenance:cleanup` | Apply analytics/session/throttle retention. |

Never use `prisma migrate reset` against shared or production data.

## Security model

- The browser receives an opaque random session token; only its SHA-256 hash is stored in the database.
- CSRF tokens are separately generated, hashed, tied to a session, and required with Origin checks for every mutation.
- Passwords use Argon2id. Passwords and session/CSRF tokens are excluded from API and audit payloads.
- Login errors do not reveal whether a username/email exists.
- Administrators receive company access through `UserCompanyMembership`. Company context is validated server-side and is never trusted from a request body alone.
- Company assets accept only JPG/PNG/WebP up to 2 MB, validate decoded signatures and pixel limits, and are re-encoded by Sharp under randomized filenames.
- Profile photos additionally enforce maximum dimensions of 2000×2000, generate 600×600 and 160×160 WebP outputs, and clean replaced files after the database transaction succeeds.
- Profile create/update derives `companyId` from the authorized session context. Profile IDs and company cookies never act as authorization evidence.
- Archived profiles are soft-deleted from the primary list and can only return through the explicit Archived → Draft transition.
- Public pages query by globally unique slug but return a dedicated DTO without tenant IDs, creator data, or fields disabled by profile visibility. Draft/Archived and inactive companies return 404; Inactive profiles expose branding only.
- Public external URLs are revalidated at read time and only credential-free HTTP(S), international `tel:`, normalized `wa.me`, and safe `mailto:` actions are emitted.
- Admin QR/vCard endpoints require an authorized session and company scope. Public vCard is available only for ACTIVE profiles in active companies.
- Direct-vCard QR and `.vcf` output use the same visibility-filtered source. Photos are embedded only in downloads; direct QR omits photos to control payload density.
- QR exports enforce a minimum four-module quiet zone, minimum 4.5:1 foreground/background contrast, and correction level H whenever a logo is embedded.
- Public analytics uses a random HttpOnly browser token stored only as a SHA-256 hash; IP addresses and IP hashes are not stored.
- Analytics and CSV queries reuse the authenticated company scope; only Super Admin can request the explicit global scope or read audit logs.
- Production responses include CSP, frame denial, nosniff, referrer/permissions policy, COOP/CORP, and HSTS.
- Development may use a local administrative database account. Production must use a dedicated least-privilege user and a strong secret.

## Ubuntu production notes

- Build and run behind an HTTPS reverse proxy such as nginx; do not expose `next start` directly to the internet.
- Use a process manager or container restart policy and configure health monitoring.
- Use an application-specific database account. Run `npm run db:deploy` as a controlled release step.
- Phase 2 local uploads are suitable for Windows development and a single persistent instance. Before production, connect the storage adapter to object storage or confirm persistent disk, file backup, and single-instance deployment.
- Back up the database before every migration and verify restore on staging. Follow [docs/PHASE_6_OPERATIONS.md](docs/PHASE_6_OPERATIONS.md).

## Known upstream advisories

As of 15 July 2026, `npm audit` reports moderate advisories in transitive dependencies of the current Next.js/PostCSS and Prisma tooling releases, with no upstream fix available in the installed stable versions. The application does not stringify user-controlled CSS (colors are strict `#RRGGBB`) and does not expose Prisma development servers. Re-run `npm audit` during each dependency update and upgrade as soon as fixed stable releases are available.
