# Artkin Portfolio Admin v1 — Final Implementation Plan

## Summary

Replace the current admin prototype with a private publishing and monitoring
system while preserving the approved portfolio design.

The v1 stack will be:

- Next.js App Router for public pages, admin UI, Server Actions, and Route
  Handlers.
- Supabase Auth and Postgres for two administrators and structured content.
- Cloudflare R2 for project images, credential evidence, and every CV version.
- Vercel Hobby for the publicly viewable personal test deployment.
- Vercel Web Analytics and Speed Insights for traffic and performance.
- Better Stack for uptime and runtime-error monitoring.
- GitHub Actions for post-deployment internal-link and smoke checks.

FastAPI, AI Signal automation, chatbot knowledge base, inquiries, automated
Google Drive backups, public signup, profile editing, and arbitrary
project-file uploads are deferred.

## Architecture and Security

### Service setup

- Create a new Supabase organization named `Artkin Carreon`.
- Create a dedicated project named `artkin-portfolio` in the Singapore region.
- Verify the exact organization, project reference, and region before applying
  migrations; never record credentials in documentation.
- Create R2 buckets:
  - `artkin-portfolio-private` for originals, drafts, all CV versions, and
    private credential evidence.
  - `artkin-portfolio-public` for optimized published images and publicly
    visible credential evidence.
- Use the generated `r2.dev` address during testing. Connect
  `assets.artkincarreon.com` after purchasing the domain.
- Replace the unused Netlify configuration with Vercel configuration only after
  the Vercel project is connected.

### Authentication and authorization

- Use Supabase Google OAuth with SSR cookies and PKCE.
- Temporarily allow account creation, sign in with the two approved Gmail
  accounts, record their immutable Supabase user UUIDs, and then disable new
  signups.
- Store the two UUIDs in a non-exposed `private.admin_users` table.
- Both accounts receive full admin permissions.
- Every protected layout, Server Action, database policy, upload endpoint, and
  publishing operation verifies the UUID allowlist.
- `/admin/login` remains outside the protected admin shell and contains one
  “Continue with Google” action.
- No password form, signup page, account-management interface, or authorization
  based on editable user metadata.
- Enable explicit database grants and RLS together:
  - Anonymous users can read immutable published project and credential
    snapshots only.
  - Approved administrators can manage drafts and metadata.
  - Audit records are append-only.
  - Private CV versions, drafts, and private evidence are never anonymously
    readable.
- Service-role credentials remain server-only and are used only by the signed
  deployment-check ingestion endpoint—not normal browser/admin operations.

### Core data contracts

Use these records:

- `projects`: stable identity, generated slug, lifecycle state, manual order,
  and current published snapshot.
- `project_drafts`: mutable title, documentation blocks, optional cover,
  optional links, and optimistic-lock version.
- `project_publications`: immutable snapshots created on each publication.
- `assets`: R2 object keys, MIME type, dimensions, size, checksum, processing
  state, ownership, and visibility.
- `credentials` and `credential_publications`: mutable draft plus immutable
  published snapshot.
- `cv_versions`: every immutable private PDF version and its upload metadata.
- `site_settings`: singleton pointer to the current CV.
- `audit_events`: administrator, entity, action, changed field names, and
  timestamp.
- `deployment_checks`: latest production deployment, smoke-check result,
  broken-link count, run URL, and check time.

Project documentation uses one ordered document:

```ts
type ProjectDocumentBlock =
  | {
      id: string;
      type: "text";
      heading?: string;
      body: string;
      format: "paragraph" | "bullets" | "numbered" | "code";
      language?: string;
    }
  | {
      id: string;
      type: "image";
      assetId: string;
      alt: string;
      caption?: string;
    };

type ProjectLink = {
  id: string;
  label: string;
  url: string;
  kind: "github" | "demo" | "video" | "file" | "documentation" | "other";
};
```

A project requires only a title and at least one nonempty text block. Cover
images and project links are optional. The public card excerpt is generated
deterministically from the first meaningful text block, stripped to plain text
and limited to approximately 180 characters.

Slugs are generated from the title, made unique automatically, hidden from the
normal editor, and locked after first publication.

All admin mutations return a consistent result containing success data or a
stable error code, message, and field errors.

## Admin and Publishing Behavior

### Admin information architecture

Use these private routes:

- Dashboard
- Projects
- CV
- Credentials
- Activity and Export
- Account/logout in the header

Remove Inquiries and generic Settings from v1. Use the existing paper canvas,
mono typography, indigo states, square modules, and motion rules. Replace the
current horizontally scrolling mobile admin navigation with the established
64px header and accessible drawer pattern. Do not add a chart library.

### Dashboard

Display independently timestamped signals rather than one misleading “system
ready” state:

- Visitors and page views for 7 and 30 days.
- Top public routes and referrers.
- Link to full Vercel Analytics and Speed Insights.
- Homepage, Contact, and `/api/health` uptime from Better Stack.
- Recent browser/server error count and last occurrence.
- Latest Vercel production deployment status.
- Latest internal-link and smoke-check result.
- Draft, published, and archived project totals.
- Credential count and current CV version.
- R2 storage estimate and warnings.
- Recent administrator activity.

