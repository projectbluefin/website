import { describe, expect, it } from 'vitest'
import { affordablePageCount, estimatePagesSeconds, loreProsePages } from '../components/wolves/lore/lore-pages'
import { PRE_END_THRESHOLD_S, TIME_POLL_MS } from '../config/wolves-cinematic'
import {
  COMPANION_SOURCE_BLACK_SECONDS,
  COMPANION_SOURCE_IMPACT_SECONDS,
  COMPANION_SOURCE_RUNTIME_SECONDS,
  COMPANION_SOURCE_SPACE_IMPACT_SECONDS,
  companionSourceTimeAt,
  DIRECTORS_CUT_CLAUSE_FADE_SAFETY_SECONDS,
  DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S,
  DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S,
  DIRECTORS_CUT_COMPANION_SIDECAR_INDEX,
  DIRECTORS_CUT_COMPANION_VIDEO_ID,
  DIRECTORS_CUT_EXTINCTION_CLAUSE,
  DIRECTORS_CUT_EXTINCTION_FADE_SECONDS,
  DIRECTORS_CUT_FINALE_ANCHOR_ORDER,
  DIRECTORS_CUT_FINALE_ANCHORS,
  DIRECTORS_CUT_SAGAN_SOURCE,
  DIRECTORS_CUT_SURVIVAL_CLAUSE,
  directorsCutBulletinVisible,
  directorsCutCollapseNightOpacity,
  directorsCutCompanionPlaying,
  directorsCutCompanionReadinessExpired,
  directorsCutCompanionVisible,
  directorsCutExtinctionVisible,
  directorsCutSurvivalVisible,
  directorsCutTerminalFadeEngaged,
} from '../data/wolves-directors-cut-finale'
import { DIRECTORS_CUT_BULLETIN_ARTIFACT_ID, DIRECTORS_CUT_BULLETIN_END, DIRECTORS_CUT_BULLETIN_START, DIRECTORS_CUT_FINALE_START } from '../data/wolves-directors-cut-timeline'
import { loadAllLoreRecords } from '../data/wolves-lore-records'
import { TRACK_ZERO_BEAT_TIMES, TRACK_ZERO_SECTIONS } from '../data/wolves-track-zero-beats'
import { TRACKZERO_SIDECAR_VIDEO_IDS } from '../data/wolves-track-zero-sidecar'

/** The authored runtime of the one Director's Cut segment (Track 0, LASru9j0oIc). */
const SEGMENT_DURATION = 424

function isMeasuredBeat(value: number): boolean {
  return TRACK_ZERO_BEAT_TIMES.includes(value)
}

