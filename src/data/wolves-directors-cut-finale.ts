/**
 * The Director's Cut finale: named anchors, measured companion-video frames,
 * and the pure clock predicates the finale component renders from.
 *
 * Nothing here owns or advances time. Every value is either a measured entry of
 * `TRACK_ZERO_BEAT_TIMES` (the show clock) or a measured frame of the companion
 * video's own source timeline, and every predicate is a function of the
 * soundtrack player's published time. That is what makes seeking backward
 * restore the show: there is no latched state to unwind.
 *
 * Re-exported from `wolves-directors-cut-timeline.ts` so every Director's Cut
 * anchor resolves through that one module, but defined here as a leaf so the
 * cinematic store can read the finale boundaries without pulling the whole
 * lore corpus into its module graph.
 *
 * ## Measured evidence
 *
 * **Companion video** `PjryN2F6fF0` — "Last Day of the Cretaceous:
 * 'Prehistoric Planet' fan tribute", 3840x2160, 24 fps, 6491 frames,
 * 270.458 s. Shot boundaries were taken from a full decode of the source from
 * frame 0 (no fast seek, which offsets timestamps by up to a GOP) at 160x90
 * grayscale, flagging every frame whose mean absolute difference from its
 * predecessor exceeds 40/255:
 *
 * | Source second | Frame |
 * |---|---|
 * | 252.917 | cut to the asteroid impact: the aerial blast and its orange shock ring |
 * | 254.083 | cut away from the blast |
 * | 258.958 | last cut of the film: Earth seen from space |
 * | 259.833 | the impact flash appears on the limb (frame mean rises 8.94 -> 10.55) |
 * | 266.458 | the source's own fade to black begins |
 * | 269.542 | first fully black frame (max luma 1) |
 * | 270.458 | end of file |
 *
 * **Track 0** — measured from the same `track0.m4a` the beat grid came from
 * (librosa 0.11, 22050 Hz, hop 512). The finale barrage holds full power to
 * ~412.8 s; the ring-out falls to 50% at 413.9, 10% at 417.7, 2% at 419.4 and
 * is silent from ~422.7. The last measured beat is 422.301 and the segment's
 * authored runtime is 424 s.
 */

import { TRACK_ZERO_BEAT_TIMES } from './wolves-track-zero-beats'
import { TRACKZERO_SIDECAR_VIDEO_IDS } from './wolves-track-zero-sidecar'

/**
 * Which authored Track 0 companion the finale drives. Addressed by index into
 * the shared playlist rather than by a second copy of the id, so the finale and
 * the standard sidecar can never disagree about which upload this is.
 */
export const DIRECTORS_CUT_COMPANION_SIDECAR_INDEX = 1
export const DIRECTORS_CUT_COMPANION_VIDEO_ID: string = TRACKZERO_SIDECAR_VIDEO_IDS[DIRECTORS_CUT_COMPANION_SIDECAR_INDEX]

/** Measured runtime of the companion source, in its own seconds. */
export const COMPANION_SOURCE_RUNTIME_SECONDS = 270.458
/** Measured cut to the asteroid impact: the first frame of the aerial blast. */
export const COMPANION_SOURCE_IMPACT_SECONDS = 252.917
/** Measured final cut of the film: Earth from space, where the flash lands. */
export const COMPANION_SOURCE_SPACE_IMPACT_SECONDS = 258.958
/** Measured first fully black frame of the source's own fade out. */
export const COMPANION_SOURCE_BLACK_SECONDS = 269.542

/**
 * How far the companion may drift from the soundtrack clock before it is
 * seek-corrected.
 *
 * A seek costs a rebuffer, so correcting small drift trades a sync error the
 * room cannot see for a black corner it can. Half a second is under the length
 * of the shortest shot in the played window (the 1.167 s blast) — anything
 * larger would let the impact land on the wrong beat.
 */
export const DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S = 0.5

/**
 * Minimum gap between two seek corrections. Without it a player that reports a
 * stale time while buffering is "corrected" on every poll, which is how a
 * corner video turns into a stutter loop in front of the room.
 */
export const DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S = 2

const beat = (index: number): number => TRACK_ZERO_BEAT_TIMES[index]!

