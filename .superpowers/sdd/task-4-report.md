# Task 4 Report: Dedicated Wolves Lore Views

## Status

Complete.

## Implementation

- Added typed authored frontmatter support for `guardian.class` (`titan`, `warlock`, or `hunter`) and string-only `epic_name`; no defaults are introduced.
- Added dedicated full-column views for news, sources, field reports, locations, Guardian dossiers, dinosaur dossiers, and Guardian bonds.
- Kept `WolvesLoreColumn` a thin typed router. Character sheets choose the dinosaur dossier only for `subject_kind: dinosaur`; other character sheets use the Guardian dossier.
- Passed the record collection into views only for explicit GuardianBond lookups and fixture-driven routing tests.
- Guardian and bond views render authored profile fields, ordered specializations, and reciprocal validation. Deterministic FNV-1a telemetry is rendered only as UI status information.
- Dinosaur artwork resolves only when its authored species ID matches an explicit `dinosaurSpecies` registry entry. The source is built with `import.meta.env.BASE_URL`; unmatched species render no image or fallback.
- Source fragments now use the canonical source URL held by the existing release record, independently of the authored Markdown body.
- Added generic, non-narrative TypeScript fixtures. No lore Markdown, thesis timeline, HUD text, or authored chronology was changed.

## TDD Evidence

1. Added parser and router assertions before production changes. The initial focused run failed as expected: the parser omitted `epic_name`, did not reject invalid Guardian classes, and all requested dossier routes were absent.
2. Implemented the parser contract, router, and dedicated views; the focused suite passed.
3. Screenshot review found that staged source records lack authored sender/channel provenance. Added a failing canonical-source-URL assertion, verified it failed, then added `getSourceProvenance()` and passed the regression.

## Verification

- `npm run test:run -- src/tests/wolvesLoreColumn.test.ts src/tests/wolvesLoreRecords.test.ts src/tests/wolvesDinosaurSpecies.test.ts`
  - Passed: 3 files, 28 tests.
- `npm run typecheck`
  - Passed.
- Scoped ESLint over every Task 4 source and test file
  - Passed.
- `git diff --check`
  - Passed before staging.
- Browser validation used the mounted Wolves soundtrack progress bar with a local IFrame API stand-in. All nine Track 0 `source`/`news` slots selected the expected dedicated view. The top HUD and lower thesis-overlay DOM were asserted independently at every timestamp.
- Reviewed temporary desktop and 390px mobile screenshots for source/news rendering and footer fit. Temporary screenshots were removed.

## Commit

- `48e933c2d0029388e5be136150e2c6d8c3188d24` — `feat(wolves): add dedicated lore dossier views`

## Self-Review

- The 2fr/1fr Wolves desktop grid is untouched.
- Existing quote/chatlog selectors and Golden Era behavior remain covered by regression tests.
- No generated lore aliases, titles, classes, supers, relationships, dinosaur dossiers, or Markdown records were added.
- Artwork selection has no rotation, filename inference, or generic asset fallback.
- No unrelated Dakota or wallpaper changes were staged.

## Concerns

None.

## Review Follow-up: Final News Warning

- Restored the explicitly passed thesis warning in `NewsLoreView` without changing thesis story text, HUD communications, authored lore, or timeline data.
- Added a regression that derives the actual locked final artifact and warning at Track 0 405s and 425s. It first failed because `news-bulletin` had no `data-lore-warning`, then passed after the warning presentation was added.
- Passed: `npm run test:run -- src/tests/wolvesLoreColumn.test.ts src/tests/wolvesThesisSequence.test.ts src/tests/wolvesNarrativeTimeline.test.ts` (31 tests), `npm run typecheck`, scoped ESLint, and `git diff --check`.
- Browser validation used the mounted soundtrack progress bar with a local IFrame API stand-in at 405s and 425s. The top HUD, lower thesis overlay, and separate right-column warning were asserted independently. Desktop and 390px mobile screenshots were reviewed and removed.