describe('director\'s cut finale anchors', () => {
  it('cuts every show-clock anchor on a measured Track 0 beat', () => {
    for (const [name, seconds] of Object.entries(DIRECTORS_CUT_FINALE_ANCHORS)) {
      expect(isMeasuredBeat(seconds), `${name} (${seconds}) is not an entry of TRACK_ZERO_BEAT_TIMES`).toBe(true)
    }
  })

  it('orders the named anchors monotonically', () => {
    const values = DIRECTORS_CUT_FINALE_ANCHOR_ORDER.map(name => DIRECTORS_CUT_FINALE_ANCHORS[name])
    for (let index = 1; index < values.length; index++) {
      expect(
        values[index]! >= values[index - 1]!,
        `${DIRECTORS_CUT_FINALE_ANCHOR_ORDER[index]} (${values[index]}) precedes ${DIRECTORS_CUT_FINALE_ANCHOR_ORDER[index - 1]} (${values[index - 1]})`,
      ).toBe(true)
    }
  })

  it('names every anchor exactly once in the declared order', () => {
    expect([...DIRECTORS_CUT_FINALE_ANCHOR_ORDER].sort()).toEqual(Object.keys(DIRECTORS_CUT_FINALE_ANCHORS).sort())
    expect(new Set(DIRECTORS_CUT_FINALE_ANCHOR_ORDER).size).toBe(DIRECTORS_CUT_FINALE_ANCHOR_ORDER.length)
  })

  it('opens the cover on the schedule\'s own finale beat', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.coverStart).toBe(DIRECTORS_CUT_FINALE_START)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.coverStart).toBe(TRACK_ZERO_SECTIONS.bkEnd)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.collapseDayStart).toBe(DIRECTORS_CUT_FINALE_START)
  })

  it('pre-arms the companion player before the cover, not after it', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.coverStart)
    // A cold YouTube mount that starts inside its own visible window shows a
    // black frame on a theater screen. Ten seconds is the measured floor the
    // standard sidecar's own 1s deferral plus a cold API load needs.
    expect(DIRECTORS_CUT_FINALE_ANCHORS.coverStart - DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm).toBeGreaterThanOrEqual(10)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal - DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm).toBeGreaterThanOrEqual(30)
  })

  it('starts the companion rolling one measured beat before it is revealed', () => {
    const playIndex = TRACK_ZERO_BEAT_TIMES.indexOf(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    const revealIndex = TRACK_ZERO_BEAT_TIMES.indexOf(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(playIndex).toBeGreaterThan(0)
    expect(revealIndex - playIndex).toBe(1)
  })

  it('carries the missing-scientist bulletin in from its earlier lore window', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart).toBe(DIRECTORS_CUT_BULLETIN_START)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBe(DIRECTORS_CUT_BULLETIN_END)
    // The bulletin opens before the finale cover and is cleared on its own
    // companion-play anchor, so the record is never re-timed or re-paged when
    // the frame changes hands.
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.coverStart)
    // Seven pages of news transcript are gone before the asteroid arrives. The
    // bulletin used to run to the Become Legend cue, which paged a transcript
    // across the impact reveal and handed the frame to the first Sagan clause
    // with the column still full.
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBe(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
  })

  it('clears the bulletin before the impact and closing quote', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBe(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart)
    expect(directorsCutBulletinVisible(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)).toBe(false)
    expect(directorsCutBulletinVisible(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart - 0.001)).toBe(false)
  })

  it('clears the bulletin only after its last authored page has been read', () => {
    // Clearing early is only safe because the pages are affordable inside the
    // *paging* window and finish being read before the clearing beat. If a
    // page were still being read at `bulletinEnd`, this cut would drop
    // authored content in front of the room rather than tidy the frame.
    const record = loadAllLoreRecords().find(entry => entry.id === DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    expect(record, `${DIRECTORS_CUT_BULLETIN_ARTIFACT_ID} is not a registered lore record`).toBeTruthy()
    const pages = loreProsePages(record!.body)
    const pagingWindow = DIRECTORS_CUT_BULLETIN_END - DIRECTORS_CUT_BULLETIN_START
    expect(affordablePageCount(pages, pagingWindow)).toBe(pages.length)
    const lastPageReadBy = DIRECTORS_CUT_BULLETIN_START + estimatePagesSeconds(pages)
    expect(lastPageReadBy).toBeLessThanOrEqual(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
  })

  it('lands the quote ending on the Become Legend cue', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart).toBe(TRACK_ZERO_SECTIONS.finaleStart)
  })
})

