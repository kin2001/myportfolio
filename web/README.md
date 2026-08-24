# Artkin Carreon — Portfolio

Next.js portfolio and private publishing interface. The visual system is adapted from the downloaded Google Stitch reference in `../stitch_ai_systems_laboratory`.

## Run locally

    npm ci
    npm run dev

Open http://localhost:3000.

## Validation

    npm run typecheck
    npm run test:smoke
    npm run test:e2e
    npm run build

Webpack is selected explicitly because this Windows environment falls back to WebAssembly SWC bindings, which Turbopack does not support.

## Publishing

- Public projects and credentials are generated from immutable Supabase publication snapshots during Vercel builds.
- Drafts, CV history, audit records, asset metadata, and private evidence are admin-only.
- Supabase Storage stores private originals and optimized public derivatives.
- Do not add sample clients, metrics, employers, testimonials, or credentials.
- Publish only records that have been verified and approved.

## Environment

Copy .env.example to .env.local and fill in local values. Only variables prefixed with NEXT_PUBLIC_ are exposed to the browser.

See `../docs/ADMIN_SETUP.md` for the external Supabase, Vercel, Better Stack, Google OAuth, and GitHub configuration that cannot be created from this repository.