Provider requests run server-side, cache briefly, and show “Unavailable” with
the last successful timestamp if a provider fails. Visitor-level analytics are
never copied into Supabase. Session replay and form/input capture remain
disabled.

### Projects

The editor contains:

- Required project title.
- Optional cover image shown only on the full project page.
- One ordered documentation builder containing text and image blocks.
- Zero or more optional labeled HTTPS links.
- Preview, Save Draft, Publish, Archive, and deployment-status controls.
- Accessible Move Up and Move Down controls for documentation blocks and
  published-project ordering.

Saving is explicit. Leaving with unsaved changes displays a warning.
`lock_version` rejects stale saves when the other administrator has changed the
same draft.

Editing a published project creates or updates a private working draft. The
previous immutable publication stays public until the replacement publication
successfully deploys.

Publishing validates only necessary safety and integrity requirements:

- Nonempty title and documentation text.
- Uploaded assets completed validation.
- Nonempty alt text for meaningful images.
- Media-publication permission confirmed.
- Optional links use valid HTTPS URLs.
- No invented proof requirement or mandatory nine-section template.

Publishing creates an immutable snapshot and triggers a secret Vercel Deploy
Hook. Draft saves do not deploy. Archive and manual-order changes also trigger
deployment. Failed deployments leave the previous production site online and
expose a Retry Deployment action.

There is no permanent-delete action in v1. Archived content and private
originals are retained.

### Public project presentation

- Home cards retain their existing geometry but replace the Problem/Solution
  pair with one `Documentation` excerpt.
- Work cards retain their bordered module treatment and show title, automatic
  excerpt, publication date, and the existing action.
- Project pages show title, optional cover, ordered documentation blocks, and
  optional links only when links exist.
- Cover images do not appear on Home or Work cards.
- Metadata descriptions use the automatic excerpt.
- The cover becomes the project Open Graph image when available.
- Published slugs remain stable and feed the sitemap.
- Public project and credential pages are generated during Vercel builds so
  normal browsing does not depend on an active Supabase connection.

### Asset processing

- Project images: JPEG, PNG, WebP, or AVIF; maximum 8 MB and 2400px long edge.
- CV and credential PDFs: PDF only, maximum 10 MB.
- Reject SVG, HTML, DOCX, ZIP, executable, and mismatched file signatures.
- Generate server-controlled UUID object keys.
- Upload directly to the private bucket using short-lived, single-object
  presigned URLs.
- Finalization verifies the object, checksum, actual MIME type, and decoded
  image dimensions.
- Strip EXIF/GPS metadata.
- Retain the validated original privately.
- Produce a WebP public derivative; use lossless output for PNG-style
  screenshots and quality-compressed output for photographic sources.
- Private previews use short-lived signed URLs.
- Public assets are copied only during publication.
- Asset states are `pending → ready → published`.
- Run one daily authenticated cleanup for abandoned pending uploads older than
  24 hours.
- Track total verified bytes, warn at 6 GB and 7.5 GB, and block new uploads
  when tracked storage would exceed 8 GB.
- Configure a Cloudflare billing alert because application counters cannot
  impose a Cloudflare spending cap.

### CV management

- Every upload creates an immutable private PDF version with original filename,
  size, uploader, timestamp, and optional version note.
- Previous versions are never deleted in v1.
- Administrators can preview/download any version using a short-lived signed
  URL.
- “Set as current” copies the selected version to the stable public R2 key used
  by `/resume.pdf`.
- Only the current copy is publicly downloadable.
- Replacing or restoring the current version never overwrites the retained
  private versions.
- Public CV responses use attachment disposition and `nosniff`.

### Credential management

Required fields:

- Credential name.
- Issuer.
- Issue date.
- Either a verification URL or an uploaded image/PDF.

Optional fields:

- Expiry date.
- Skills demonstrated.
- Related project.
- Verification URL when uploaded evidence already exists.
- Uploaded evidence when a verification URL already exists.

Each credential follows Draft → Preview → Publish → Archive. Evidence visibility
is chosen per credential:

- Public evidence is copied to the public R2 bucket and displayed or downloaded
  from the credential page.
- Private evidence remains admin-only while the credential record can still be
  public.
- Public images require alt text.
- Publishing requires confirmation that unnecessary certificate numbers, QR
  codes, addresses, and signatures have been reviewed or redacted.

### Activity and export

Record meaningful actions only:

- Login/logout.
- Project or credential creation.
- Explicit draft saves.
- Upload completion.
- Publish, archive, reorder, and deployment retry.
- CV upload/current-version changes.
- Evidence-visibility changes.
- Content exports.

Do not log keystrokes, document contents, OAuth tokens, signed URLs, request
bodies, or provider secrets.

Provide separate downloads for:

- Complete content JSON including drafts and immutable publications.
- Audit CSV.
- R2 asset manifest containing object keys, sizes, MIME types, and checksums.

