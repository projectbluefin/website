import { estimatePageSeconds } from '../components/wolves/lore/lore-pages'
import { loadAllLoreRecords } from './wolves-lore-records'
import { allocateLoreSlots, estimateLoreReadDuration, loreRecordPages } from './wolves-lore-timing'
import { wolvesRelease } from './wolves-story'
import { TRACK_ZERO_SECTIONS } from './wolves-track-zero-beats'

export interface WolvesNarrativeSlot {
  artifactId: string
  startTime: number
  endTime: number
}

interface WolvesNarrativeLock {
  artifactId: string
  startTime: number
  endTime?: number
}

const FINAL_ARTIFACT_ID = 'blue-universal-acquires-wayland-yutani'

/** The closing bulletin holds until the track hands off to silence. */
const FINAL_ARTIFACT_END = 425

/** The page that names the dead doctor; the show's dramatic reveal. */
const DEATH_REVEAL_MARKER = 'Andy Anderson'

/**
 * Put the reveal up a hair early so it is provably on screen when the beat
 * lands. `pickPageIndexForElapsed` selects with a strict `<`, so a page timed
 * to the exact beat wins or loses on float rounding. Ten milliseconds is well
 * under a video frame and settles it.
 */
const REVEAL_LEAD_SECONDS = 0.01

const finalRecordPages = loreRecordPages({
  kind: 'prose',
  body: loadAllLoreRecords().find(record => record.id === FINAL_ARTIFACT_ID)?.body ?? '',
})

/**
 * Start the closing bulletin so its death-reveal page turns up exactly on
 * `finaleStart`, the measured beat the "Become Legend" cue fires on. The reveal
 * and the finale must land together: the audience reads that the doctor is dead
 * on the same beat the music says Become Legend.
 *
 * Derived rather than written down, because the answer depends on what the
 * pages before the reveal cost to read. A hard-coded start silently drifts off
 * the beat the moment the bulletin is re-edited or the reading pace changes.
 */
const finalRecordStartTime = TRACK_ZERO_SECTIONS.finaleStart - REVEAL_LEAD_SECONDS - finalRecordPages
  .slice(0, Math.max(0, finalRecordPages.findIndex(page => page.includes(DEATH_REVEAL_MARKER))))
  .reduce((total, page) => total + estimatePageSeconds(page), 0)

const PURSUIT_ARTIFACT_ID = 'lorem-pursuit-1'

const pursuitRecordPages = loreRecordPages({
  kind: 'chatlog',
  body: loadAllLoreRecords().find(record => record.id === PURSUIT_ARTIFACT_ID)?.body ?? '',
})

/**
 * Start the Golden Era transmission so its closing line, "Thus becoming One,
 * from the Seven...", lands on `bridgeStart` — the chanting bridge. Sarah's
 * last line is the reveal this conversation exists for, and it has to arrive
 * with the chant, not near it.
 *
 * The record used to run 150-220, which was 19 seconds short of its own
 * content: the conversation was cut off at page 8 of 11 and Sarah's line never
 * reached the screen at all.
 */
const pursuitStartTime = TRACK_ZERO_SECTIONS.bridgeStart - REVEAL_LEAD_SECONDS - pursuitRecordPages
  .slice(0, -1)
  .reduce((total, page) => total + estimatePageSeconds(page), 0)

const pursuitEndTime = pursuitStartTime + estimateLoreReadDuration({
  kind: 'chatlog',
  body: loadAllLoreRecords().find(record => record.id === PURSUIT_ARTIFACT_ID)?.body ?? '',
})

export const lockedNarrativeSlots: readonly WolvesNarrativeLock[] = [
  { artifactId: PURSUIT_ARTIFACT_ID, startTime: pursuitStartTime, endTime: pursuitEndTime },
  { artifactId: FINAL_ARTIFACT_ID, startTime: finalRecordStartTime, endTime: FINAL_ARTIFACT_END },
]

/**
 * Records the show does not display.
 *
 * The first four were hidden deliberately and stay hidden.
 *
 * The rest are oversubscription. The lore column has about 400 seconds of
 * screen time and the authored records cost roughly 900 seconds to read at a
 * theater pace. Every record kept in the running order takes time from the
 * others, and the allocator's response is to floor each one at a single page —
 * so a record with eight authored pages showed page one and vanished. Nineteen
 * of twenty-seven records were being cut off mid-thought, including Sarah's
 * closing line and the death of Dr. Andy Anderson.
 *
 * Hiding a record removes it cleanly instead of showing a fragment of it. What
 * remains now plays in full. Restoring any of these means taking the time back
 * from a record that currently completes, which is a decision about the show,
 * not about the scheduler.
 */
const hiddenFromWolvesVideoArtifactIds = new Set([
  'do-not-reply',
  'lorem-prologue-1',
  'lorem-prologue-2',
  'john-seager',
  // Oversubscribed: cut to let the surviving records play in full.
  'arthur-c-clarke-1',
  'childhoods-end-wager',
  'committee-report-personal-transmission',
  'glorious-eggroll',
  'ishtar-cambrian-explosion',
  'ishtar-final-shape',
  'ishtar-first-knife',
  'ishtar-flower-game',
  'ishtar-patternfall',
  'ishtar-the-wager',
  'reckoning-of-the-three',
  // Director's Cut only: the nine-quote panel (Task 6) and its dedicated
  // timeline in wolves-directors-cut-timeline.ts. These records are never
  // authored for the standard show and must stay excluded from it regardless
  // of oversubscription math.
  'quote-sagan-extinction-forever',
  'quote-sagan-pale-blue-dot',
  'quote-clarke-dinosaurs-adapt',
  'quote-clarke-unstable-combination',
  'quote-asimov-knowledge-wisdom',
  'quote-gould-stewards-of-nothing',
  'quote-gould-fight-to-save',
  'quote-goodall-every-individual-matters',
  'quote-goodall-nature-resilient',
])
const authoredArtifactIds = wolvesRelease.artifacts
  .map(artifact => artifact.id)
  .filter(id => !hiddenFromWolvesVideoArtifactIds.has(id))
const recordsById = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))
function timingInput(id: string) {
  const record = recordsById.get(id)
  const kind = record?.kind === 'chatlog'
    ? 'chatlog' as const
    : record?.kind === 'quote' ? 'quote' as const : 'prose' as const
  return {
    id,
    kind,
    body: record?.body ?? id,
    attribution: record?.metadata.attribution ?? record?.metadata.sender,
  }
}
function allocateRange(ids: readonly string[], startTime: number, endTime: number): WolvesNarrativeSlot[] {
  return allocateLoreSlots(ids.map(timingInput), startTime, endTime)
    .map(slot => ({ artifactId: slot.id, startTime: slot.startTime, endTime: slot.endTime }))
}
const pursuitIndex = authoredArtifactIds.indexOf(PURSUIT_ARTIFACT_ID)
const finalIndex = authoredArtifactIds.indexOf(FINAL_ARTIFACT_ID)
const opening = authoredArtifactIds.slice(0, pursuitIndex)
const middle = authoredArtifactIds.slice(pursuitIndex + 1, finalIndex)
export const wolvesNarrativeTimeline: readonly WolvesNarrativeSlot[] = [
  ...allocateRange(opening, 0, pursuitStartTime),
  { artifactId: PURSUIT_ARTIFACT_ID, startTime: pursuitStartTime, endTime: pursuitEndTime },
  ...allocateRange(middle, pursuitEndTime, finalRecordStartTime),
  { artifactId: FINAL_ARTIFACT_ID, startTime: finalRecordStartTime, endTime: FINAL_ARTIFACT_END },
]

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
