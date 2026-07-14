# Route implementation rules

- Preserve the current route structure and shared `SiteShell`.
- Reuse global tokens and existing component language; do not introduce a page-
  specific visual system.
- Keep public pages server-rendered unless interaction requires a client
  component.
- Preserve metadata, semantic headings, responsive layouts, and empty states.
- Do not edit `layout.tsx`, `globals.css`, `sitemap.ts`, or `robots.ts` without
  lead ownership.
- Admin pages are frontend prototypes; do not imply authentication or persistence
  works.
