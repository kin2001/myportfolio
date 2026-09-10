# Public dark mode

Implemented 2026-08-27. Awaiting the user's visual review; the approved-baseline
pointer and earlier uncommitted work are unchanged.

## Design and behavior

- Public pages use charcoal surfaces, warm off-white type, and muted indigo
  accents. Existing light-mode tokens, typography, spacing, and scroll behavior
  remain intact. The private admin area retains its light theme.
- One icon-only sun/moon button is shared by the desktop sidebar and mobile
  header. Its accessible label names the next action; the target is 44 by 44px.
- The first visit follows the system preference. An explicit selection is saved
  as `portfolio-theme`; a static head script applies it before first paint.
- A user-triggered switch reveals the new theme in a circle expanding from the
  icon's center over 540ms. Native View Transitions provide the snapshots; CSS
  supplies the mask. No animation package or page-navigation animation was added.
- Reduced motion and unsupported browsers switch immediately. Repeated clicks
  skip the older transition; transition-only styles are cleared afterward.
- The contact form retains entered text. Turnstile is recreated in the selected
  theme and its previous verification token is discarded.

## Portrait assets

The original `artkin-hero.webp` and `artkin-about.webp` files are unchanged.
Dark-only derivatives were edited with Imagegen from those references:

| Asset in `web/public` | Dimensions | Bytes |
| --- | --- | --- |
| `artkin-hero-dark.webp` | 1024 × 1024 | 57,578 |
| `artkin-about-dark.webp` | 1024 × 1024 | 36,470 |

The editing brief requested the same identity, pose, clothing, and monochrome
treatment on a charcoal background, without text or a visible photo panel.
Generation did not provide reliable transparency, so the shipped images use
charcoal mattes, a lightening blend, and a soft bottom fade. Sharp was used only
to resize and encode the generated assets as WebP. Project screenshots and
credential evidence are not recolored.

## Validation

- `npm run typecheck` and `npm run build` passed.
- `node --test scripts/theme.test.mjs`: 12 checks passed, including storage
  fallback, system preference, cross-tab changes, interrupted transitions,
  radius coverage, reduced motion, and dark-palette contrast.
- The bounded Impeccable detector returned no findings for the changed controls,
  sidebar, and shared stylesheet.
- In-app browser: Home heading and portrait bounds match the pre-change layout
  at 360, 768, 1024, and 1440px in both themes. Icon controls were checked at all
  four widths; desktop circular reveal, persistence, mobile drawer/Escape,
  About, Work, Credentials, Privacy, the 404 theme, contact-text preservation,
  and admin-light isolation were checked.
- `tests/theme.spec.ts` adds repeatable Playwright/axe coverage. Tests were
  discovered and typechecked, but that separate browser suite was not executed
  in this task. Native keyboard activation still needs that suite or manual
  confirmation; the in-app test driver's synthetic Enter did not activate the
  native button.
- A 4px narrow-screen overflow was observed when the existing Turnstile widget
  loaded on Contact at 360px. Its layout was not changed as part of the icon and
  transition refinement; it remains a separate responsive follow-up.

## Implementation references

- [Native view transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
- [Interrupted transition behavior](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/skipTransition)
- [Turnstile theme options](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
