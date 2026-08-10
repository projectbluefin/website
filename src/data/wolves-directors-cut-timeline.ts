/**
 * The Director's Cut quote-and-bulletin timeline for Track 0.
 *
 * Nine source-verified science and humanity quotes (the panel approved for
 * the Director's Cut finale) play in their authored order across the run of
 * the song, followed by the existing missing-scientist bulletin held in an
 * early-finale window. This file owns that quote/bulletin schedule, and
 * re-exports the finale's own named anchors (companion video, Collapse
 * artwork, extinction/survival clauses, terminal fade) from
 * `wolves-directors-cut-finale.ts`.
 *
 * These records are Director's Cut only. They are never authored for the
 * standard show: see hiddenFromWolvesVideoArtifactIds in
 * wolves-narrative-timeline.ts.
 */

import type { LoreTimingInput } from './wolves-lore-timing'
import { DIRECTORS_CUT_FINALE_ANCHORS } from './wolves-directors-cut-finale'
import { loadAllLoreRecords } from './wolves-lore-records'
import { estimateLoreReadDuration } from './wolves-lore-timing'
import { TRACK_ZERO_SECTIONS, trackZeroBeatAtOrAfter, trackZeroBeatAtOrBefore } from './wolves-track-zero-beats'

/**
 * The finale's own named anchors — companion-video pre-arm, reveal and park,
 * the Collapse day-to-night crossfade, both quote clauses and the terminal fade
 * — plus the measured companion-source frames they are derived from.
 *
 * Defined in `wolves-directors-cut-finale.ts` (a leaf with no lore imports, so
 * the cinematic store can read the boundaries without pulling the whole lore
 * corpus into its graph) and re-exported here, exactly as
 * `DIRECTORS_CUT_FINALE_START` is, so every Director's Cut anchor still
 * resolves through this one module.
 */
export {
  COMPANION_PLAY_LEAD_SECONDS,
  COMPANION_SOURCE_BLACK_SECONDS,
  COMPANION_SOURCE_IMPACT_SECONDS,
  COMPANION_SOURCE_PARK_SECONDS,
  COMPANION_SOURCE_RUNTIME_SECONDS,
  COMPANION_SOURCE_SPACE_IMPACT_SECONDS,
  companionSourceTimeAt,
  DIRECTORS_CUT_COLLAPSE_DAY_IMAGE,
  DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE,
  DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S,
  DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S,
  DIRECTORS_CUT_COMPANION_SIDECAR_INDEX,
  DIRECTORS_CUT_COMPANION_VIDEO_ID,
  DIRECTORS_CUT_EXTINCTION_CLAUSE,
  DIRECTORS_CUT_FINALE_ANCHOR_ORDER,
  DIRECTORS_CUT_FINALE_ANCHORS,
  DIRECTORS_CUT_SAGAN_SOURCE,
  DIRECTORS_CUT_SURVIVAL_CLAUSE,
  DIRECTORS_CUT_TERMINAL_FADE_SECONDS,
  directorsCutBulletinVisible,
  directorsCutCollapseNightOpacity,
  directorsCutCompanionPlaying,
  directorsCutCompanionVisible,
  directorsCutExtinctionFading,
  directorsCutExtinctionVisible,
  directorsCutSurvivalVisible,
  directorsCutTerminalFadeEngaged,
} from './wolves-directors-cut-finale'

export type { DirectorsCutFinaleAnchor } from './wolves-directors-cut-finale'
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
 * Measured Track 0 marks the quote panel opens windows on. Each window's first
 * quote lands exactly on its mark, so every entrance is a musical event and not
 * a division of the runtime.
 *
 * The panel stops at the bulletin: the pivotal freeze and bketelsen freeze
 * (344.956-355.219, see TRACK_ZERO_SECTIONS) are each shorter than
 * PAGE_MINIMUM_SECONDS, too brief to hold even one quote's floor, and the
 * finale owns everything past them.
 */