describe('director\'s cut companion video', () => {
  it('controls the second authored Track 0 sidecar entry', () => {
    expect(DIRECTORS_CUT_COMPANION_SIDECAR_INDEX).toBe(1)
    expect(TRACKZERO_SIDECAR_VIDEO_IDS[DIRECTORS_CUT_COMPANION_SIDECAR_INDEX]).toBe(DIRECTORS_CUT_COMPANION_VIDEO_ID)
    expect(DIRECTORS_CUT_COMPANION_VIDEO_ID).toBe('PjryN2F6fF0')
  })

  it('keeps the measured source frames inside the source runtime', () => {
    expect(COMPANION_SOURCE_IMPACT_SECONDS).toBeLessThan(COMPANION_SOURCE_SPACE_IMPACT_SECONDS)
    expect(COMPANION_SOURCE_SPACE_IMPACT_SECONDS).toBeLessThan(COMPANION_SOURCE_BLACK_SECONDS)
    expect(COMPANION_SOURCE_BLACK_SECONDS).toBeLessThan(COMPANION_SOURCE_RUNTIME_SECONDS)
  })

  it('seeks to a measured lead frame, not to the impact cut itself', () => {
    const lead = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal - DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart
    expect(companionSourceTimeAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart))
      .toBeCloseTo(COMPANION_SOURCE_IMPACT_SECONDS - lead, 6)
  })

  it('puts the measured impact frame on the reveal beat', () => {
    expect(companionSourceTimeAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)).toBeCloseTo(COMPANION_SOURCE_IMPACT_SECONDS, 6)
  })

  it('puts the measured from-space impact inside the visible window', () => {
    const spaceImpactAt = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
      + (COMPANION_SOURCE_SPACE_IMPACT_SECONDS - COMPANION_SOURCE_IMPACT_SECONDS)
    expect(spaceImpactAt).toBeGreaterThan(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(spaceImpactAt).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
    expect(directorsCutCompanionVisible(spaceImpactAt)).toBe(true)
  })

  it('reaches the source\'s own black frame before the corner is cleared', () => {
    const blackAt = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
      + (COMPANION_SOURCE_BLACK_SECONDS - COMPANION_SOURCE_IMPACT_SECONDS)
    expect(blackAt).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
  })

  it('never runs the source past its last frame', () => {
    expect(companionSourceTimeAt(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)).toBeLessThan(COMPANION_SOURCE_RUNTIME_SECONDS)
  })

  it('plays only inside the approved window', () => {
    expect(directorsCutCompanionPlaying(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart - 0.01)).toBe(false)
    expect(directorsCutCompanionPlaying(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)).toBe(true)
    expect(directorsCutCompanionPlaying(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd - 0.01)).toBe(true)
    expect(directorsCutCompanionPlaying(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)).toBe(false)
    expect(directorsCutCompanionPlaying(SEGMENT_DURATION)).toBe(false)
  })

  it('stays hidden until its approved reveal', () => {
    expect(directorsCutCompanionVisible(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)).toBe(false)
    expect(directorsCutCompanionVisible(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)).toBe(true)
    expect(directorsCutCompanionVisible(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)).toBe(false)
  })

  it('corrects only material drift', () => {
    expect(DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S).toBeGreaterThan(0.1)
    expect(DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S).toBeLessThanOrEqual(1)
  })

  it('gives readiness a deadline measured from the source, not a round number', () => {
    // A corner that has still not reported playback by the film's own last cut
    // can no longer show the audience anything the edit was built around: the
    // blast is past, and what is left is a shot already fading to black. The
    // deadline is therefore that cut, in show time, not an invented grace.
    expect(DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S).toBeCloseTo(
      DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
      + (COMPANION_SOURCE_SPACE_IMPACT_SECONDS - COMPANION_SOURCE_IMPACT_SECONDS),
      6,
    )
    expect(DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S).toBeGreaterThan(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
    expect(directorsCutCompanionReadinessExpired(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)).toBe(false)
    expect(directorsCutCompanionReadinessExpired(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)).toBe(false)
    expect(directorsCutCompanionReadinessExpired(DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S - 0.001)).toBe(false)
    expect(directorsCutCompanionReadinessExpired(DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S)).toBe(true)
  })
})

