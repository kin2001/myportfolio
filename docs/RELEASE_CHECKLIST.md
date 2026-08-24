# Release checklist

## Content

- [ ] At least two verified case studies are complete.
- [ ] Every client asset and claim has permission.
- [ ] At least one verified credential is connected to applied work.
- [ ] Resume, contact details, and external links are confirmed.
- [ ] No placeholder or fictional proof remains.

## Visual and interaction fidelity

- [ ] Current design contract is preserved.
- [ ] Desktop sidebar and mobile drawer work at target sizes.
- [ ] Sidebar active states and skipped-section animations do not flicker.
- [ ] Hero portrait crop and soft lower mask remain aligned.
- [ ] Reduced-motion behavior works.

## Functionality and accessibility

- [ ] Public routes and internal links work.
- [ ] Keyboard navigation and focus states work.
- [ ] Images have accurate alternative text.
- [ ] Forms expose labels, errors, and honest delivery status.
- [ ] The contact page does not claim an inquiry was sent while the inquiry
      backend is deferred, and its direct contact links work.
- [ ] `NEXT_PUBLIC_API_URL` remains empty until the inquiry backend exists.
- [ ] Admin and draft paths are not indexed.

Production Turnstile hostname checks and server-side token validation are a
gate for the future inquiry-backend release, not for Admin v1.

## SEO and semantic structure

- [ ] `NEXT_PUBLIC_SITE_URL` is set to the final public HTTPS domain.
- [ ] Every public page has unique metadata and one clear H1.
- [ ] Heading order is logical without changing the approved typography.
- [ ] Canonical URLs, Open Graph metadata, sitemap, and robots are verified.
- [ ] Structured data is truthful and matches visible content.
- [ ] Internal links are descriptive and indexable routes are intentional.

## Quality

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Browser console has no relevant errors or warnings.
- [ ] Responsive browser QA passes at 360px, 768px, 1024px, and 1440px.
- [ ] Code, accessibility, performance, and SEO reviewers have no unresolved
      critical findings.
- [ ] Git status contains no unintended staged files or secrets.
