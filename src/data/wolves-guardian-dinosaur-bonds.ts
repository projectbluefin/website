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
  /**
   * The dinosaur's authored name (`epic_name` in its character-sheet lore
   * record). Omitted when no character sheet names the bonded dinosaur.
   */
  dinosaurName?: string
}

export const wolvesGuardianDinosaurBonds: readonly WolvesGuardianDinosaurBond[] = [
  { guardianName: 'Kat Cosgrove', dinosaurSpeciesId: 'karl', dinosaurName: 'Karl' },
  { guardianName: 'Natali Vlatko', dinosaurSpeciesId: 'alamosaurus', dinosaurName: 'Alamo' },
  { guardianName: 'Cortney Nickerson', dinosaurSpeciesId: 'bob-torosaurus' },
  { guardianName: 'Kaslin Fields', dinosaurSpeciesId: 'kentrosaurus', dinosaurName: 'Katerina' },
]