describe('director\'s cut collapse frame', () => {
  it('opens on the day plate and ends on the night plate', () => {
    expect(directorsCutCollapseNightOpacity(DIRECTORS_CUT_FINALE_ANCHORS.collapseDayStart)).toBe(0)
    expect(directorsCutCollapseNightOpacity(DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd)).toBe(1)
    expect(directorsCutCollapseNightOpacity(SEGMENT_DURATION)).toBe(1)
  })

  it('advances monotonically with the soundtrack clock', () => {
    let previous = -1
    for (let time = DIRECTORS_CUT_FINALE_ANCHORS.collapseDayStart; time <= DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd; time += 0.5) {
      const value = directorsCutCollapseNightOpacity(time)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('restores the day plate when the show is seeked back before the finale', () => {
    expect(directorsCutCollapseNightOpacity(DIRECTORS_CUT_FINALE_START - 1)).toBe(0)
  })
})

describe('director\'s cut quote clauses', () => {
  it('publishes the verified Sagan clauses verbatim', () => {
    expect(DIRECTORS_CUT_EXTINCTION_CLAUSE).toBe('Extinction is the rule.')
    expect(DIRECTORS_CUT_SURVIVAL_CLAUSE).toBe('Survival is the exception.')
  })

  it('cites the book it is actually from, never Cosmos', () => {
    expect(DIRECTORS_CUT_SAGAN_SOURCE.attribution).toBe('Carl Sagan')
    expect(DIRECTORS_CUT_SAGAN_SOURCE.work).toBe('The Varieties of Scientific Experience: A Personal View of the Search for God')
    expect(DIRECTORS_CUT_SAGAN_SOURCE.publisher).toBe('Penguin')
    expect(DIRECTORS_CUT_SAGAN_SOURCE.year).toBe(2006)
    expect(DIRECTORS_CUT_SAGAN_SOURCE.locator).toBe('ch. 3, p. 66')
    expect(DIRECTORS_CUT_SAGAN_SOURCE.citation).not.toMatch(/cosmos/i)
  })

  it('never shows the two clauses at the same time', () => {
    for (let time = DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart - 2; time <= 424; time += 0.05) {
      const both = directorsCutExtinctionVisible(time) && directorsCutSurvivalVisible(time)
      expect(both, `both clauses are visible at ${time.toFixed(2)}s`).toBe(false)
    }
  })

  it('fades the first clause completely before the second appears', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.survivalStart)
    expect(directorsCutExtinctionVisible(DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd)).toBe(false)
    expect(directorsCutSurvivalVisible(DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd)).toBe(false)
  })

  it('finishes the first clause\'s fade with a whole poll interval to spare', () => {
    // The fade is engaged by a clock crossing, so it can start up to one
    // published tick late, and the compositor needs a frame after that. A CSS
    // fade authored to within 84 ms of the removal beat — which is less than
    // one 100 ms poll — is therefore not "finished just in time": on a late
    // tick the clause is still visible at the instant it is removed, and the
    // room sees it disappear rather than fade.
    const span = DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd - DIRECTORS_CUT_FINALE_ANCHORS.extinctionFadeStart
    expect(DIRECTORS_CUT_EXTINCTION_FADE_SECONDS).toBeCloseTo(span - DIRECTORS_CUT_CLAUSE_FADE_SAFETY_SECONDS, 6)
    expect(DIRECTORS_CUT_CLAUSE_FADE_SAFETY_SECONDS).toBeGreaterThan((TIME_POLL_MS / 1000) * 2)
    expect(span - DIRECTORS_CUT_EXTINCTION_FADE_SECONDS).toBeGreaterThan(TIME_POLL_MS / 1000)
    // …and still long enough to read as a fade rather than a cut.
    expect(DIRECTORS_CUT_EXTINCTION_FADE_SECONDS).toBeGreaterThanOrEqual(0.6)
    expect(DIRECTORS_CUT_EXTINCTION_FADE_SECONDS).toBeLessThan(span)
  })

  it('holds each clause long enough to be read from the back row', () => {
    const extinctionHold = DIRECTORS_CUT_FINALE_ANCHORS.extinctionFadeStart - DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart
    const survivalHold = DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart - DIRECTORS_CUT_FINALE_ANCHORS.survivalStart
    expect(extinctionHold).toBeGreaterThanOrEqual(4)
    expect(survivalHold).toBeGreaterThanOrEqual(4)
  })

  it('carries the survival clause through the outro to the terminal fade', () => {
    expect(directorsCutSurvivalVisible(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)).toBe(true)
    expect(directorsCutSurvivalVisible(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd - 0.001)).toBe(true)
    expect(directorsCutSurvivalVisible(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd)).toBe(false)
  })
})

describe('director\'s cut terminal fade', () => {
  it('begins before the transport\'s final cutoff', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart).toBeLessThan(SEGMENT_DURATION - PRE_END_THRESHOLD_S)
    // The last 0.3s is not an animation budget: the fade must be over before the
    // transport stops publishing time at all.
    expect(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd).toBeLessThan(SEGMENT_DURATION - PRE_END_THRESHOLD_S)
  })

  it('engages on the fade beat and stays engaged to the end of the segment', () => {
    expect(directorsCutTerminalFadeEngaged(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart - 0.01)).toBe(false)
    expect(directorsCutTerminalFadeEngaged(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)).toBe(true)
    expect(directorsCutTerminalFadeEngaged(SEGMENT_DURATION)).toBe(true)
  })

  it('is long enough to read as a fade and short enough to finish on the music', () => {
    const duration = DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd - DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart
    expect(duration).toBeGreaterThanOrEqual(1.5)
    expect(duration).toBeLessThanOrEqual(6)
  })

  it('lets go of the frame only after every other finale beat has finished', () => {
    expect(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart).toBeGreaterThan(DIRECTORS_CUT_FINALE_ANCHORS.survivalStart)
    expect(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart).toBeGreaterThan(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
  })
})
