# Artkin Carreon — Portfolio Frontend

Next.js implementation of Artkin Carreon's AI automation portfolio. The visual system is adapted from the downloaded Google Stitch reference in ../stitch_ai_systems_laboratory.

## Run locally

    npm install
    npm run dev

Open http://localhost:3000.

## Validation

    npm run typecheck
    npm run build

Webpack is selected explicitly because this Windows environment falls back to WebAssembly SWC bindings, which Turbopack does not support.

## Content rules

- Public projects come from src/lib/content.ts until the API is connected.
- projects and credentials intentionally start empty.
- Do not add sample clients, metrics, employers, testimonials, or credentials.
- Publish only records that have been verified and approved.

## Environment

Copy .env.example to .env.local and fill in local values. Only variables prefixed with NEXT_PUBLIC_ are exposed to the browser.

The contact form requires the FastAPI service before it can transmit inquiries. Without NEXT_PUBLIC_API_URL, it fails safely and states that no message was sent.
