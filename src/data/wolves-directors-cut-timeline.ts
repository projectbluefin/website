/**
 * The Director's Cut quote-and-bulletin timeline for Track 0.
 *
 * Nine source-verified science and humanity quotes (the panel approved for
 * the Director's Cut finale) play in their authored order across the run of
 * the song, followed by the existing missing-scientist bulletin held in an
 * early-finale window. This file owns only that quote/bulletin schedule.
 * Task 8 later adds the finale's own named anchors (companion video,
 * Collapse artwork, extinction/survival clauses, terminal fade) to this same
 * module; nothing here should be read as the whole finale.
 *
 * These records are Director's Cut only. They are never authored for the
 * standard show: see hiddenFromWolvesVideoArtifactIds in
 * wolves-narrative-timeline.ts.
 */

import type { LoreTimingInput } from './wolves-lore-timing'
import { loadAllLoreRecords } from './wolves-lore-records'
import { allocateLoreSlots } from './wolves-lore-timing'
import { TRACK_ZERO_SECTIONS } from './wolves-track-zero-beats'

/**
 * The measured beat where the Director's Cut hands the frame to its finale.
 *
 * Defined next to the slide schedule that has to stop on it — see
 * `wolves-directors-cut-slides.ts` for why beat 879 (355.219s) is the anchor —
 * and re-exported here so every Director's Cut anchor resolves from this one
 * module.
 */
export { DIRECTORS_CUT_FINALE_START } from './wolves-directors-cut-slides'

export interface DirectorsCutNarrativeSlot {
  artifactId: string
  startTime: number
  endTime: number
}

/**
 * The nine-quote panel, in the exact order approved for the Director's Cut:
 * Sagan, Sagan, Clarke, Clarke, Asimov, Gould, Gould, Goodall, Goodall. Order
 * is authored and significant — see src/data/lore/quote-*.md and the science
 * quote research report cited in docs/skills/wolves-content/SKILL.md.
 */
export const DIRECTORS_CUT_QUOTE_IDS = [
  'quote-sagan-extinction-forever',
  'quote-sagan-pale-blue-dot',
  'quote-clarke-dinosaurs-adapt',
  'quote-clarke-unstable-combination',
  'quote-asimov-knowledge-wisdom',
  'quote-gould-stewards-of-nothing',
  'quote-gould-fight-to-save',
  'quote-goodall-every-individual-matters',
  'quote-goodall-nature-resilient',
] as const

/** The existing full missing-scientist bulletin; not authored by this task. */
export const DIRECTORS_CUT_BULLETIN_ARTIFACT_ID = 'blue-universal-acquires-wayland-yutani' as const

/**
 * Measured Track 0 marks the quote panel is allowed to cut on. The pivotal
 * freeze and bketelsen freeze (344.956-355.219, see TRACK_ZERO_SECTIONS) are
 * each shorter than PAGE_MINIMUM_SECONDS, too brief to hold even one quote's
 * floor, so no cut is placed inside that pair; the quote side of the
 * timeline ends at pivotalStart instead.
 */
const DIRECTORS_CUT_QUOTE_SECTION_MARKS = [
  0,
  TRACK_ZERO_SECTIONS.verseStart,
  TRACK_ZERO_SECTIONS.chorusStart,
  TRACK_ZERO_SECTIONS.bridgeStart,
  TRACK_ZERO_SECTIONS.buildStart,
  TRACK_ZERO_SECTIONS.pivotalStart,
] as const

/**
 * The bulletin's own early-finale window: the pivotal freeze through the
 * finale beat. Ends exactly at finaleStart so Task 8's finale cleanly owns
 * every second from there on; this file never schedules anything past it.
 */
export const DIRECTORS_CUT_BULLETIN_START: number = TRACK_ZERO_SECTIONS.pivotalStart
export const DIRECTORS_CUT_BULLETIN_END: number = TRACK_ZERO_SECTIONS.finaleStart

const recordsById = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))

/**
 * This timeline shows only complete quotes and the one authored bulletin —
 * no chatlogs, no invented dialogue. Any other record kind is a defect in
 * how this module was extended, not a schedulable input, so it throws
 * instead of silently mis-timing a conversation.
 */
function timingInput(id: string): LoreTimingInput & { id: string } {
  const record = recordsById.get(id)
  if (!record) {
    throw new Error(`Director's Cut narrative timeline references unknown lore record "${id}"`)
  }
  if (record.kind !== 'quote' && record.kind !== 'news') {
    throw new Error(`Director's Cut narrative timeline record "${id}" must be a quote or bulletin, not "${record.kind}"`)
  }
  return {
    id,
    kind: record.kind === 'quote' ? 'quote' : 'prose',
    body: record.body,
    attribution: record.metadata.attribution,
  }
}

/**
 * Split `total` items across `weights` proportionally to each weight's share,
 * assigning any remainder to the largest fractional remainders first. Used to
 * size each section-derived window's quote count from the window's own
 * measured length, rather than splitting the panel into equal arbitrary
 * groups regardless of the music underneath them.
 */
function proportionalCounts(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const raw = weights.map(weight => (weightSum > 0 ? (weight / weightSum) * total : 0))
  const base = raw.map(Math.floor)
  const remainder = total - base.reduce((sum, count) => sum + count, 0)
  const byRemainingFraction = raw
    .map((value, index) => ({ index, fraction: value - base[index]! }))
    .sort((a, b) => b.fraction - a.fraction)

  for (let rank = 0; rank < remainder; rank++) {
    base[byRemainingFraction[rank]!.index] += 1
  }

  return base
}

function allocateRange(ids: readonly string[], startTime: number, endTime: number): DirectorsCutNarrativeSlot[] {
  return allocateLoreSlots(ids.map(timingInput), startTime, endTime)
    .map(slot => ({ artifactId: slot.id, startTime: slot.startTime, endTime: slot.endTime }))
}

const quoteWindows = DIRECTORS_CUT_QUOTE_SECTION_MARKS
  .slice(0, -1)
  .map((start, index) => [start, DIRECTORS_CUT_QUOTE_SECTION_MARKS[index + 1]!] as const)
const quoteCountsByWindow = proportionalCounts(
  DIRECTORS_CUT_QUOTE_IDS.length,
  quoteWindows.map(([start, end]) => end - start),
)
const quoteGroupsByWindow: string[][] = []
{
  let cursor = 0
  for (const count of quoteCountsByWindow) {
    quoteGroupsByWindow.push(DIRECTORS_CUT_QUOTE_IDS.slice(cursor, cursor + count))
    cursor += count
  }
}

export const wolvesDirectorsCutNarrativeTimeline: readonly DirectorsCutNarrativeSlot[] = [
  ...quoteWindows.flatMap(([start, end], index) => allocateRange(quoteGroupsByWindow[index]!, start, end)),
  ...allocateRange([DIRECTORS_CUT_BULLETIN_ARTIFACT_ID], DIRECTORS_CUT_BULLETIN_START, DIRECTORS_CUT_BULLETIN_END),
]

export function getDirectorsCutNarrativeSlotForTime(time: number): DirectorsCutNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesDirectorsCutNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesDirectorsCutNarrativeTimeline[wolvesDirectorsCutNarrativeTimeline.length - 1]!
}
