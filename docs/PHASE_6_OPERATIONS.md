# Phase 6 Operations Runbook

Status: implementation complete; production cutover remains Phase 7.  
Validated environment: Windows development, MariaDB 10.4 at `127.0.0.1:3307`, 15 July 2026.

## Analytics definitions

| Metric | Definition |
|---|---|
| Profile view | A rendered active public profile. The same anonymous browser token/profile pair is counted at most once per 30 minutes. |
| vCard download | A successful request to the public active-profile `.vcf` endpoint. Repeats within two seconds are deduplicated. |
| Phone, WhatsApp, email, social, share | A user activation of the corresponding visible action. Repeats within two seconds are deduplicated. |
| Total events | Sum of accepted event rows. It is not a unique-user metric. |

Obvious bot, crawler, link-preview, prefetch, and prerender user agents/headers are ignored. The public event body is strict and accepts only an allowlisted event type plus a hashed social target when required. Arbitrary metadata is rejected.

Analytics stores no IP address or IP hash. A random HttpOnly browser token is sent as a SameSite cookie and only its SHA-256 hash is persisted for deduplication and rate limiting. Referrer query strings are discarded; user-agent and referrer path are limited to 500 characters.

## Rate limits

The `PublicRateLimit` table is the centralized store, so limits remain consistent if more than one application process is used.

| Endpoint class | Anonymous browser | Global scope | Window |
|---|---:|---:|---:|
| Public contact API | 120 | 1,200 per slug | 60 seconds |
| Public vCard | 20 | 300 per slug | 60 seconds |
| Public event ingestion | 90 | 1,500 per slug | 60 seconds |

Login uses its separate database-backed identifier throttle: five failures within 15 minutes lock the normalized username/email hash for 15 minutes. No IP key is used.

## Retention job

Defaults:

- Activity events: 365 days.
- Expired sessions: removed 30 days after expiry.
- Expired public rate-limit buckets: removed on the next cleanup.
- Stale, unlocked login throttles: 30 days.
- Audit logs: retained; no automatic deletion is enabled in Phase 6.

Run manually:

```bash
cd /srv/vcard-wig
npm run maintenance:cleanup
```

Recommended Ubuntu cron for the application service account:

```cron
15 02 * * * cd /srv/vcard-wig && /usr/bin/npm run maintenance:cleanup >> /var/log/vcard-maintenance.log 2>&1
```

Set `ANALYTICS_RETENTION_DAYS` and `EXPIRED_SESSION_RETENTION_DAYS` only after the business owner approves the policy change.

## Database backup

The backup wrapper uses `mariadb-dump` on Ubuntu and `mysqldump` when configured. Passwords are passed through the child-process environment, never command arguments. It uses a consistent transactional snapshot, includes triggers/routines/events, writes with restrictive permissions, and produces a SHA-256 sidecar.

```bash
cd /srv/vcard-wig
BACKUP_DIR=/srv/backups/vcard npm run db:backup
```

Recommended daily cron:

```cron
00 01 * * * cd /srv/vcard-wig && BACKUP_DIR=/srv/backups/vcard /usr/bin/npm run db:backup >> /var/log/vcard-backup.log 2>&1
```

Copy backups to an encrypted off-host target and alert on a missing daily file. If production keeps local uploads, back up `public/uploads` in the same recovery set; the SQL backup does not contain image files.

## Restore drill

The restore wrapper requires a clean target name and verifies the checksum before creating the database. It refuses to overwrite `DATABASE_NAME`. Replacing an existing target requires the explicit `RESTORE_ALLOW_REPLACE=true` override.

```bash
npm run db:restore -- /srv/backups/vcard/vcard_wig-TIMESTAMP.sql vcard_wig_restore_drill_YYYYMMDD
```

After restore, the command verifies table count, Prisma migration count, companies, and profiles. Then start a staging process against the drill database and smoke-test login, profile list, one public profile, vCard, and QR. Never perform the drill against production.

Local final drill executed on 15 July 2026: **[VERIFIED]** 11 tables (including Prisma migration history), 2 migrations, 1 company, and 1 contact profile restored into `vcard_wig_restore_drill_20260715_phase6_final`. The source `vcard_wig` database was not replaced. A separate empty-database migration drill also applied both committed migrations successfully to `vcard_wig_migration_drill_20260715`.

## Release and rollback

1. Take and checksum a database backup plus uploads backup.
2. Run `npm ci`, `npm run verify`, then `npm run db:deploy`.
3. Restart the managed application process with production environment variables.
4. Verify `/admin/login`, one authorized dashboard, `/c/{slug}`, vCard, QR, and security headers.
5. On application failure, restore the prior artifact. Restore the database only when a migration/data change requires it; use a new recovery database first and switch deliberately.
