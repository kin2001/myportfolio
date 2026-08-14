# Admin v1 external setup

The repository contains the admin application, database migration, R2 upload
pipeline, monitoring integrations, and deployment checks. The external
resources below still need to be created in their respective dashboards. No
credential or secret belongs in this document or in Git.

## 1. Supabase

1. Use the organization `Portfolio`.
2. Use the project `artkin-portfolio-sg` (`jdslgvmqeoeixkhejdyb`) in the
   Singapore region (`ap-southeast-1`).
3. Confirm the organization name, project reference, and region in the
   Supabase dashboard before any later database change.
4. Migration `20260814045615_admin_v1` has been applied from
   `supabase/migrations/20260814045615_admin_v1.sql`.
5. Run `supabase/tests/admin_v1_rls.sql` against a disposable or reset test
   database. Never run the test script against production data.

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
5. Set the Supabase Site URL to the Vercel production URL.
6. Add these redirect URLs:
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

## 2. Cloudflare R2

Create:

- `artkin-portfolio-private`
- `artkin-portfolio-public`

Keep public access disabled on the private bucket. Enable its generated
`r2.dev` development address only on the public bucket, then use that address
as `R2_PUBLIC_BASE_URL`. Cloudflare documents that `r2.dev` is rate-limited and
intended for testing; use `assets.artkincarreon.com` after the domain is
available. See [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

Create an R2 API token restricted to these two buckets with object read and
write access. Add its account ID, access key ID, and secret access key only to
server-side environment variables.

Set the private bucket CORS policy for browser uploads:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://artkincarreon.vercel.app"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Origins must match exactly and must not end with `/`. Cloudflare requires CORS
for browser use of presigned URLs; see the
[R2 CORS guide](https://developers.cloudflare.com/r2/buckets/cors/) and
[presigned URL guide](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

Configure a Cloudflare billing alert. The application warns at 6 GB and 7.5 GB
and blocks new tracked uploads above 8 GB, but it cannot impose an account-wide
Cloudflare spending cap.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Signed deployment-check ingestion only |
| `R2_ACCOUNT_ID` | Server | Cloudflare account |
| `R2_ACCESS_KEY_ID` | Server | Restricted R2 token |
| `R2_SECRET_ACCESS_KEY` | Server | Restricted R2 token secret |
| `R2_PRIVATE_BUCKET` | Server | `artkin-portfolio-private` |
| `R2_PUBLIC_BUCKET` | Server | `artkin-portfolio-public` |
| `R2_PUBLIC_BASE_URL` | Server | Public `r2.dev` address while testing |
| `ASSET_MUTATION_SECRET` | Server | Matches `private.runtime_secrets` |
| `CLEANUP_ADMIN_USER_ID` | Server | UUID of one allowlisted administrator |
| `CRON_SECRET` | Server | Separate random secret of at least 32 bytes |
| `VERCEL_DEPLOY_HOOK_URL` | Server | Publishing deployment hook |
| `VERCEL_TOKEN` | Server | Read-only project monitoring access |
| `VERCEL_PROJECT_ID` | Server | Vercel project ID |
| `VERCEL_TEAM_ID` | Server | Optional for a personal project |
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
| `DEPLOY_CHECK_SECRET` | Server | HMAC key shared with GitHub Actions |

Vercel provides deployment IDs, URLs, and environment markers automatically;
do not create lookalike values manually.

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

- `DEPLOY_CHECK_SECRET`: identical to the Vercel value.
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
6. Confirm the R2 private objects cannot be opened without signed access.
7. Trigger a production deployment and confirm the GitHub smoke result appears
   in the admin dashboard.
8. Confirm the three Better Stack monitors and sanitized runtime-error source.
9. Confirm the cron removes only abandoned pending uploads older than 24 hours.

Remove `netlify.toml` only after the Vercel project and production deployment
are connected and verified.

## 7. Future domain migration

When the custom domain is purchased, update the canonical site URL, Vercel
domain, Google origins, Supabase redirect allowlist, Turnstile hostnames, R2
CORS and public custom domain, Better Stack monitors, Search Console, and
sitemap together.
