/**
 * Slide ordering for the back-catalogue album experiences (every experience in
 * public/experiences/catalogue.json except the authored Wolves show).
 *
 * The pool has two halves with very different characters:
 *
 * - **CNCF stream** — `public/flickr-photos.json`, bulk conference photography,
 *   refreshed weekly, ~65% of the pool.
 * - **Curated slides** — hand-selected by the project owner for the Wolves
 *   catalogue: portraits and lore (`wolves/people/`), product showcase
 *   (`wolves/showcase/`), commissioned mascot art (`wolves/wolves/`) and comic
 *   hero shots (`public/characters/`). NOT a CNCF mirror; a handful carry
 *   CNCF-style filenames but the selection is authored.
 *
 * Three rules, applied as independent passes so none distorts another:
 *
 * 1. **Event diversity** on the CNCF half, via `buildWolvesGalleryCycle`.
 * 2. **No category weighting.** Curated slides are merged at uniformly random
 *    positions, so each half keeps exactly its share of the pool. CNCF dominates
 *    because it outnumbers, never because anything here prefers it.
 * 3. **No two curated slides back-to-back.** Applied as a repair pass, never as
 *    a re-roll: re-drawing until a predicate holds is rejection sampling, which
 *    biases the distribution and would quietly violate rule 2.
 */

import type { WolvesGalleryPhoto } from './wolves-gallery-cycle'
import { buildWolvesGalleryCycle } from './wolves-gallery-cycle'
import { shuffleWolvesGalleryPhotos } from './wolves-gallery-shuffle'

/** Provenance of a slide. Drives both ordering and the on-screen credit. */
export type BackCatalogueSlideKind = 'cncf' | 'curated' | 'showcase' | 'mascot' | 'hero' | 'artwork' | 'bazzite'

export interface BackCatalogueSlide extends WolvesGalleryPhoto {
  kind: BackCatalogueSlideKind
}

export function isCncfSlide(slide: { kind?: BackCatalogueSlideKind }): boolean {
  return slide.kind === 'cncf'
}

/**
 * Provenance of a local wallpaper, derived from its path and title.
 *
 * Locality cannot answer this. `wolves/people/` is the owner's hand-picked
 * selection, but 136 of its 213 files were pulled from CNCF albums and kept
 * their source-prefixed filenames (`flickr-`, `cncf-`, `kubecon-`) or their
 * `KC+CNC_...` export titles. Crediting those to Bluefin because they happen to
 * sit on our disk misattributes someone else's photography, so every signal is
 * checked explicitly rather than inferred from the directory.
 */
export function classifyCuratedSlide(id: string, title = ''): BackCatalogueSlideKind {
  // Registered artwork registries carry explicit provenance prefixes; check
  // them first so an id like `artwork/bluefin-01` can never fall through to
  // the mascot branch's `bluefin-` stem match.
  if (id.startsWith('artwork/')) {
    return 'artwork'
  }
  if (id.startsWith('bazzite/')) {
    return 'bazzite'
  }
  if (id.includes('/showcase/')) {
    return 'showcase'
  }
  if (id.startsWith('wolves/wolves/') || id.includes('/wolves/wolves/') || id.startsWith('bluefin-')) {
    return 'mascot'
  }
  const basename = id.split('/').pop() ?? ''
  if (/^(?:flickr|cncf|kubecon)-\d+/i.test(basename) || title.startsWith('KC+CNC')) {
    return 'cncf'
  }
  return 'curated'
}

/**
 * Choose `count` distinct slot indices from `[0, slots)`, uniformly at random.
 * Partial Fisher-Yates over a lazily-materialised index map, so picking a few
 * hundred slots out of a few hundred stays linear in `count`.
 */
export function pickDistinctSlots(slots: number, count: number, random: () => number = Math.random): number[] {
  const taken = new Map<number, number>()
  const chosen: number[] = []

  for (let round = 0; round < Math.min(count, slots); round++) {
    const limit = slots - round
    const pick = Math.floor(random() * limit)
    const value = taken.get(pick) ?? pick
    const tail = limit - 1
    taken.set(pick, taken.get(tail) ?? tail)
    chosen.push(value)
  }

  return chosen.sort((left, right) => left - right)
}

