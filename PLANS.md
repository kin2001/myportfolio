# Lead portfolio workflow

Use this sequence for substantial portfolio work. Small fixes may skip worktree
creation but must keep the same ownership and validation rules.

## Phase 0 — Baseline

1. Read `AGENTS.md`, `DESIGN.md`, and the relevant nested instructions.
2. Confirm the baseline commit and working-tree status.
3. Record existing validation failures before changing code.
4. Capture affected routes at the required viewport sizes.

Read the approved visual and motion commit from `docs/APPROVED_BASELINE.md`. Do
not perform a general cleanup or redesign before recording evidence.

## Phase 1 — Read-only discovery

Run only the agents needed for the request, up to five in parallel:

- `repository_mapper`
- `ux_auditor`
- `content_strategist`
- `accessibility_reviewer`
- `performance_reviewer`
- `docs_verifier` when version-sensitive behavior is involved

Wait for every requested report. Agents report facts and defects; they do not
edit application files.

## Phase 2 — Lead plan

The lead consolidates findings into:

- exact scope and acceptance criteria
- writable and restricted paths
- design and motion invariants
- dependencies and merge order
- validation commands and browser scenarios

Update the relevant files under `docs/`. Do not start concurrent implementation
until writable paths do not overlap.

## Phase 3 — Implementation

- The current foundation already exists. Add a foundation task only when a
  verified shared-system defect requires it.
- For substantial isolated work, create a separate Codex desktop worktree task
  and assign it the `frontend_worker` instructions and exact writable paths.
  Never run a substantial writable worker as a subagent in the lead's shared
  checkout.
- Start feature worktrees from the latest validated main branch.
- The lead owns global styles, the root layout, shared navigation shell, package
  files, and final integration.
- Preserve the current design and motion unless the user explicitly approves a
  change.

## Phase 4 — SEO and discoverability

After major public pages and verified content exist, create a separate worktree
task using `seo_agent`. Restrict it to the SEO-owned paths in
`docs/FILE_OWNERSHIP.md`; the lead applies any required root-layout or
feature-page metadata patch.

## Phase 5 — Integration and release review

After integration, run the relevant read-only reviewers in parallel:

- `code_reviewer`
- `accessibility_reviewer`
- `performance_reviewer`
- `browser_qa`

The lead fixes only confirmed defects, runs the full applicable test plan, and
creates a descriptive Git commit. Never stage unrelated user files.
