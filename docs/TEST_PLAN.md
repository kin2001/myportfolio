# Test plan

## Required for every code change

From `web/`:

1. Run `npm run typecheck`.
2. Run the smallest browser scenario that reproduces the changed behavior.
3. Check browser warnings and errors.
4. Confirm no unrelated files are staged.

## Required for structural or release changes

1. Run `npm run build`.
2. Test public routes: `/`, `/work`, one valid project when available,
   `/credentials`, `/about`, `/contact`, and `/privacy`.
3. Test admin UI routes without claiming authentication works.
4. Test at 360px, 768px, 1024px, and 1440px.

## Navigation and motion scenarios

- Home hero has no active sidebar item.
- Direct section links select the correct item.
- Projects → Systems → AI Signal works sequentially.
- Projects → AI Signal and Home → AI Signal do not flash intermediate active
  items.
- Reverse section jumps do not flicker.
- Manual scrolling resumes automatic active-section tracking.
- Work and project-detail routes keep Projects active.
- Credentials, About, and Contact routes select themselves.
- Mobile drawer closes after navigation.
- Reduced-motion mode removes smooth motion without breaking navigation.

## Accessibility checks

- Keyboard access and visible focus.
- Logical landmarks and headings.
- Useful link names and form labels.
- Status messages announced by assistive technology.
- No hover-only information.

## Content and safety checks

- Only published, verified projects are public.
- No fabricated metrics or credentials.
- With no API configured, Contact clearly states that nothing was sent.
- No secrets appear in source, browser bundles, documentation, or Git history.
