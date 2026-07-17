/**
 * Static index of which Wolves guardians (as named in `wolves-intro-sequence.ts`
 * cue text) have a documented dinosaur bond in the lore column, and which
 * dinosaur species that bond points to.
 *
 * Sourced from the `guardian-bond` lore records under `src/data/lore/` (see
 * each record's `relations.guardian` / `relations.dinosaur` frontmatter).
 * This lookup is intentionally a small curated list rather than parsing lore
 * markdown at runtime: the intro-cinematic overlay is a lightweight,
 * performance-sensitive component and should not depend on the full lore
 * loader. Keep this list in sync whenever a new `guardian-bond` record is
 * added for a guardian who also appears in the intro sequence.
 */
export interface WolvesGuardianDinosaurBond {
  /** Guardian name exactly as it appears in `wolves-intro-sequence.ts` cue text. */
  guardianName: string
  /** Matches `DinosaurSpecies.id` in `wolves-dinosaur-species.ts`. */
  dinosaurSpeciesId: string
}

export const wolvesGuardianDinosaurBonds: readonly WolvesGuardianDinosaurBond[] = [
  { guardianName: 'Kat Cosgrove', dinosaurSpeciesId: 'karl' },
  { guardianName: 'Natali Vlatko', dinosaurSpeciesId: 'alamosaurus' },
  { guardianName: 'Bob Killen', dinosaurSpeciesId: 'bob-torosaurus' },
  { guardianName: 'Kaslin Fields', dinosaurSpeciesId: 'kaslin-torosaurus' },
]