Label this feature “Content export,” not “Full backup.” Original media can be
retained manually in Google Drive; automatic Drive synchronization is deferred.

## Monitoring, Deployment, and Delivery

### Public publishing

- Vercel builds read published snapshots through the Supabase anonymous key and
  RLS.
- Generate all published project routes, credential records, metadata, sitemap
  entries, and public content during the build.
- The public site continues serving its previous successful deployment if
  Supabase pauses or a later build fails.
- A server-only Deploy Hook triggers after project/credential publication,
  archiving, or ordering changes.
- Current CV changes update the stable R2 object without requiring a full
  deployment.

### Post-deployment validation

Use Vercel’s GitHub integration and the official `repository_dispatch` event:

- Trigger one GitHub Actions workflow on `vercel.deployment.success`.
- Run only when the payload environment is production.
- Test the exact immutable deployment URL from the event payload.
- Crawl bounded same-origin links and critical routes.
- Check non-2xx/3xx responses, missing same-origin images/assets, page errors,
  and console errors.
- Ignore hash, `mailto:`, `tel:`, and external links.
- Post the result to a secret-authenticated Next.js ingestion route.
- Store only deployment URL, Git SHA, result, counts, run URL, and timestamps.
- Keep the previous result but mark it stale if ingestion fails.

Do not use Vercel account webhooks because they require Pro/Enterprise. Do not
use the Checks API or add another monitoring provider.

### Domain migration

When the custom domain is purchased, update together:

- Canonical site URL and metadata.
- Vercel production domain.
- Google OAuth authorized origins and Supabase redirect allowlist.
- Turnstile hostnames.
- R2 CORS and `assets.artkincarreon.com`.
- Better Stack monitors.
- Analytics configuration.
- Search Console and sitemap submission.

## Implementation Sequence and Test Plan

### Delivery phases

1. Save this approved plan as `docs/ADMIN_PLAN.md` and commit it.
2. Create and verify Supabase, R2, Vercel, Google OAuth, and Better Stack
   resources.
3. Add Supabase clients, migrations, grants, RLS tests, Google login, protected
   layouts, and the two-user allowlist.
4. Add the R2 upload, validation, optimization, preview, cleanup, and
   storage-warning pipeline.
5. Replace static project arrays with draft/publication records; implement the
   block editor, preview, publishing, ordering, static public rendering, and
   deploy hook.
6. Implement CV history/current-version handling and update every public CV
   link.
7. Implement credential drafts, evidence visibility, publication, and public
   rendering.
8. Implement dashboard analytics, uptime/errors, deployment state, Activity,
   and Content Export.
9. Add the production smoke workflow, internal result-ingestion route, and
   monitoring alerts.
10. Complete security, accessibility, responsive, SEO, performance, and
    visual-regression validation.

Each completed and verified phase receives a descriptive Git commit without
staging unrelated user files.

### Required tests

- Unauthenticated users are redirected from every private route.
- A third Google account cannot access admin data even with a valid Supabase
  session.
- Both allowlisted accounts can work, and stale concurrent saves are rejected.
- Anonymous queries cannot read drafts, CV history, private evidence, audit
  events, or asset metadata.
- Project title/document creation, explicit saving, block ordering, preview,
  publication, editing, deployment retry, manual display ordering, and archiving
  work.
- Home uses the first three manually ordered published projects.
- Invalid images, oversized files, MIME mismatches, SVG/HTML, missing alt text,
  and expired upload URLs are rejected.
- Draft/private R2 objects cannot be opened publicly.
- Published assets render responsively without layout shift.
- Every CV version remains private; `/resume.pdf` downloads only the selected
  current version.
- Credential evidence respects its per-record public/private setting.
- Analytics or monitoring provider failure does not block content management.
- Deployment-check ingestion rejects missing or incorrect secrets.
- The production smoke workflow detects broken internal routes and assets.
- Content JSON, audit CSV, and asset-manifest exports contain no secrets or
  signed URLs.
- Public pages continue serving after Supabase becomes unavailable following a
  successful deployment.
- Admin and intentional public-card changes are reviewed at 360px, 768px,
  1024px, and 1440px.
- Keyboard navigation, visible focus, drawer operation, block reordering, error
  summaries, and reduced motion meet WCAG 2.2 AA expectations.
- `npm run typecheck`, the Playwright/axe suite, RLS tests, post-deployment smoke
  checks, and `npm run build` pass.

### Assumptions

- The portfolio remains a personal, non-commercial public test deployment on
  Vercel Hobby.
- English remains the initial language.
- The two Gmail addresses will be supplied securely during authentication setup
  and never committed.
- No sample project, credential, client, outcome, or metric will be invented.
- Cloudflare R2 is the live asset store; Google Drive is optional manual backup
  storage.
- The current visual baseline remains authoritative. The simplified project
  cards and project-page cover are intentional content-driven deviations and
  require screenshot review before updating the approved-baseline commit.
- Contact-form backend processing, AI Signal automation, chatbot, inquiry inbox,
  FastAPI, n8n, automatic email, and automated Drive backup remain future
  phases.