/**
 * Every named show-clock anchor of the Director's Cut finale, in seconds on the
 * Track 0 timeline. Each one is an exact entry of `TRACK_ZERO_BEAT_TIMES`.
 *
 * - `companionPrearm` (beat 853, = `TRACK_ZERO_SECTIONS.pivotalStart`) — the
 *   finale mounts and the companion player is created, cued, muted and parked
 *   on its measured lead frame. 10.263 s before the cover, 45.789 s before the
 *   reveal: a cold IFrame API load plus a cue has to be over before anyone
 *   sees the corner.
 * - `bulletinStart` (beat 853) — the missing-scientist bulletin is already on
 *   stage in the lore column when the finale opens; the finale carries the
 *   same record on the same window so it never re-pages.
 * - `coverStart` / `collapseDayStart` (beat 879, = `DIRECTORS_CUT_FINALE_START`)
 *   — the finale covers the ordinary slide schedule for good, and the Collapse
 *   day plate takes the main frame.
 * - `companionPlayStart` (beat 969) — the companion starts rolling while still
 *   hidden, one measured beat of lead so the reveal is never a cold frame.
 * - `companionReveal` (beat 970) — the corner appears exactly as the source's
 *   measured impact cut (252.917) lands.
 * - `companionEnd` / `bulletinEnd` / `collapseNightEnd` / `extinctionStart`
 *   (beat 1013, = `TRACK_ZERO_SECTIONS.finaleStart`) — the Become Legend cue.
 *   The corner (already on the source's own black since 407.765) is parked and
 *   cleared, the bulletin is cleared, the Collapse night plate is fully up, and
 *   the first quote clause takes the empty frame.
 * - `extinctionFadeStart` (beat 1024) / `extinctionEnd` (beat 1027) — the first
 *   clause holds 4.296 s and then fades out over 1.184 s.
 * - `survivalStart` (beat 1029) — 0.790 s of empty frame guarantees the two
 *   clauses are never on stage together.
 * - `terminalFadeStart` (beat 1043) — the music is down to 2% of its peak; the
 *   whole frame begins its fade to black.
 * - `terminalFadeEnd` (beat 1049) — the last measured beat of the track. Black
 *   is reached 1.699 s before the segment ends, so the fade never depends on
 *   the final 0.3 s the transport does not publish.
 */
export const DIRECTORS_CUT_FINALE_ANCHORS = {
  companionPrearm: beat(853),
  bulletinStart: beat(853),
  coverStart: beat(879),
  collapseDayStart: beat(879),
  companionPlayStart: beat(969),
  companionReveal: beat(970),
  companionEnd: beat(1013),
  bulletinEnd: beat(1013),
  collapseNightEnd: beat(1013),
  extinctionStart: beat(1013),
  extinctionFadeStart: beat(1024),
  extinctionEnd: beat(1027),
  survivalStart: beat(1029),
  terminalFadeStart: beat(1043),
  terminalFadeEnd: beat(1049),
} as const

export type DirectorsCutFinaleAnchor = keyof typeof DIRECTORS_CUT_FINALE_ANCHORS

/**
 * The anchors in performance order. Several coincide by design — the Become
 * Legend cue hands the frame over in one cut — so the order is non-strict, and
 * this list is what pins that the coincidences are the authored ones.
 */
export const DIRECTORS_CUT_FINALE_ANCHOR_ORDER: readonly DirectorsCutFinaleAnchor[] = [
  'companionPrearm',
  'bulletinStart',
  'coverStart',
  'collapseDayStart',
  'companionPlayStart',
  'companionReveal',
  'companionEnd',
  'bulletinEnd',
  'collapseNightEnd',
  'extinctionStart',
  'extinctionFadeStart',
  'extinctionEnd',
  'survivalStart',
  'terminalFadeStart',
  'terminalFadeEnd',
] as const

/** Seconds of hidden playback before the corner is revealed (one measured beat). */
export const COMPANION_PLAY_LEAD_SECONDS
  = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal - DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart

/**
 * Where the companion is cued and parked: one beat of lead before the measured
 * impact cut, so the visible window opens on the blast rather than on a player
 * still spinning up.
 */
export const COMPANION_SOURCE_PARK_SECONDS
  = COMPANION_SOURCE_IMPACT_SECONDS - COMPANION_PLAY_LEAD_SECONDS

