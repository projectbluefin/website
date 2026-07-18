---
name: design-authority
version: "1.0"
last_updated: 2026-07-17
tags: [design, ui, approval]
description: Use when a request could change layout, styling, typography, animation, responsive behavior, Vue component structure, navigation prominence, or page discoverability.
metadata:
  type: procedure
---

# Design Authority

## When to Use

Use for any possible visual, layout, component, navigation, or discoverability change.

## When NOT to Use

Routine content, data, and asset work stays in `site-maintenance.md`.

## Authority

| Surface | Default |
|---|---|
| Wolves | Design frozen. Only documented content surfaces are open. |
| Established pages and components | Get explicit human approval before editing visual files. |
| Explicitly requested new pages or components | Design work is allowed through the repository design workflow. |
| Content, data, and bug-fix requests | No implied design authority. |

## Stop Before Editing

Stop if the change affects:

- Vue template structure or component hierarchy
- SCSS, Tailwind classes, spacing, typography, color, or animation
- responsive layout or visual hierarchy
- navigation, sitemap inclusion, `noindex`, or page prominence
- any Wolves layout, timing, controls, lore rendering, or thesis surface

An explicit content, behavior, or bug-fix request does not authorize redesign.

## Core Process

1. Confirm the exact surface and intended outcome.
2. Follow existing visual patterns; do not create a parallel design system.
3. Keep experiments local until reviewed.
4. Capture desktop and mobile screenshots.
5. Verify interaction, responsive behavior, console output, and bounds.
6. Do not commit or push until the screenshots are approved.
7. For a recovery, establish the source design against its documented contract and historical behavioral tests; do not assume the immediate pre-removal revision is correct. Transplant only the affected hunks and keep later content, behavior, and unrelated fixes intact.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It is only spacing." | Spacing is design and needs approval on established pages. |
| "The bug report implies a redesign." | Fix behavior without changing visual authority. |

## Red Flags

- "Small spacing cleanup" without approval.
- Editing shared styles to solve one page.
- Making content fit by shrinking type.
- Promoting an unlisted page through navigation.
- Any Wolves visual diff.

## Verification

- [ ] Approval predates the visual edit.
- [ ] Diff is limited to the approved surface.
- [ ] Desktop and mobile screenshots were reviewed.
- [ ] Existing design conventions remain intact.

## Sources

- `docs/wolves-maintenance.md`
- `AGENTS.md`
