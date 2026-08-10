/**
 * Back-catalogue-only character art from `public/characters/`.
 *
 * `wolvesComicHeroShots` feeds two consumers: the authored Wolves intro
 * overlay title-card cycle (frozen) and the back catalogue. Every asset here
 * is one the intro overlay does NOT carry, so these records are consumed only
 * by `backCatalogueCuratedPhotos` in `WolvesComicReader.vue` — adding one must
 * never change what the Wolves presentation shows. `src/tests/wolvesComicReader.test.ts`
 * pins that boundary.
 *
 * Ids are prefixed `characters/` so they can never collide with the hero-shot
 * ids in `wolves-comic-hero-shots.ts` — the back-catalogue pool de-duplicates
 * by id. Unlike hero shots these records carry no `contentFrame`: that field
 * exists solely for intro-overlay framing and must not be fabricated.
 *
 * Titles follow the hero-shot label convention: the depicted species'
 * scientific name from `wolves-dinosaur-species.ts` (or genus alone where no
 * epithet is recorded). The title describes the animal, not the file, so
 * duplicate titles across poses and colorways are expected.
 *
 * Order is deliberate. `orderCuratedSlides` merges hero-kind slides into the
 * curated run preserving array order, and this array is appended straight
 * after the hero shots — whose last entry is a `Deinonychus antirrhopus`. The
 * rotation below therefore opens on Alamosaurus and then alternates the three
 * represented species (Alamosaurus / Deinonychus / Torosaurus) so no species
 * or character ever repeats back-to-back, matching the spacing property the
 * hero-shot order was hand-built for. A shuffle could not reconstruct this —
 * it has no idea which dinosaur is which.
 */
export interface BackCatalogueCharacter {
  id: string
  src: string
  title: string
}

export const backCatalogueCharacters = [
  {
    id: 'characters/alamosaurus',
    src: 'characters/alamosaurus.webp',
    title: 'Alamosaurus sanjuanensis',
  },
  {
    id: 'characters/bluefin-nesting',
    src: 'characters/bluefin_nesting.webp',
    title: 'Deinonychus antirrhopus',
  },
  {
    id: 'characters/torosaurus',
    src: 'characters/torosaurus.webp',
    title: 'Torosaurus latus',
  },
  {
    id: 'characters/jorge-custom-chonks-intrigued',
    src: 'characters/Jorge_CustomChonks_Intrigued.webp',
    title: 'Deinonychus antirrhopus',
  },
  {
    id: 'characters/chonky-alamo-blue',
    src: 'characters/chonky-alamo-blue.webp',
    title: 'Alamosaurus sanjuanensis',
  },
  {
    id: 'characters/jorge-custom-chonks-pivotraptor-blm-black-gold-post',
    src: 'characters/Jorge_CustomChonks_PivotRaptor_BLMBlackGold_Post.webp',
    title: 'Deinonychus antirrhopus',
  },
  {
    id: 'characters/bob-torosaurus',
    src: 'characters/bob-torosaurus.webp',
    title: 'Torosaurus latus',
  },
  {
    id: 'characters/bluefin-pride',
    src: 'characters/bluefin_pride.webp',
    title: 'Deinonychus antirrhopus',
  },
  {
    id: 'characters/chonky-alamo-vector',
    src: 'characters/chonky-alamo-vector.webp',
    title: 'Alamosaurus sanjuanensis',
  },
  {
    id: 'characters/kaslin-torosaurus',
    src: 'characters/kaslin-torosaurus.webp',
    title: 'Torosaurus latus',
  },
  {
    id: 'characters/jorge-custom-chonks-leaping',
    src: 'characters/Jorge_CustomChonks_Leaping.webp',
    title: 'Deinonychus antirrhopus',
  },
] as const satisfies readonly BackCatalogueCharacter[]
