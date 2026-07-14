# File ownership

The lead owns integration and all shared infrastructure. Worktree ownership must
be explicitly assigned and non-overlapping.

| Workstream | Writable paths | Restricted paths |
|---|---|---|
| Lead/foundation | `web/src/app/globals.css`, root/site layouts, `web/src/components/site-shell.tsx`, `admin-shell.tsx`, `icons.tsx`, `section-header.tsx`, `web/src/lib/content.ts`, package/config files | None |
| Home/About | `web/src/app/(site)/page.tsx`, `web/src/app/(site)/about/**` | Shared shell, globals, Work, Contact |
| Projects | `web/src/app/(site)/work/**`, approved project assets | Home, Contact, shared shell/globals/content |
| Credentials | `web/src/app/(site)/credentials/**` | Home, Projects, shared shell/globals/content |
| Contact | `web/src/app/(site)/contact/**`, `web/src/components/contact-form.tsx` | Backend/API work, shared shell/globals |
| Admin UI | `web/src/app/admin/**` page files | Shared `admin-shell.tsx`, auth/database implementation, public shell |
| SEO | `web/src/app/sitemap.ts`, `web/src/app/robots.ts`, approved public metadata | Root layout without lead approval |
| Review agents | None | All files |

`web/src/lib/content.ts` is a shared data file used by Home, Work, project
details, Credentials, About, and Sitemap. Workers submit requested content
changes to the lead rather than editing it concurrently.

The downloaded `stitch_ai_systems_laboratory/**` reference is read-only.
