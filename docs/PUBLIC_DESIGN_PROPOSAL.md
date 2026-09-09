# Public portfolio design proposal

Prepared 9 September 2026. Status: proposal for approval, not an implementation plan or task tracker. No public application files have been changed for this proposal.

## Recommended direction: connected work, made visible

Keep the recognisable warm paper, indigo accents, green-grey dark surfaces, portrait, desktop sidebar, numbered navigation, and compact project/credential cards. Improve how the site presents the work rather than replacing it with a generic agency template.

The visitor is a small-business decision-maker asking: **What can Artkin help with? Has he built something relevant? Can I understand how it works? How do I contact him?** The homepage should answer those questions in that order. Public surfaces remain an Experience-led portfolio, with reading-friendly detail pages.

## What the audit found

The public templates were inspected in source, with live browser review of the homepage, clinic case study, credential index/detail, About, Contact, and Privacy. Desktop and phone observations informed the proposal; this is a design audit, not a comprehensive accessibility or performance certification.

1. **The first screen introduces you but does not demonstrate your work.** The hero directs people to Email, GitHub, and LinkedIn, followed by a row of counts. A primary “Explore my work” action and a small real-system explanation would make your purpose clearer. Source: `web/src/app/(site)/page.tsx`.
2. **Important text becomes too small on phones.** Live computed styles on `/credentials` at 360px showed 8px section labels, 12px body text, and 14.4px card headings. The phone stylesheet also forces long-form text into narrow side-by-side columns. This preserves placement at the cost of readability. Source: `web/src/app/globals.css`, phone rules beginning around line 615.
3. **Type roles compete.** Public content uses Roboto while the shell uses Geist, with many uppercase monospace labels. Large detail titles, repeated metadata, and small section names do not always match their importance. One deliberate hierarchy would feel more coherent. Source: `web/src/app/layout.tsx`, `web/src/app/globals.css`.
4. **Projects and credentials look too similar in substance.** Reusing cards is good, but text-only project cards do not show what was built. Projects need a truthful visual preview; credentials need a quieter title/issuer/date treatment. Keep related cards consistent across routes.
5. **Detail pages spend too much space before the useful material.** Back, breadcrumb, code label, title, summary, metadata, rules, and gaps can accumulate before the evidence. Credential PDFs also need a controlled reading frame, not an oversized document surface.
6. **Motion is plentiful but repetitive.** Many headings replay a blurred, word-by-word entrance; sections, portrait circuits, card rules, and calls to action animate too. Existing reduced-motion support is valuable. Retain it and give the most expressive movement to explaining an actual workflow. Source: `scroll-reveal.tsx`, `globals.css`, `home.module.css`.
7. **Some public content undermines credibility independently of design.** “Circuits” currently has a troubleshooting/error-like summary. The clinic page includes unrelated-looking circuit imagery and placeholder labels such as “dsdsds” and “gfgdf”. These need your content review, not fabricated replacements. Nothing is unpublished or rewritten as part of this proposal.

## The proposed experience

| Surface | Proposed change |
| --- | --- |
| Homepage | Benefit-led heading with the specialist role still explicit; retain your portrait; clear work/contact actions. Replace the count strip with a compact, labelled explanation of the published clinic workflow. Projects → credentials → approach → inquiry remains the sequence. |
| Projects | Keep full-card links, two-column composition, and no filter/All/view-case-study buttons. Add evidence-backed image or workflow previews and concise summaries. Support additional real projects without filling empty slots. |
| Project details | Shorter page opening, compact facts, meaningful visual early, then readable sections: context, system behaviour, decisions, reliability, evidence, related credentials, inquiry. Use original evidence when available; distinguish explanatory diagrams from screenshots. |
| Credentials | Consistent compact cards: title, issuer, date, restrained credential mark. No categories, filters, or public-record rail. Paper grey in light mode and green-grey in dark mode. |
| Credential details | Original evidence shown directly in a contained viewer, readable skills/details alongside on desktop and below on phones. Keep an original-document fallback. “Verify credential” remains bottom-right and content-sized. |
| About | More personal introduction, your existing portrait and factual background, clearer process, and tools grouped by their purpose. Link capabilities to real projects where the evidence exists. |
| Contact | Clear invitation beside the form on desktop; readable single-column phone form. Plain-language labels, 16px inputs, consistent success/error/security-check states. Preserve submission, consent, and human-review behaviour. |
| Privacy and unavailable pages | A calm reading layout, useful headings, working navigation, and clear recovery actions. Preserve policy meaning and unpublished-content protections. |

