# Selective portfolio refresh

Baseline 2: `a8b9202ee181dbaa7c1eb87d445a1b4092107075` (2026-09-10).

## Approved scope

Keep the current public fonts, buttons, navigation, record cards, factual content,
and portrait assets/animation. Apply only the selected proposal ideas: editorial
hero with a blue emphasis, desktop CV underline link, footer social links, and a
four-step project engagement strip. Alternate the homepage's paper and muted
tinted surfaces in both themes. Improve responsive consistency and general
scroll reveals across public routes, without changing admin functionality.

## Phases and verification loop

- [x] Snapshot current portfolio as Baseline 2; capture 360/768/1024/1440 views.
- [x] Implement hero, engagement strip, CV link, footer, and alternating surfaces.
- [x] Align public responsiveness and update non-image scroll motion.
- [x] Run typecheck/build, focused regression tests, and a bounded visual review.
- [x] Fix findings together, confirm once, document results, and commit.

Use one implementation pass, one batched desktop/mobile and light/dark review,
one repair batch, and at most one confirmation pass. Do not deploy or replace
the approved baseline pointer with the refreshed design before visual approval.

## Additional requested repair and detail-page refinement

- Restore published project and credential displays on the homepage, indexes,
  and individual routes. The live records remain unchanged.
- Read published content at request time with Next.js `connection()` and native
  `fetch` set to `no-store`. This avoids retaining empty build-time results.
  Remove the detail routes' build-time slug allowlists so newly published records
  can resolve without a rebuild. The sitemap uses the same current records.
- Give project introductions the full reading width, move metadata beneath the
  introduction, and tighten document-section spacing.
- Place credential evidence beside its skills/project record on wide screens;
  use full-width reading areas on phones. Keep inline evidence, original-file
  access, and the bottom-right verification action.
- Reuse current fonts, theme tokens, buttons, and linked credential cards.
  No content, publication status, database permissions, or admin behavior changed.

## Validation results

- Production build and standalone TypeScript check pass.
- 21 Node regression tests pass (public cache policy, scroll reveals, themes).
- 43 Playwright public/theme tests pass against the production server, including
  real published cards and detail URLs, keyboard navigation, accessibility,
  mobile layout, theme persistence, and the CV's nonempty `%PDF-` response.
- Homepage, indexes, and representative detail pages captured in both themes at
  360, 768, 1024, and 1440 pixels; no horizontal overflow. Review images are local
  generated artifacts in `.impeccable/refresh-review/` and confirmation images
  in `.impeccable/refresh-final/` (not application assets).
- Compared with Baseline 2: larger editorial homepage headline, alternating
  muted panels, readable phone text, quieter non-image reveals, and reorganized
  detail metadata/evidence. Portrait files/component and trace/settle keyframes
  are byte-identical to Baseline 2.
- Corrected low-contrast metadata labels on tinted panels and dark CTA hover
  text. Credential PDFs use whole-page fitting; the original-file link remains.
- The final all-record check also passes in development mode, including the
  related-project arrow's 16px dimensions. Development is running on port 3000.
- Public evidence returns a valid PDF (200, application/pdf, 267736 bytes).
  Both missing-record routes return 404; sitemap includes current detail URLs.
- No deployment or database mutation performed. Baseline 2 remains the approved
  reference while the user reviews this selectively refreshed version.

## Follow-up: sandbox buttons and card-only credential tint

The user requested the sandbox action treatment: public primary buttons now use
the theme's blue accent, 14px sentence-case Roboto labels, and 46px minimum height.
The hero's secondary action is a plain text-and-arrow link. Admin buttons are
unchanged. The homepage credential section no longer has a tinted background or
extra panel padding: only its cards use paper-grey/light and green-grey/dark.
Process and project inquiry panels remain unchanged.

Reviewed the homepage at 360/768/1024/1440 pixels in both themes, with no horizontal
overflow. Compared with Baseline 2 and the previous refresh, this changes only
action styling and the placement of the credential tint. Typography family,
portrait motion, navigation destinations, and published content are preserved.
Typecheck and the design detector pass. Screenshots: local ignored
`.impeccable/refresh-final/buttons-*.png`.
The sandbox-action regression passes. The broader navigation test exceeded its
5-second assertion window; an independent browser check confirmed the unchanged
Explore my work destination succeeded in 9.3 seconds. This follow-up does not
claim a fully green rerun of the broader suite or change the data-loading policy.

## Follow-up: fluid public typography and social icons

Public text now scales with the main content container, excluding the desktop
sidebar. Headings, card titles, body text, metadata, process labels, and actions
share fluid sizes; long-form prose retains a 16px minimum. Side-by-side card
placement, the current font family, portrait animation, and admin styles remain
unchanged. Compared with Baseline 2, phone typography is proportionally smaller
without changing the approved section order or desktop navigation.

The shared footer replaces Email, GitHub, and LinkedIn text/arrow links with
monochrome icons, blue hover/focus treatment, accessible labels, and 44px touch
targets. Existing destinations and the Privacy text link are preserved.

Typecheck and the changed-target design detector pass. The fluid-type browser
regression passes across all six public top-level routes and the four published
detail pages at 360/768/1024/1440px, with no horizontal overflow. The footer icon
regression passes at those widths in light and dark modes, checking destinations,
icon visibility, touch targets, and keyboard focus. Local ignored screenshots:
`.impeccable/refresh-final/type-*.png` and `socials-*.png`.
These are targeted checks, not a new full-suite or production-build claim.
