# Booking security and production configuration

The custom calendar submits to the same-site `/api/booking` endpoint. It verifies
Turnstile, checks fresh availability, reuses existing contacts without editing
them, and creates an appointment in the configured GHL calendar.

## Production configuration

Set these variables in Vercel's Production environment before deploying:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical HTTPS origin, currently `https://artkincarreon.vercel.app` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public site key for a Managed Turnstile widget |
| `TURNSTILE_SECRET_KEY` | Matching real server-only Turnstile secret |
| `GHL_PRIVATE_INTEGRATION_TOKEN` | Server-only GHL private integration token |
| `GHL_LOCATION_ID` | Subaccount containing the calendar |
| `GHL_CALENDAR_ID` | Calendar used by the existing notification workflows |

The GHL integration needs `calendars.readonly`, `calendars/events.write`,
`contacts.readonly`, and `contacts.write`. Keep duplicate contacts disabled in
GHL. A race or conflicting phone number fails safely rather than overwriting
an existing contact. Returning clients' name, phone and company are not changed
by an unauthenticated booking submission.

In Cloudflare, allow the exact canonical production hostname. The form sends
the `portfolio_booking` action. The server requires success, that exact action,
and a hostname matching `NEXT_PUBLIC_SITE_URL`. Missing configuration, dummy
production secrets, failed verification and verification outages block booking.
Production booking through an alternate preview hostname is rejected.

Add secrets directly to ignored `web/.env.local` or the Vercel dashboard;
never paste them in chat or commit them. Public variables are embedded at build
time, so changing them requires a new deployment. Preserve local GHL settings
before pulling Vercel variables into the same file.

## Local testing

Development uses Cloudflare's official visible test site key and matching test
secret. Real production secrets reject dummy tokens. The widget appears on the
Details step, above consent. Use a normal browser to verify the real production
widget if an automated embedded browser fails its challenge.

Run `node --test scripts/security.test.mjs` from `web` for mocked security checks
without creating contacts, appointments or sending notifications.

## Abuse protection

Availability uses a 30-second server/CDN cache; submitting always checks fresh
GHL availability and keeps GHL's free-slot validation enabled. Public APIs have
bounded request bodies and per-instance burst limits. The in-memory limiter is
not a distributed DDoS defense: use Vercel edge rate limits for coordinated or
sustained abuse. CAPTCHA is not email ownership verification, so impersonation
and booking spam cannot be eliminated by this implementation alone.

References:

- [Cloudflare server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [GHL contact lookup](https://marketplace.gohighlevel.com/docs/ghl/contacts/get-duplicate-contact/)
