# Cloudflare Turnstile setup

## What is implemented

- The Contact form renders Turnstile explicitly so it works after Next.js
  client navigation and remounts.
- The compact, interaction-only widget fits the current mobile form.
- Missing tokens block submission, errors are announced, and used tokens are
  reset after every API attempt.
- Local development uses Cloudflare's public always-pass test site key when no
  local site key is configured.
- Production fails closed when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is missing.

This is the browser half only. Cloudflare requires the future inquiry API to
validate each token with Siteverify inside the same endpoint that stores or
delivers the inquiry. Until that API exists, the Contact form remains honest
that no inquiry was sent.

## What Artkin must configure

1. In Cloudflare Dashboard, open **Turnstile** and create a widget named
   `Artkin Portfolio Contact`.
2. Choose **Managed** mode and add the exact production hostnames:
   - The final custom domain.
   - The stable Netlify production hostname only if visitors can still use it.
3. Do not add `localhost` to the production widget. Keep pre-clearance disabled
   unless the whole site later uses Cloudflare clearance cookies.
4. Copy the generated site key and secret key. The site key is public. The
   secret key must never be pasted into chat, committed, logged, or exposed to
   the browser.
5. In Netlify production environment variables, set:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the production site key.
   - `NEXT_PUBLIC_API_URL` to the future deployed inquiry API origin.
6. Trigger a fresh Netlify deployment because `NEXT_PUBLIC_*` values are placed
   into the browser bundle at build time.
7. In the future FastAPI/Koyeb service, store the secret as a server-only Koyeb
   Secret named `TURNSTILE_SECRET_KEY`. Also configure:
   - `TURNSTILE_EXPECTED_HOSTNAME=<final-domain>`
   - `TURNSTILE_EXPECTED_ACTION=contact_inquiry`

Codex does not need either production key. Add them directly in the service
dashboards.

## Required API validation

Before an inquiry is stored, emailed, or processed, the API must:

1. Reject a missing token or a token longer than 2,048 characters.
2. Send the token and server-only secret to
   `https://challenges.cloudflare.com/turnstile/v0/siteverify` with a short
   timeout.
3. Require `success: true`, the exact expected hostname, and the
   `contact_inquiry` action.
4. Fail closed on Cloudflare errors or timeouts and never log the token.
5. Validate all inquiry fields and consent again on the server.

Turnstile tokens expire after five minutes and are single-use. A separate
verify-only endpoint is not protection because an attacker can bypass it.

## Safe local testing

Cloudflare's official dummy keys work on localhost:

- Always-pass site key: `1x00000000000000000000AA`
- Always-pass server secret: `1x0000000000000000000000000000000AA`
- Always-fail site key: `2x00000000000000000000AB`
- Always-fail server secret: `2x0000000000000000000000000000000AA`

Production secrets reject dummy tokens. Never use the dummy secret in
production.

Official references:

- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
