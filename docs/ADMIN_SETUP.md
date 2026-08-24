# Admin v1 external setup

The repository contains the admin application, database migrations, Supabase
Storage upload pipeline, monitoring integrations, and deployment checks.
Supabase is created and migrated; the remaining provider resources below still
need setup in their respective dashboards. No credential or secret belongs in
this document or in Git.

## 1. Supabase

1. Use the organization `Portfolio`.
2. Use the project `artkin-portfolio-sg` (`jdslgvmqeoeixkhejdyb`) in the
   Singapore region (`ap-southeast-1`).
3. Confirm the organization name, project reference, and region in the
   Supabase dashboard before any later database change.
4. Migration `20260814045615_admin_v1` has been applied from
   `supabase/migrations/20260814045615_admin_v1.sql`.
5. Migration `20260814053000_r2_reliability.sql` has been applied.
6. Migration `20260814140428_monitoring_snapshots.sql` has been applied.
7. Migration `20260824122455_supabase_storage_cutover.sql` has been applied.
8. Migration `20260824131126_harden_recovery_rpc_grants.sql` has been applied.
9. Run `supabase/tests/admin_v1_rls.sql`,
   `supabase/tests/monitoring_snapshots_rls.sql`, and
   `supabase/tests/supabase_storage_cutover.sql` against a disposable or reset
   test database. Never run the test scripts against production data.

The older `artkin-portfolio` project in Mumbai remains unused and empty. Do
not configure Auth or apply the Admin v1 schema there.

If the numbered migration has already been applied to an existing database,
move later SQL changes into a new forward migration instead of rerunning it.

### Google login

1. In Google Auth Platform, create a Web application OAuth client.
2. Add these authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://artkincarreon.vercel.app`
3. Add the Supabase callback shown on the Google provider page:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Enable Google under Supabase Authentication > Sign In / Providers and enter
   the Google client ID and secret.
5. While testing locally, set the Supabase Site URL to
   `http://localhost:3000`. Change it to the verified Vercel production URL
   only after the first successful deployment.
6. Add these redirect URLs before testing either environment:
   - `http://localhost:3000/auth/callback`
   - `https://artkincarreon.vercel.app/auth/callback`