const DIRECTORS_CUT_QUOTE_SECTION_MARKS = [
  0,
  TRACK_ZERO_SECTIONS.verseStart,
  TRACK_ZERO_SECTIONS.chorusStart,
  TRACK_ZERO_SECTIONS.bridgeStart,
  TRACK_ZERO_SECTIONS.buildStart,
  DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart,
] as const

/**
 * The longest a record may stay on stage, as a multiple of what it costs to
 * read.
 *
 * A one-line quote costs about six seconds. The first cut of this timeline
 * divided the whole song between nine of them, which handed each one a 34-48
 * second hold: six seconds of reading and then half a minute of a dead panel.
 * At 2.5x the words are up long enough to be read twice from the back row and
 * then get out of the way. Where a window has more room than that, the surplus
 * goes to the picture edit as a deliberate image-only interval — quotes are
 * never stretched to fill, and never split to fit.
 */
export const DIRECTORS_CUT_QUOTE_MAX_HOLD_RATIO = 2.5

/**
 * The bulletin's own window, owned by the finale module because the finale is
 * what has to keep the frame clear around it. Re-exported here so callers that
 * already read this module's schedule do not need a second import.
 */
export const DIRECTORS_CUT_BULLETIN_START: number = DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart
export const DIRECTORS_CUT_BULLETIN_END: number = DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd

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

/**
 * Give each quote in a window a beat-anchored entrance and a hold capped at
 * `DIRECTORS_CUT_QUOTE_MAX_HOLD_RATIO` times its reading cost.
 *
 * The window's own first quote takes the named mark exactly; the rest enter on
 * the measured beat nearest their even share of the window, so successive
 * quotes are spaced by the music rather than butted end to end. Every hold ends
 * on a measured beat, never on the arithmetic limit itself.
 */
function scheduleQuoteWindow(ids: readonly string[], windowStart: number, windowEnd: number): DirectorsCutNarrativeSlot[] {
  const share = (windowEnd - windowStart) / Math.max(1, ids.length)

  return ids.map((id, index) => {
    const idealStart = windowStart + index * share
    // Window 0 opens at the song's origin, which is 0.139s before the first
    // measured beat: the panel is up as the track starts, not after it.
    const startTime = index === 0 ? windowStart : trackZeroBeatAtOrAfter(idealStart)
    const readCost = estimateLoreReadDuration(timingInput(id))
    const latestEnd = Math.min(startTime + readCost * DIRECTORS_CUT_QUOTE_MAX_HOLD_RATIO, windowEnd)
    const endTime = trackZeroBeatAtOrBefore(latestEnd)

    if (endTime - startTime < readCost - 1e-8) {
      throw new Error(`Director's Cut quote "${id}" is scheduled ${(endTime - startTime).toFixed(3)}s, below its ${readCost.toFixed(3)}s reading cost`)
    }

    return { artifactId: id, startTime, endTime }
  })
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
  ...quoteWindows.flatMap(([start, end], index) => scheduleQuoteWindow(quoteGroupsByWindow[index]!, start, end)),
  {
    artifactId: DIRECTORS_CUT_BULLETIN_ARTIFACT_ID,
    startTime: DIRECTORS_CUT_BULLETIN_START,
    endTime: DIRECTORS_CUT_BULLETIN_END,
  },
]

/**
 * The record on stage at `time`, or `null` when the frame belongs to the
 * picture edit alone.
 *
 * Null is a scheduled state, not a miss: the gaps between quotes are authored
 * image-only intervals, and everything after the bulletin clears belongs to the
 * finale. A caller that treats null as "keep showing the last record" puts a
 * stale quote under the impact reveal.
 */
export function getDirectorsCutNarrativeSlotForTime(time: number): DirectorsCutNarrativeSlot | null {
  const normalizedTime = Math.max(0, time)
  return wolvesDirectorsCutNarrativeTimeline
    .find(slot => normalizedTime >= slot.startTime && normalizedTime < slot.endTime)
    ?? null
}
