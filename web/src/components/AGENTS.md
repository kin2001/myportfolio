# Component rules

- Follow `docs/DESIGN_SYSTEM.md` and preserve the approved visual and motion
  baseline.
- Prefer composition and existing tokens over duplicated variants.
- Preserve semantic HTML, keyboard behavior, visible focus, 44px targets, and
  reduced-motion behavior.
- `site-shell.tsx`, `admin-shell.tsx`, `icons.tsx`, `section-header.tsx`, and
  shared navigation behavior are lead-owned.
- Do not add client state when static rendering is sufficient.
- For navigation changes, test sequential, skipped, reverse, direct-hash, mobile,
  and manual-scroll behavior.
