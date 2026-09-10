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

## Follow-up: specialty-led copy and coordinated public motion

The reused homepage/About approach section now leads with GoHighLevel workflows
and AI automation, with blue emphasis and three readable headline lines on wide
screens. Its supporting skills cover CRM workflows, AI-assisted inquiries with
human review, and n8n/API integrations. No clients, metrics, or new project facts
were added. The existing font and fluid sizing remain in place.

Motion uses the existing shared reveal controller: masked page-title entrances
with a capped 160ms word stagger, bounded sibling-card entrances, and short
detail-page introductions/actions. The specialty rows enter left-to-right with
blue rules to connect the headline to the skills. Reading content still reveals
once; portrait/media replay, portrait assets, and their keyframes are unchanged.
Switching to reduced motion now also stops in-progress heading animations.

Compared with Baseline 2 at 360/768/1024/1440px, the intentional differences are
specialty-first copy, blue headline emphasis, and coordinated non-image motion;
section order and side-by-side composition remain. Light/dark specialty previews
are saved locally under `.impeccable/refresh-final/specialty-*.png` (ignored).
Typecheck, nine controller regression tests, and the changed-target design
detector pass. Browser coverage passes for all six top-level public routes and
four published detail routes, checking reveal activation, four viewport widths,
no horizontal overflow, and live reduced-motion switching. The PDF-page test
explicitly waits for hydration after DOMContentLoaded. No new dependencies,
deployment, or approved-baseline pointer changes.

## Follow-up: replay scroll motion across public pages

At the user's request, the shared controller now resets every reveal group after
it leaves the viewport, not just portrait/media groups. Headings also clear their
previous animation before re-entry. Existing durations, image motion, typography,
and layout remain unchanged. Focused groups stay visible, and reduced-motion
users see all content without replay. This supersedes the earlier reveal-once
decision for reading content.

Typecheck, the changed-target detector, and ten controller tests pass. Browser
checks pass for two repeated down/up scroll cycles at 360/768/1024/1440px across
the six top-level public routes and four published detail routes, plus the
homepage keyboard-focus regression. The viewport height is 400px for the replay
test so short index pages can fully leave the screen. No horizontal overflow;
relative to Baseline 2, this follow-up changes replay behavior only, preserving
the currently implemented visual refinements and portrait treatment.

## Follow-up: modern public button and card hover

Public project/credential cards now lift 3px with a subtle blue-tinted surface,
blue border, and blue title instead of a title underline. Primary buttons lift
2px and switch to ink/paper contrast; secondary buttons use a light accent tint,
and action arrows move 3px. No shadows or layout-size changes were introduced.
The homepage's duplicate-label wipe was removed so its buttons share the same
styles as other public pages. Card lift uses the independent translate property
to coexist with scroll entrance transforms. Admin styling is unchanged.

Keyboard focus retains a visible outline and color feedback. Hover movement is
restricted to fine pointers with hover support; reduced motion removes movement
but retains color feedback. Compared with Baseline 2 at 360/768/1024/1440px,
the intended changes are the hover colors and bounded movement, not resting
layout, typography, or portrait animation.

Typecheck and the design detector pass. Browser checks pass in both themes at
all four widths on home, project index, and credential index, including touch
emulation, keyboard focus, reduced motion, and no horizontal overflow. The two
existing homepage card/link interaction regressions also pass. Local ignored
previews: `.impeccable/refresh-final/hover-*.png`. No dependencies or deployment.

## Follow-up: About background typography

Replaced the four-column profile facts with a two-column editorial section:
"Engineering roots. Automation in practice." alongside a short education and
current-focus summary. The university, degree, location, and graduation date are
preserved; availability now reads "Open for projects" rather than "Open to
freelance." This intentional departure from Baseline 2 removes the boxed fact
layout while retaining the current fonts, fluid type sizes, blue accents, and
portrait treatment. No new professional claims or dependencies were added.

Typecheck, production build, and the design detector pass. The About regression
checks the replacement content, preserved date, and two-column layout in both
themes at 360/768/1024/1440px, with no horizontal overflow. Compared at those
widths: less label repetition, a clearer headline/body hierarchy, and consistent
text scaling. Local ignored previews: `.impeccable/refresh-final/about-background-*.png`.

## Follow-up: remove repetitive About messaging

The user rejected the background-story treatment as repetitive for a professional
portfolio. Removed that added section. The About header now leads with Artkin's
name and role, a short description of his work, and one compact education note.
The closing section is a direct project invitation rather than another specialty
summary. "Open for projects" stays. Compared with Baseline 2 and the prior edit,
this is a content/hierarchy reduction; fonts, portrait, responsive composition,
and shared motion are unchanged. Typecheck, design detector, and the updated
About regression pass across both themes at 360/768/1024/1440px, with no overflow.
Local ignored previews: `.impeccable/refresh-final/about-profile-*.png`.

## Follow-up: distinct Selected project layout on About

Replaced the Selected system block's repeated two-column composition with a
full-width project summary, a three-column capability row, and a direct View
project link. Removed the enclosing tinted box, repeated clinic metadata, and
technical record label; the preceding Approach and homepage are untouched.
The existing clinic facts remain, explicitly framed as a personal project.

Compared with Baseline 2 and the previous block at 360/768/1024/1440px, the
intentional change is a flatter editorial composition with horizontal capability
groups. Shared font sizing, colors, hover, and scroll replay remain. Typecheck,
the design detector, and About browser checks pass in both themes, including
three-column phone placement and navigation to the published project. Local
ignored previews: `.impeccable/refresh-final/about-project-*.png`. Production
build also passes.
