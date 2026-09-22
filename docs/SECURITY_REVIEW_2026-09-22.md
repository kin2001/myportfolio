# Security review — 22 September 2026

## Release decision

**Hold deployment until production configuration is verified.** The code fixes
below pass local checks. Vercel CLI authentication is expired; its project-detail
connector also returns an argument-validation error. Production environment
values could not be inspected. The local GHL contact lookup returns 401, and
the local production Turnstile secret is missing. No deployment was performed.

Before release:

1. Authenticate the Vercel CLI from `web` using `npx vercel login`.
2. Add `contacts.readonly` to the GHL private integration and update its token
   in ignored local configuration if GHL rotates it. Verify lookup returns 200.
3. Configure and verify the real `TURNSTILE_SECRET_KEY`, its matching public
   site key, and canonical HTTPS `NEXT_PUBLIC_SITE_URL` in Vercel Production.
4. Securely configure the three GHL environment variables in Vercel Production.
5. Deploy the reviewed commit, then verify production headers, protected routes,
   availability, and Turnstile. A real booking/email test still needs a deliberate
   test appointment; this audit did not create one.

See [booking configuration](TURNSTILE_SETUP.md).

## Confirmed findings and fixes

| Finding | Impact | Fix |
| --- | --- | --- |
| Booking upsert accepted unverified identity fields | A visitor with a valid CAPTCHA could overwrite an existing CRM contact | Lookup by email and reuse without updating; create-only for new contacts; verify returned location and email |
| Booking/telemetry trusted Content-Length and treated JSON null as an object | Oversized body processing and avoidable 500 errors | Shared streamed byte limits, object checks, media type validation; reused for upload metadata and signed deployment reports |
| Turnstile accepted a missing action and did not validate hostname | Tokens were not fully bound to this booking flow | Exact action and canonical hostname, token length cap, production dummy-key rejection, bounded timeout and fail-closed errors |
| Every availability request reached GHL; public telemetry had no throttling | Upstream quota consumption and telemetry spam | 30-second availability caching and bounded per-instance burst limits |
| Contact mutation happened before availability checking | Invalid bookings could modify CRM data | Fresh availability check before contact work; retain GHL free-slot validation |
| No global anti-framing/content-type headers | Clickjacking and weaker browser defaults | frame-ancestors, X-Frame-Options DENY, nosniff, referrer and permissions policies |
| Admin API mutations/logout lacked explicit origin checks | Missing CSRF defense in depth | Same-origin checks before those operations, including proxy-host regression coverage |

## Verification performed

- `npm audit --json`: zero known advisories in installed dependencies.
- Official Next.js August 2026 advisory reviewed; installed Next.js 16.3.5 is
  newer than the advisory's patched 16.3.3 release.
- `npm run typecheck` and optimized `npm run build`: pass.
- All 30 native script tests pass, including seven new security tests with
  mocked providers and no live bookings.
- Five existing deployment-report/monitoring tests pass.
- Twelve HTTP checks against the local production build pass: public page,
  admin redirect, protected export/private asset/cron/upload, malformed booking
  and telemetry bodies, invalid month, and cross-origin booking/logout.
- Production-build response headers verified on `/contact`.
- Tracked files and 65 browser build files scanned against configured server
  secrets: no matches. Pattern review found no tracked secret material.
- Live Supabase catalog: no public tables without RLS; no anonymous execution
  of public SECURITY DEFINER functions; authenticated privileged functions
  enforce the admin UUID allowlist or signed asset authorization.
- Live bucket settings: originals/evidence bucket private; published bucket
  public; 10 MB limits and restricted MIME types; no client storage-write policies.
- Anonymous probes of drafts, assets, audit events and site settings denied.
- Admin/server-action/upload/export code reviewed for authorization, validated
  asset identifiers, file signatures, signed operations and private delivery.
- Public content uses React escaping; JSON-LD escapes `<`; publication link
  validation restricts URLs to HTTPS. Export CSV escapes formula prefixes.

## Remaining limits

- The request limiter is per process. Cold starts and multiple Vercel instances
  do not share counters. Configure edge/distributed rate controls for sustained
  or coordinated abuse; these checks were not a load test or DDoS simulation.
- CAPTCHA does not prove email/phone ownership. A determined visitor can still
  submit someone else's details or make unwanted bookings. Existing contact
  data is protected from overwrite, but preventing impersonation requires a
  separate verification flow.
- Supabase advisors warn about authenticated SECURITY DEFINER functions; the
  reviewed functions intentionally require allowlist/signature checks. The two
  private tables with RLS and no policies intentionally deny client access.
- Supabase also warns that leaked-password protection is disabled. Admin login
  uses Google OAuth; password-provider and account/MFA settings were not changed
  or fully audited. [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- CSP currently protects framing, object embeds and base URLs. It is not a
  complete script-src policy with nonces. React escaping remains the primary
  application-level XSS control.
- No destructive probes, real booking notifications, password attacks, or
  exhaustive authenticated browser penetration test were performed. This is
  an application review and bounded verification, not a guarantee against all
  attacks or undisclosed vulnerabilities.

References:

- [Next.js August security release](https://nextjs.org/blog/august-2026-security-release)
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Supabase database advisors](https://supabase.com/docs/guides/database/database-linter)
