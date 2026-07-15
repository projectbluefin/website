---
name: editorial-policy
description: Use when editing or maintaining story chapters, lore quotes, release notes, or any creative content on the website to prevent AI hallucination or creative overstepping.
---

## When to Use
- Adding or modifying story slides, transcripts, or dialogue elements.
- Reviewing quotes, attributions, and timestamps in data files (e.g., src/data/lore/*.md, src/data/wolves-incoming-signal.txt).
- Summarizing or editing release notes for components.

## When NOT to Use
- Modifying purely functional TypeScript logic, SCSS layouts, or HTML structure.
- Standard code optimizations, styling updates, or performance improvements.

## Core Process
1. Inspect files: Identify the data source of the content (e.g., src/data/ or src/content.ts).
2. Use exact source text: Only populate elements with exact text provided directly by the user or existing files in the repository.
3. **Strict Minimal, Surgical Changes Only**: Never make unrequested additions, introduce speculative features, or shuffle existing content order unless explicitly instructed. Keep all modifications strictly scoped to the exact fix requested to prevent scope creep or introducing regressions.
4. Use placeholder standards: If temporary placeholder text is required, use standard "lorem ipsum" text only. Never generate creative prose, fictional details, or story explanations.
4. Fall back to simple organization: If the user provides a raw dataset (like a list of quotes), organize and balance them programmatically (e.g., using modulo distributions) instead of trying to manually group them under creatively named chapters.

## Common Rationalizations
- "Generating a brief story snippet makes the slide feel more complete."
  - Rebuttal: No. The user generates all creative and editorial content; any AI-generated fiction violates the user's creative bounds. Use lorem ipsum or keep it empty.
- "The quotes fit nicely under a custom prologue section I named."
  - Rebuttal: Fictional headers and chapter names should never be introduced. Keep the structure simple or follow exact user labels.

## Red Flags
- Model generating story background, context, or explanations that do not exist in the source JSON or user input.
- Creative naming of sections or chapters without explicit user specification.
- Fictional descriptions in release notes or commit messages.

## Verification
- [ ] No creative prose or fictional background has been added by the model.
- [ ] All display strings are exact matches to authored records in src/data/lore/ or other user-supplied source text.
- [ ] If placeholders are needed, only standard lorem ipsum is utilized.