/**
 * Place `curated` into the gaps between `cncf` slides.
 *
 * There are `cncf.length + 1` gaps (before each slide, plus one after the
 * last). Choosing distinct gaps uniformly at random gives both properties the
 * owner asked for at once:
 *
 * - **no weighting** — every gap is equally likely, so curated slides are
 *   spread uniformly across the run rather than pinned to the front;
 * - **no two curated back-to-back** — distinct gaps means at least one CNCF
 *   slide always sits between them.
 *
 * This is why the ordering is not "shuffle then fix up". A repair pass that
 * swaps offenders forward cannot separate slides that clump at the very tail,
 * and re-drawing until the predicate holds is rejection sampling, which biases
 * the distribution and would break the first property to satisfy the second.
 *
 * When there are more curated slides than gaps, separation is impossible; the
 * remainder is merged in and the sequence degrades gracefully.
 */
export function placeCuratedInGaps<T>(
  cncf: readonly T[],
  curated: readonly T[],
  random: () => number = Math.random,
): T[] {
  const gapCount = cncf.length + 1
  if (curated.length > gapCount) {
    return mergeAtRandomPositions(cncf, curated, random)
  }

  const gaps = pickDistinctSlots(gapCount, curated.length, random)
  const placed: T[] = []
  let curatedIndex = 0

  for (let index = 0; index <= cncf.length; index++) {
    while (curatedIndex < gaps.length && gaps[curatedIndex] === index) {
      placed.push(curated[curatedIndex++])
    }
    if (index < cncf.length) {
      placed.push(cncf[index])
    }
  }

  return placed
}

/**
 * Interleave `extras` into `base` at uniformly random positions while
 * preserving the internal order of both. Equivalent to choosing which
 * `extras.length` of the `base.length + extras.length` output slots belong to
 * extras, uniformly at random — so neither side is favoured at any position.
 */
export function mergeAtRandomPositions<T>(
  base: readonly T[],
  extras: readonly T[],
  random: () => number = Math.random,
): T[] {
  const merged: T[] = []
  let baseIndex = 0
  let extraIndex = 0

  while (baseIndex < base.length || extraIndex < extras.length) {
    const baseRemaining = base.length - baseIndex
    const extraRemaining = extras.length - extraIndex
    const takeExtra = random() * (baseRemaining + extraRemaining) < extraRemaining

    if (extraRemaining > 0 && (baseRemaining === 0 || takeExtra)) {
      merged.push(extras[extraIndex++])
    }
    else {
      merged.push(base[baseIndex++])
    }
  }

  return merged
}

/**
 * Safety net for the degenerate case where `placeCuratedInGaps` had to fall
 * back to a plain merge: swap any curated slide that landed beside another with
 * the nearest later CNCF slide. Order-preserving elsewhere, single walk.
 */
export function spaceOutCuratedSlides<T extends { kind?: BackCatalogueSlideKind }>(
  slides: readonly T[],
): T[] {
  const spaced = [...slides]

  for (let index = 1; index < spaced.length; index++) {
    if (isCncfSlide(spaced[index]) || isCncfSlide(spaced[index - 1])) {
      continue
    }

    const swapIndex = spaced.findIndex((slide, candidate) => candidate > index && isCncfSlide(slide))
    if (swapIndex === -1) {
      break
    }

    ;[spaced[index], spaced[swapIndex]] = [spaced[swapIndex], spaced[index]]
  }

  return spaced
}

/**
 * Shuffle the curated slides before they are placed.
 *
 * `placeCuratedInGaps` fills gaps in ascending order, so the curated list's own
 * order maps straight onto screen position. Passing the pool in its natural
 * order — portraits, then showcase, then mascot art, then hero shots — put the
 * first dinosaur at slide 745 of 808: a category preference created purely by
 * concatenation order, which is exactly what "no preference" rules out.
 *
 * Hero shots are merged back in afterwards rather than shuffled with everything
 * else, because their authored sequence in `wolves-comic-hero-shots.ts` spaces
 * characters and species apart. That ordering is information a shuffle would
 * destroy and cannot reconstruct.
 */
export function orderCuratedSlides<T extends BackCatalogueSlide>(
  curated: readonly T[],
  random: () => number = Math.random,
): T[] {
  const heroes = curated.filter(slide => slide.kind === 'hero')
  const others = shuffleWolvesGalleryPhotos(curated.filter(slide => slide.kind !== 'hero'), random)
  return mergeAtRandomPositions(others, heroes, random)
}

/**
 * Full ordering for one album launch.
 */
export function orderBackCatalogueSlides<T extends BackCatalogueSlide>(
  cncf: readonly T[],
  curated: readonly T[],
  random: () => number = Math.random,
): T[] {
  const diversified = buildWolvesGalleryCycle(cncf, random)
  return spaceOutCuratedSlides(placeCuratedInGaps(diversified, orderCuratedSlides(curated, random), random))
}
