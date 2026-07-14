# Approved design and motion system

The implemented interface at the commit recorded in
`docs/APPROVED_BASELINE.md` is the visual contract. The downloaded Stitch files
guide fidelity but must remain unchanged.

## Visual character

- Minimal editorial and technical-documentation aesthetic.
- Warm engineering-paper canvas with a subtle 16px dot grid.
- Flat tonal layers and hairline borders; no decorative shadows.
- Sharp 0px structural corners. Circular shapes are reserved for status dots.
- Indigo appears sparingly in active states, focus, metadata, and indicators.

## Implemented tokens

Defined in `web/src/app/globals.css`:

| Role | Token | Value |
|---|---|---|
| Canvas | `--paper` | `#faf9f7` |
| Primary surface | `--paper-pure` | `#ffffff` |
| Secondary surface | `--paper-soft` | `#f4f3f1` |
| Main text | `--ink` | `#1a1c1b` |
| Secondary text | `--ink-soft` | `#454652` |
| Metadata | `--muted` | `#737373` |
| Border/grid | `--line` | `#e5e5e5` |
| Accent | `--accent` | `#24389c` |
| Accent selection | `--accent-soft` | `#dee0ff` |
| Error | `--danger` | `#ba1a1a` |
| Sidebar | `--sidebar` | `280px` |
| Content maximum | `--content` | `1100px` |

## Typography

- Geist Sans: headings and body copy.
- Geist Mono: technical labels, metadata, navigation, and controls.
- Labels are 10px, bold, uppercase, and tracked.
- Metadata is 12px with moderate tracking.
- Large headings use tight tracking and restrained weight.

Do not introduce another font without explicit approval.

## Layout and responsive behavior

- Desktop at 1024px and above: fixed 280px sidebar; main canvas offset by the
  same width.
- Below 1024px: 64px sticky header and drawer navigation.
- Content max-width is 1100px with 32px desktop and 20px mobile gutters.
- Section spacing is 112px desktop and 80px mobile.
- Cards and grids collapse without horizontal overflow.
- Interactive targets remain at least 44px.

## Components

- Buttons: square, 1px border, monospace labels, 160ms state transitions.
- Modules/cards: flat surfaces defined by borders.
- Inputs: transparent with a bottom border and indigo focus state.
- Hero portrait: keep the current responsive square crop and soft lower mask.
- Hero links: Email, GitHub, LinkedIn in that sequence, using the same
  `.hero-link` styling; external profiles open safely in a new tab.
- Sidebar: numbered items, indigo active text/icon/right border.

## Motion contract

- `html` uses smooth section scrolling.
- Hover, focus, button, and link transitions use the existing 160ms easing.
- Clicking a section link immediately selects the destination and locks that
  selection during the smooth scroll, preventing intermediate highlight flicker.
- After the destination is reached, native intersection tracking resumes so
  manual scrolling selects the visible section.
- The home hero has no active sidebar item.
- Dedicated Work, Credentials, About, and Contact routes select their matching
  sidebar item.
- The mobile drawer currently opens and closes without a staged animation.
- Do not add Framer Motion, GSAP, page transitions, or reveal effects unless the
  user explicitly requests them.
- Under `prefers-reduced-motion: reduce`, smooth scrolling and transitions are
  effectively disabled.

## Review gate

For visual or interaction changes, compare the affected route at 360px, 768px,
1024px, and 1440px. Document any intentional difference from this contract.
