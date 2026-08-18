/**
 * Event-diversity ordering for CNCF gallery photos.
 *
 * Photos arrive from `public/flickr-photos.json` grouped by shoot: a single
 * breakout room can contribute dozens of frames whose titles differ only by a
 * trailing counter. A plain shuffle happily deals eight of them in a row, which
 * reads to an audience as "the slideshow is stuck".
 *
 * `buildWolvesGalleryCycle` groups by event, shuffles inside each group, then
 * deals one photo per group per round. Consecutive slides therefore come from
 * different events for as long as the pool allows.
 *
 * HISTORY — do not replace this with a shuffle again. This module originally
 * shipped in 33a63532 ("diversify post-hero gallery events") and was deleted in
 * 255f61fb ("retime intro and shuffle galleries"), which swapped the call site
 * to `shuffleWolvesGalleryPhotos` — a bare Fisher-Yates whose name implies an
 * event-awareness its body does not have. The guarantee above was silently lost
 * and stayed lost. `src/tests/wolvesGalleryCycle.test.ts` now pins it.
 */

export interface WolvesGalleryPhoto {
  id: string
  title: string
}

/**
 * CNCF export filenames follow `KC+CNC_<region>_<date>_<session>_<photographer>_<n>`,
 * so the first three underscore-separated segments identify the shoot
 * (`KC+CNC_EU_240319`). This is the runtime sibling of `computeTitleFamily` in
 * scripts/update-flickr-photos.js, which caps the same grouping at ingest.
 *
 * Curated slides carry authored prose titles with no underscore structure
 * ("Bluefin Advisor Chris Aniszczyk"), so they group by the whole title. A
 * distinct portrait forms its own single-item group, while several art pieces
 * sharing one credit line group together and get spread apart — both correct.
 * The photo id is the last resort, for a slide with no title at all.
 */
export function getWolvesGalleryEventKey(photo: WolvesGalleryPhoto): string {
  const eventKey = photo.title.split('_').slice(0, 3).filter(Boolean).join('_')
  return eventKey || photo.id
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  return result
}

/**
 * Spread every event evenly across the whole run.
 *
 * Each event's photos are shuffled, then assigned a position inside their own
 * stratum of the output: photo `i` of an `n`-photo event lands somewhere in
 * `[i/n, (i+1)/n)`. Sorting by that position leaves consecutive photos of the
 * same event roughly `total/n` slides apart, whatever `n` is.
 *
 * This replaced a strict round-robin deal, which is only well-behaved when the
 * events are similar sizes. The live feed is not: hundreds of photos carry
 * unstructured titles and so form single-photo events, and a round-robin deals
 * every bucket once per round — which put all of them in round one and left the
 * first ~200 slides looking like a dump of untitled frames.
 */
export function buildWolvesGalleryCycle<T extends WolvesGalleryPhoto>(
  photos: readonly T[],
  random: () => number = Math.random,
): T[] {
  const eventGroups = new Map<string, T[]>()

  for (const photo of photos) {
    const eventKey = getWolvesGalleryEventKey(photo)
    eventGroups.set(eventKey, [...(eventGroups.get(eventKey) ?? []), photo])
  }

  const placed: { photo: T, position: number }[] = []

  for (const group of eventGroups.values()) {
    const shuffled = shuffle(group, random)
    for (const [index, photo] of shuffled.entries()) {
      placed.push({ photo, position: (index + random()) / shuffled.length })
    }
  }

  return separateAdjacentEvents(
    placed
      .sort((left, right) => left.position - right.position)
      .map(entry => entry.photo),
  )
}

/**
 * Restore the hard guarantee the old round-robin gave: no two consecutive
 * photos from the same event.
 *
 * Stratified placement separates events well on average but not absolutely —
 * two photos of one event can still meet across a stratum boundary. A single
 * forward repair pass swaps the offender with the nearest later photo from a
 * different event. Order-preserving elsewhere, and a no-op once the pool holds
 * too few distinct events to separate.
 *
 * `segmentStarts` fences the search. A caller that has already assigned runs of
 * this list to authored sections — the Director's Cut draws each section from
 * its own ordered pools — cannot let a repair swap reach across a section
 * boundary: the swap is order-preserving in the list but not in the show, and
 * it drags a photo drawn for the ambient intro into the climax and vice versa.
 * Fenced, seams are still repaired from inside the later section, which is
 * where the offending pair actually meets.
 */
export function separateAdjacentEvents<T extends WolvesGalleryPhoto>(
  photos: readonly T[],
  segmentStarts: readonly number[] = [],
): T[] {
  const separated = [...photos]
  const fences = [...new Set([0, ...segmentStarts, separated.length])].sort((left, right) => left - right)
  const segmentEndFor = (index: number) => fences.find(fence => fence > index) ?? separated.length

  for (let index = 1; index < separated.length; index++) {
    const previousKey = getWolvesGalleryEventKey(separated[index - 1])
    if (getWolvesGalleryEventKey(separated[index]) !== previousKey) {
      continue
    }

    const limit = segmentEndFor(index)
    const swapIndex = separated.findIndex((photo, candidate) =>
      candidate > index && candidate < limit && getWolvesGalleryEventKey(photo) !== previousKey)
    if (swapIndex === -1) {
      continue
    }

    ;[separated[index], separated[swapIndex]] = [separated[swapIndex], separated[index]]
  }

  return separated
}