/** Verbatim first clause of the closing quote. */
export const DIRECTORS_CUT_EXTINCTION_CLAUSE = 'Extinction is the rule.'
/** Verbatim second clause of the closing quote. */
export const DIRECTORS_CUT_SURVIVAL_CLAUSE = 'Survival is the exception.'

/**
 * Provenance for the closing quote, verified against the book.
 *
 * It is frequently misattributed to *Cosmos*. It is not from *Cosmos*: it is
 * from the Gifford Lectures collected as *The Varieties of Scientific
 * Experience*, chapter 3, page 66 of the 2006 Penguin edition. The clauses are
 * shown alone on stage, so this record is the only place the citation lives —
 * it is published to the DOM as data rather than painted over the frame.
 */
export const DIRECTORS_CUT_SAGAN_SOURCE = {
  attribution: 'Carl Sagan',
  work: 'The Varieties of Scientific Experience: A Personal View of the Search for God',
  publisher: 'Penguin',
  year: 2006,
  locator: 'ch. 3, p. 66',
  citation: 'Carl Sagan, The Varieties of Scientific Experience: A Personal View of the Search for God (Penguin, 2006), ch. 3, p. 66',
} as const

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * The companion's own source time for a soundtrack time inside its window.
 * Outside the window it returns the parked frame, which is what the player is
 * held on before the reveal and after the corner is cleared.
 */
export function companionSourceTimeAt(time: number): number {
  if (time <= DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart) {
    return COMPANION_SOURCE_PARK_SECONDS
  }
  const elapsed = Math.min(time, DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
    - DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart
  return COMPANION_SOURCE_PARK_SECONDS + elapsed
}

/** Whether the companion should be rolling (it plays hidden before the reveal). */
export function directorsCutCompanionPlaying(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart
    && time < DIRECTORS_CUT_FINALE_ANCHORS.companionEnd
}

/** Whether the corner is on stage. */
export function directorsCutCompanionVisible(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
    && time < DIRECTORS_CUT_FINALE_ANCHORS.companionEnd
}

/** Whether the missing-scientist bulletin is on stage. */
export function directorsCutBulletinVisible(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart
    && time < DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd
}

/**
 * Night blend of the Collapse plate: 0 on the finale beat, 1 on the Become
 * Legend cue, and held at 1 for the rest of the show. Derived from the clock
 * rather than run as a CSS animation so a backward seek restores the day plate
 * instead of leaving a finished animation on stage.
 */
export function directorsCutCollapseNightOpacity(time: number): number {
  const span = DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd - DIRECTORS_CUT_FINALE_ANCHORS.collapseDayStart
  if (span <= 0) {
    return time >= DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd ? 1 : 0
  }
  return clampUnit((time - DIRECTORS_CUT_FINALE_ANCHORS.collapseDayStart) / span)
}

/** Whether the first clause is on stage (including its own fade out). */
export function directorsCutExtinctionVisible(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart
    && time < DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd
}

/** Whether the first clause has begun fading out. */
export function directorsCutExtinctionFading(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.extinctionFadeStart
}

/** Whether the second clause is on stage. It never leaves before the black. */
export function directorsCutSurvivalVisible(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.survivalStart
}

/**
 * Whether the terminal fade has been engaged.
 *
 * This is a latch on the clock, not a per-tick opacity: the component turns the
 * fade on once and lets CSS finish it. A YouTube clock routinely plateaus near
 * the end of an upload, and a fade computed from `(time - start) / span` would
 * freeze half-way and leave the show sitting on a grey frame.
 */
export function directorsCutTerminalFadeEngaged(time: number): boolean {
  return time >= DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart
}

/** Duration the terminal CSS fade is given, in seconds. */
export const DIRECTORS_CUT_TERMINAL_FADE_SECONDS
  = DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd - DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart

/**
 * The Collapse plates. Upstream replaced Bluefin's eleventh monthly pair with
 * this artwork; the Director's Cut intro already opens on the night plate, and
 * the finale turns the same scene from day to night under the closing quote.
 */
export const DIRECTORS_CUT_COLLAPSE_DAY_IMAGE = 'wolves-intro/bluefin-collapse-day.webp'
export const DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE = 'wolves-intro/bluefin-collapse-night.webp'
