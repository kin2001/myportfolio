# Current architecture

## Repository

- `web/`: active Next.js application.
- `stitch_ai_systems_laboratory/`: downloaded visual reference; read-only.
- `DESIGN.md`: personalized design contract.
- `.codex/`: repository agent configuration and definitions.

## Application stack

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript 5.9.3
- Tailwind CSS 3.4.19 plus global CSS tokens
- npm and `package-lock.json`
- Local baseline runtime: Node 24.15.0 and npm 11.12.1
- Netlify configuration in `netlify.toml`

There is no backend or database. The contact form validates locally and fails
safely when `NEXT_PUBLIC_API_URL` is absent.

## Public routes

| Route | Source |
|---|---|
| `/` | `web/src/app/(site)/page.tsx` |
| `/work` | `web/src/app/(site)/work/page.tsx` |
| `/work/[slug]` | `web/src/app/(site)/work/[slug]/page.tsx` |
| `/credentials` | `web/src/app/(site)/credentials/page.tsx` |
| `/about` | `web/src/app/(site)/about/page.tsx` |
| `/contact` | `web/src/app/(site)/contact/page.tsx` |
| `/privacy` | `web/src/app/(site)/privacy/page.tsx` |

`web/src/app/(site)/layout.tsx` applies the shared `SiteShell`.

## Admin routes

`/admin`, `/admin/login`, `/admin/projects`, `/admin/projects/new`,
`/admin/credentials`, `/admin/inquiries`, and `/admin/settings` use
`web/src/components/admin-shell.tsx`. These are interface prototypes only.

## Shared components

- `site-shell.tsx`: desktop/mobile navigation and active-section tracking.
- `contact-form.tsx`: client validation and optional API request.
- `section-header.tsx`: numbered section-heading pattern.
- `icons.tsx`: shared inline icon system.
- `admin-shell.tsx`: admin layout and navigation.

## Content

`web/src/lib/content.ts` contains typed profile, capability, process, project,
and credential data. Project and credential arrays are intentionally empty
until evidence is supplied.

No `/resume.pdf` exists; current Resume and Download CV links lead to About.
The README mentions `.env.example`, but that file is not currently present.

## Rendering and discoverability

- Public pages are server components unless interaction requires a client
  boundary.
- `site-shell.tsx` and `contact-form.tsx` are client components.
- `robots.ts` blocks admin and API paths.
- `sitemap.ts` includes static public routes and published projects.

## Validation commands

From `web/`:

```text
npm run typecheck
npm run build
npm run dev
```

No lint or automated-test script is currently configured. Do not claim those
checks passed or add dependencies without lead approval.

The Git repository has no remote configured at this baseline.

## Baseline validation — 2026-07-14

- `npm run typecheck`: passed.
- `npm run build`: passed; 18 routes were generated or registered.
- The build reports that the Windows native SWC binary is not a valid Win32
  application, then succeeds through the expected WebAssembly fallback used by
  the explicit webpack scripts.
- Lint and automated browser/unit tests were not run because no corresponding
  package scripts exist.
