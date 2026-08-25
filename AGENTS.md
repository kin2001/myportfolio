# Portfolio engineering instructions

## Product objective

Build a credible, fast, accessible portfolio for Artkin Carreon that presents
verified AI and workflow-automation work to small-business decision-makers.

## Visual and motion contract

The current interface is the approved baseline. Preserve it unless the user
explicitly requests a redesign.

Sources of truth, in order:

1. The current commit recorded in `docs/APPROVED_BASELINE.md`.
2. `DESIGN.md`.
3. `stitch_ai_systems_laboratory/DESIGN.md` and `screen.png`.
4. The implemented tokens and behavior in `web/src/app/globals.css` and
   `web/src/components/site-shell.tsx`.

Required characteristics:

- Fixed 280px desktop sidebar and responsive 64px mobile header/drawer.
- Warm paper canvas, 16px dot grid, Geist/Geist Mono, indigo accents.
- Square, border-defined modules without decorative shadows.
- Current spacing, typography hierarchy, portrait treatment, and section order.
- Smooth section navigation without sidebar highlight flicker.
- Automatic active-section tracking after navigation finishes.
- Reduced-motion behavior from `prefers-reduced-motion`.

Any intentional visual or motion change must be compared with the baseline at
360px, 768px, 1024px, and 1440px and reported to the user. After explicit user
approval, the lead updates `docs/APPROVED_BASELINE.md` to the new commit.

## Impeccable and Ponytail workflow

Use both skills for frontend, interaction, responsive, or UX work:

- `impeccable` owns design consistency, hierarchy, usability, accessibility,
  responsive behavior, UX copy, and the bounded visual review.
- `ponytail:ponytail` in full mode owns implementation simplicity: reuse the
  current system, prefer native platform behavior, avoid new dependencies, and
  write the smallest coherent change that preserves the design decision.
- The user's request and this repository's visual contract override generic
  skill preferences. Ponytail must not simplify away accessibility, security,
  data safety, or approved motion and responsive behavior.

For each UI task:

1. Run Impeccable's context loader once for the affected route or source file.
2. Treat public portfolio surfaces as `Experience` mode and admin/editor
   surfaces as `Operate` mode.
3. Load only the Impeccable playbook that owns the task. Prefer `distill` and
   `clarify` for confusing workflows, `adapt` for responsive fixes, and
   `audit` or `polish` for the final bounded review.
4. Inspect the approved baseline, `DESIGN.md`, and one implemented source of
   visual truth before editing.
5. Apply Ponytail's ladder while implementing the approved direction.
6. After UI edits, run the Impeccable detector once on the changed targets,
   then verify desktop and mobile together. Fix findings in one batch and do
   at most one confirmation pass.

Do not let either skill trigger an unsolicited redesign, invented content, an
open-ended polish loop, or a new dependency when the existing system suffices.

## Agent workflow

- The lead task is the orchestrator and integration owner; it does not compete
  with feature workers for the same files.
- Use read-only subagents for mapping, audits, research, debugging, and review.
- Use worktree tasks only for substantial, isolated implementation with exact
  writable paths.
- Keep agent depth at one. Subagents must not create their own swarms.
- Never assign overlapping writable paths concurrently.
- Inspect before editing and make the smallest coherent change.

## Lead-owned shared files

Only the lead may modify these unless it grants explicit, narrow ownership:

- `web/package.json` and lockfiles
- `web/tsconfig.json`, `web/next.config.*`, and `web/postcss.config.*`
- `web/src/app/layout.tsx` and `web/src/app/globals.css`
- `web/src/app/(site)/layout.tsx`
- `web/src/components/site-shell.tsx`
- `web/src/components/admin-shell.tsx`
- `web/src/components/icons.tsx`
- `web/src/components/section-header.tsx`
- `web/src/lib/content.ts` until it is deliberately split by feature
- `web/tailwind.config.*`, `web/eslint.config.*`, and `netlify.toml`
- root workflow and design documentation

Workers must report required shared-file changes instead of editing them.

## Content and scope rules

- Never invent clients, employers, dates, metrics, outcomes, technologies,
  credentials, testimonials, or project facts.
- Keep unverified projects and credentials unpublished.
- Do not add a database, API, authentication, email delivery, or other backend
  service until the user explicitly requests it.
- Do not expose secrets or commit `.env` contents.

## Coding and validation

- Use the `ponytail:ponytail` skill in full mode for coding changes.
- Reuse the current code and native platform features before adding abstractions
  or dependencies.
- Preserve semantic HTML, keyboard behavior, visible focus, responsive layout,
  and reduced-motion support.
- Run the applicable scripts from `web/package.json`; at minimum run
  `npm run typecheck`, plus `npm run build` for release or structural changes.
- Verify interaction or layout changes in the local browser at relevant sizes.
- After each requested change is implemented and verified, create a descriptive
  Git commit without staging unrelated user files.