Supabase documents the same callback and PKCE redirect flow in its
[Google login guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Bootstrap the two administrators

1. Temporarily enable **Allow new users to sign up**.
2. Use `/admin/login` once with each approved Gmail account. The app may deny
   admin access until the allowlist is populated, but the authenticated users
   will appear under Supabase Authentication > Users.
3. Copy the two immutable user UUIDs and run this as the database owner:

```sql
insert into private.admin_users (slot, user_id)
values
  (1, '<first-approved-user-uuid>'),
  (2, '<second-approved-user-uuid>')
on conflict (slot) do update
set user_id = excluded.user_id;
```

4. Disable **Allow new users to sign up**.
5. Confirm both approved accounts can open `/admin` and a third Google account
   cannot.

Do not authorize with email address or editable user metadata. The application
checks the UUID allowlist on every protected operation.

### Asset attestation secret

Generate one random secret of at least 32 bytes. Store it in the password
manager and set the identical value as `ASSET_MUTATION_SECRET` in Vercel. Then
run:

```sql
insert into private.runtime_secrets (name, secret)
values ('asset_mutation', '<same-value-as-ASSET_MUTATION_SECRET>')
on conflict (name) do update
set secret = excluded.secret, updated_at = now();
```

The `private` schema is not exposed through the Data API. Never put this value
in a `NEXT_PUBLIC_` variable.

## 2. Supabase Storage

The storage cutover migration creates:

- `portfolio-private` for originals, drafts, all CV versions, and private
  credential evidence.
- `portfolio-public` for optimized published images and explicitly public
  credential evidence.

The private bucket has no public read policy. Admin-only server routes create
single-object upload tokens and short-lived preview links. The public bucket is
readable by URL, while uploads, replacements, and removals remain server-only.

Do not add direct `storage.objects` write policies for `anon` or
`authenticated`; exact-object upload tokens are the browser upload boundary.
The server-side Storage client uses `SUPABASE_SERVICE_ROLE_KEY`, which must
never use a `NEXT_PUBLIC_` prefix or enter the browser bundle.

Supabase Free includes 1 GB of file storage. The application warns at 700 MB
and 850 MB and blocks new tracked uploads above 900 MB, leaving a buffer for
provider accounting and temporary processing. Check current usage under the
Supabase organization usage page. See
[Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## 3. Vercel

1. Import the private GitHub repository into a personal Vercel Hobby account.
2. Set the project root directory to `web`.
3. Use `npm run build` as the build command.
4. Set the production hostname to `artkincarreon.vercel.app`.
5. Add the environment variables listed below to Production and the required
   local equivalents to `web/.env.local`.
6. Create one Deploy Hook and store its URL as `VERCEL_DEPLOY_HOOK_URL`.
7. Enable Web Analytics and Speed Insights in the Vercel dashboard.
8. Confirm the daily `/api/internal/assets/cleanup` cron appears after the
   first deployment.

The cron runs at 18:00 UTC, approximately 02:00 in Manila. Vercel Hobby permits
daily cron jobs and sends `Authorization: Bearer $CRON_SECRET`; see
[Vercel Cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

### Vercel environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical Vercel URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public | Existing contact-form Turnstile key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Storage operations and signed deployment-check ingestion |
| `ASSET_MUTATION_SECRET` | Server | Matches `private.runtime_secrets` |
| `CLEANUP_ADMIN_USER_ID` | Server | UUID of one allowlisted administrator |
| `CRON_SECRET` | Server | Separate random secret of at least 32 bytes |
| `VERCEL_DEPLOY_HOOK_URL` | Server | Publishing deployment hook |
| `VERCEL_TOKEN` | Server | Read-only project monitoring access |
| `VERCEL_PROJECT_ID` | Server | Vercel project ID |
| `VERCEL_TEAM_ID` | Server | Optional for a personal project |
| `VERCEL_PROJECT_DASHBOARD_URL` | Server | Exact `https://vercel.com/<team>/<project>` URL used for dashboard links |
| `BETTER_STACK_API_TOKEN` | Server | Reads uptime monitor state |
| `BETTER_STACK_HOME_MONITOR_ID` | Server | Homepage monitor |
| `BETTER_STACK_CONTACT_MONITOR_ID` | Server | Contact monitor |
| `BETTER_STACK_HEALTH_MONITOR_ID` | Server | `/api/health` monitor |
| `BETTER_STACK_INGESTING_URL` | Server | Runtime-error source endpoint |
| `BETTER_STACK_SOURCE_TOKEN` | Server | Runtime-error source token |
| `BETTER_STACK_QUERY_URL` | Server | Read-only telemetry SQL endpoint |
| `BETTER_STACK_QUERY_USERNAME` | Server | Read-only query user |
| `BETTER_STACK_QUERY_PASSWORD` | Server | Read-only query password |
| `BETTER_STACK_QUERY_TABLE` | Server | Better Stack log table name |
| `DEPLOY_CHECK_SECRET` | Server | HMAC key of at least 32 bytes shared with GitHub Actions |

Vercel provides deployment IDs, URLs, and environment markers automatically;
do not create lookalike values manually. Keep **Automatically expose System
Environment Variables** enabled and verify `VERCEL_DEPLOYMENT_ID` and
`VERCEL_URL` exist in the first production deployment.

Keep `NEXT_PUBLIC_API_URL` empty until the deferred contact backend exists.

## 4. Better Stack

Create three HTTP success monitors:

- `https://artkincarreon.vercel.app/`
- `https://artkincarreon.vercel.app/contact`
- `https://artkincarreon.vercel.app/api/health`

Create one Logs source for sanitized browser and server runtime errors. Put its
HTTP ingest URL and source token in Vercel. Create read-only SQL API credentials
for that source and use its table name for `BETTER_STACK_QUERY_TABLE`.

Do not enable session replay or input/form capture. The application sends only
an error kind, name or digest, route path, method, and timestamp. Better Stack's
setup is documented in its
[uptime guide](https://betterstack.com/docs/uptime/monitoring-start/) and
[SQL API guide](https://betterstack.com/docs/logs/query-api/connect-remotely/).

## 5. GitHub production smoke checks

The workflow is `.github/workflows/production-smoke.yml`. It must exist on the
repository's default branch before Vercel can dispatch to it.

Add these GitHub Actions secrets:

- `DEPLOY_CHECK_SECRET`: identical to the Vercel value and at least 32 bytes.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: only when deployment protection requires
  it; otherwise omit it.

Vercel sends the official `vercel.deployment.success` repository dispatch. The
workflow ignores non-production deployments, checks the exact immutable
deployment URL, crawls bounded same-origin links, runs browser checks on
critical routes, and submits a signed result. See
[Vercel's GitHub integration guide](https://vercel.com/docs/git/vercel-for-github).

## 6. First production verification

1. Deploy while there are no invented projects or credentials. Honest empty
   states are expected.
2. Test both approved Google accounts and one unapproved account.
3. Upload valid and invalid images/PDFs and confirm the limits and signature
   checks.
4. Publish one verified private test record, confirm its immutable snapshot,
   then archive it.
5. Upload two CV versions and confirm `/resume.pdf` returns only the selected
   current version as an attachment.
6. Confirm objects in `portfolio-private` cannot be opened without signed
   access, while published derivatives in `portfolio-public` load normally.
7. Trigger a production deployment and confirm the GitHub smoke result appears
   in the admin dashboard.
8. Confirm the three Better Stack monitors and sanitized runtime-error source.
9. Confirm the cron removes only abandoned pending uploads older than 24 hours.

Remove `netlify.toml` only after the Vercel project and production deployment
are connected and verified.

## 7. Future domain migration

When the custom domain is purchased, update the canonical site URL, Vercel
domain, Google origins, Supabase redirect allowlist, Turnstile hostnames,
Better Stack monitors, Search Console, and sitemap together.