The visual proposal includes representative previews for these templates. The credential-document drawing is explicitly a placement placeholder, not a recreated certificate. New headline wording is proposed copy, not approved final copy. The Circuits placeholder is an editorial review note, not a new project claim.

## Typography and layout

- Use **Geist** consistently for public headings and body text; reserve **Geist Mono** for short numbers and technical identifiers. The approved design already specifies these families, so no new font dependency is needed. Character should come from composition and evidence, not extra fonts.
- Desktop: approximately 56–70px hero, 42–60px page titles, 28–34px section headings, 20–22px card titles, 16–18px reading text, and 12–13px metadata.
- Phone: approximately 30–36px main titles, 22–28px section headings, 16px card titles, 14px card copy, 16px long-form reading text and inputs, and 11–12px metadata. No global zoom or transform scaling.
- Keep long text around 60–70 characters per line. Use sentence case, less aggressive tracking, consistent line height, and shorter display summaries with the full detail preserved on the detail route.
- Keep adjacent project/credential cards and the approach relationship on phones. **Approval requested for an exception:** articles, privacy content, evidence/details, and form fields should reflow when necessary to stay readable. Identical desktop placement and comfortable phone reading cannot always both be preserved.
- Maintain the 280px desktop sidebar and 64px mobile navigation structure. Increase navigation-label readability. A static sidebar in the preview represents the fixed production sidebar; no scroll behaviour has been changed on the live site.
- Use a compact spacing rhythm: related elements stay close; major sections receive more space than their internal content. Avoid both huge empty bands and uniform wall-to-wall density.

## Motion direction

One signature moment: a short trace through the actual workflow steps, available to replay. This explains your work instead of merely signalling “technology”. Other interactions remain restrained: border/arrow response on cards, a short content transition, and clear active navigation.

Proposed timing: 160–220ms for controls, 350–500ms for section transitions, and about 1.2–2 seconds for a workflow trace. No endless animation, scroll hijacking, mouse-following effects, or typing that delays reading. Essential text remains visible; reduced-motion mode removes nonessential movement. The preview demonstrates the flow concept, not every final animation.

## After approval only

The implementation would be organised into these phase areas, with a tracker created only after the direction is approved:

1. **Foundation:** confirm copy and the mobile-reading exception; define shared type, spacing, colour, card, and motion rules.
2. **Homepage and collections:** deliver the new introduction, proof moment, project/credential cards, approach, and inquiry section.
3. **Public detail templates:** apply the system to project/credential details, About, Contact, Privacy, and unavailable/empty states.
4. **Motion and finish:** integrate the signature workflow treatment and verify keyboard, reduced motion, theme contrast, readability, and real interactions.

“Loop engineering” would mean a bounded delivery loop for each phase: approved target → implementation batch → typecheck/build as applicable → browser and interaction review → one grouped correction pass → evidence and commit. Further changes after the correction pass return to you for a decision. No open-ended polish loop, new backend, or speculative dependencies.

Acceptance evidence would cover 360, 768, 1024, and 1440px; light/dark appearance; long titles and varying project counts; navigation/back behaviour; original credential evidence and verification; the real CV download; and contact validation/security states without sending test messages to real recipients. Update the approved-baseline pointer only after your explicit visual approval.

## Preview review notes

The mockup is isolated from the application. It reuses the existing portrait assets and uses a simplified diagram derived from the published clinic steps. A bounded visual pass identified narrow-phone workflow labels and navigation scroll position; these were corrected together. The style detector ran in degraded regex-only mode because its HTML parser modules were unavailable; it flagged the intentionally retained Geist family. This does not constitute a full automated accessibility audit.

Approval needed: the overall visual direction, proposed headline tone, and the selective mobile reflow described above. A task tracker, engineering loop, and live implementation have deliberately not been started.
