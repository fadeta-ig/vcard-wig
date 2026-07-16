# Phase 1–6 Architecture

## Trust boundaries

1. The browser is untrusted. IDs, company context, role, and validation results from the browser are never accepted as authorization evidence.
2. Route handlers validate input, authentication, CSRF, role, and company access before calling a mutation service.
3. Services own transactions and audit writes.
4. Prisma is the only application data-access layer. MariaDB foreign keys preserve referential integrity.

## Multi-company authorization

- `SUPER_ADMIN` has global company access.
- `ADMIN` access is derived from active `UserCompanyMembership` rows.
- `vcard_company` is only a selected UI context. Every use is checked against the current user and active company state.
- Tenant-owned records carry `companyId`. Profile and analytics services derive scope from the authorized session/company context rather than client input. Global analytics is a separate Super Admin-only scope.
- Public profile slugs remain globally unique so dynamic QR URLs stay `/c/{slug}`.

## Analytics boundary

- Public events are allowlisted and validated against an active profile and visible target.
- No IP address or IP hash is stored. A random browser token is stored only as a SHA-256 hash for deduplication and centralized rate limiting.
- Profile-view and vCard counters are incremented in the same transaction as their event row. Retry is limited to database write-conflict/deadlock errors.
- Company dashboard, report, and CSV export use one scope resolver; audit logs remain read-only and Super Admin-only.

## Authentication lifecycle

1. Login normalizes the identifier and checks a database-backed throttle record.
2. The same Argon2id verification path is exercised for existing and non-existing accounts to reduce account enumeration timing differences.
3. A successful login creates independent random session and CSRF tokens.
4. The database stores only SHA-256 token hashes; the raw values are sent in SameSite cookies.
5. Session lookup rejects expired, revoked, or inactive-user sessions.
6. Logout revokes the database session before clearing cookies.
7. Password changes revoke every other active session.

## Mutation security

All browser mutations require:

- An exact `Origin` match with `APP_URL`.
- `Sec-Fetch-Site` that is not cross-site/same-site.
- A custom request marker header.
- For authenticated mutations, a CSRF header matching the hash bound to the current session.

## Upload lifecycle

1. Reject empty files and files above 2 MB.
2. Allowlist JPG, PNG, and WebP MIME values.
3. Decode with Sharp and require the decoded format to match the declared MIME type.
4. Enforce a 20-million-pixel input limit.
5. Re-encode logos to WebP and favicons to PNG.
6. Store under a randomized name scoped to the company.
7. Update the database and audit log transactionally; remove the new file if the transaction fails.
8. Remove the previous file only after the database update succeeds.

Profile photos apply the same lifecycle with stricter image rules:

- Maximum input dimensions are 2000×2000 pixels.
- Profile output is cropped to 600×600 WebP and thumbnail output to 160×160 WebP.
- Profile files are randomized and scoped below company ID and profile ID.
- Replacement/removal uses bounded retry for temporary Windows `EBUSY`/`EPERM` locks.

## Profile lifecycle

- New profiles always start as `DRAFT`.
- Allowed transitions are Draft → Active/Archived, Active → Inactive/Archived, Inactive → Active/Archived, and Archived → Draft.
- The first publish timestamp is preserved across deactivate/reactivate and reset when an archived profile is restored to Draft.
- Content and the complete social-link collection are updated in one database transaction with the audit record.
- Archived profiles are excluded by default from list queries and must be requested explicitly.
- Public-facing visibility is modeled by allowlisted booleans and an allowlisted section-order array. Phase 4 must build its public DTO from these controls rather than expose the database row directly.

## Production storage boundary

The current local adapter writes below `public/uploads/companies` and `public/uploads/profiles`. This is intentional for the MVP development environment. Ubuntu production should use object storage or a persistent, backed-up single-instance disk before public launch.

## Runtime configuration boundary

Database connection settings and the canonical application origin are read from the server process environment at runtime. They are accessed through an environment alias instead of direct `process.env.NAME` expressions so a Next.js build cannot bind the artifact to development database/origin values. The same build artifact can therefore be started with staging or Ubuntu production secrets without rebuilding it.
