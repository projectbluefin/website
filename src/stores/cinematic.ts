import { defineStore } from 'pinia'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { buildIntroVideoSequence, isTextSegment } from '@/data/wolves-intro-sequence'

export type CinematicPhase
  = 'lobby'
    | 'intro'
    | 'cinematic'
    | 'creator-shorts'
    | 'finished'

type TimelinePhase = Exclude<CinematicPhase, 'lobby' | 'finished'>

interface TimelineEntry {
  phase: TimelinePhase
  segmentIndex: number
  segmentId: string
  segmentDuration: number
  seekDuration: number
  nativeStart: number
}

export interface OverallTimelineTarget {
  phase: TimelinePhase
  segmentIndex: number
  segmentId: string
  segmentElapsed: number
  segmentDuration: number
  seekRatio: number
  nativeTime: number
  overallElapsed: number
  overallDuration: number
}

const INTRO_SEGMENTS = buildIntroVideoSequence()
const CINEMATIC_AUTHORED_DURATIONS = [424, 347, 251, 384, 193, 234, 271] as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function introSegmentDuration(index: number): number {
  const segment = INTRO_SEGMENTS[index]
  if (!segment) {
    return 0
  }
  if (isTextSegment(segment)) {
    return segment.duration
  }
  const nativeStart = segment.startOffset ?? 0
  const nativeEnd = segment.maxDuration ?? nativeStart
  return Math.max(0, nativeEnd - nativeStart)
}

function introSeekDuration(index: number): number {
  const segment = INTRO_SEGMENTS[index]
  if (!segment) {
    return 0
  }
  if (isTextSegment(segment)) {
    return segment.duration
  }
  return segment.maxDuration ?? introSegmentDuration(index)
}

function introNativeStart(index: number): number {
  const segment = INTRO_SEGMENTS[index]
  return segment && !isTextSegment(segment) ? (segment.startOffset ?? 0) : 0
}

function cinematicSegmentDuration(index: number): number {
  return CINEMATIC_AUTHORED_DURATIONS[index] ?? 0
}

function cinematicNativeStart(index: number): number {
  return CINEMATIC_SEGMENTS[index]?.startSeconds ?? 0
}

const INTRO_TIMELINE: TimelineEntry[] = INTRO_SEGMENTS.map((segment, index) => ({
  phase: 'intro',
  segmentIndex: index,
  segmentId: segment.id,
  segmentDuration: introSegmentDuration(index),
  seekDuration: introSeekDuration(index),
  nativeStart: introNativeStart(index),
}))

const CINEMATIC_TIMELINE: TimelineEntry[] = CINEMATIC_SEGMENTS.map((segment, index) => ({
  phase: 'cinematic',
  segmentIndex: index,
  segmentId: segment.youtubeId,
  segmentDuration: cinematicSegmentDuration(index),
  seekDuration: cinematicSegmentDuration(index),
  nativeStart: cinematicNativeStart(index),
}))

const OVERALL_TIMELINE = [...INTRO_TIMELINE, ...CINEMATIC_TIMELINE]

function sumTimelineDurations(entries: readonly TimelineEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.segmentDuration, 0)
}

export const INTRO_SEQUENCE_DURATION = sumTimelineDurations(INTRO_TIMELINE)
export const CINEMATIC_SEQUENCE_DURATION = sumTimelineDurations(CINEMATIC_TIMELINE)
export const OVERALL_SEQUENCE_DURATION = INTRO_SEQUENCE_DURATION + CINEMATIC_SEQUENCE_DURATION

function authoredSequenceElapsed(
  entries: readonly TimelineEntry[],
  segmentIndex: number,
  segmentElapsed: number,
): number {
  if (entries.length === 0) {
    return 0
  }
  const clampedIndex = clamp(segmentIndex, 0, entries.length - 1)
  const prior = entries.slice(0, clampedIndex).reduce((sum, entry) => sum + entry.segmentDuration, 0)
  const current = entries[clampedIndex]
  return prior + clamp(segmentElapsed, 0, current.segmentDuration)
}

export function resolveOverallElapsedTarget(elapsed: number): OverallTimelineTarget {
  const overallElapsed = clamp(elapsed, 0, OVERALL_SEQUENCE_DURATION)
  let consumed = 0
  const lastEntry = OVERALL_TIMELINE[OVERALL_TIMELINE.length - 1]

  for (const entry of OVERALL_TIMELINE) {
    const segmentEnd = consumed + entry.segmentDuration
    if (overallElapsed < segmentEnd || entry === lastEntry) {
      const segmentElapsed = entry === lastEntry
        ? clamp(overallElapsed - consumed, 0, entry.segmentDuration)
        : Math.max(0, overallElapsed - consumed)
      const nativeTime = entry.nativeStart + segmentElapsed
      const denominator = entry.phase === 'intro' ? entry.seekDuration : entry.segmentDuration
      const numerator = entry.phase === 'intro' ? nativeTime : segmentElapsed
      return {
        phase: entry.phase,
        segmentIndex: entry.segmentIndex,
        segmentId: entry.segmentId,
        segmentElapsed,
        segmentDuration: entry.segmentDuration,
        seekRatio: denominator > 0 ? clamp(numerator / denominator, 0, 1) : 0,
        nativeTime,
        overallElapsed,
        overallDuration: OVERALL_SEQUENCE_DURATION,
      }
    }
    consumed = segmentEnd
  }

  return {
    phase: 'cinematic',
    segmentIndex: CINEMATIC_TIMELINE.length - 1,
    segmentId: CINEMATIC_TIMELINE[CINEMATIC_TIMELINE.length - 1]?.segmentId ?? '',
    segmentElapsed: CINEMATIC_TIMELINE[CINEMATIC_TIMELINE.length - 1]?.segmentDuration ?? 0,
    segmentDuration: CINEMATIC_TIMELINE[CINEMATIC_TIMELINE.length - 1]?.segmentDuration ?? 0,
    seekRatio: 1,
    nativeTime: (CINEMATIC_TIMELINE[CINEMATIC_TIMELINE.length - 1]?.nativeStart ?? 0)
      + (CINEMATIC_TIMELINE[CINEMATIC_TIMELINE.length - 1]?.segmentDuration ?? 0),
    overallElapsed: OVERALL_SEQUENCE_DURATION,
    overallDuration: OVERALL_SEQUENCE_DURATION,
  }
}

export function resolveOverallRatioTarget(ratio: number): OverallTimelineTarget {
  return resolveOverallElapsedTarget(clamp(ratio, 0, 1) * OVERALL_SEQUENCE_DURATION)
}

/**
 * All cinematic runtime state lives here. The player composable and the intro
 * overlay publish into this store; the media widget, captions, and nameplates
 * are pure subscribers. Components never pass playback data to each other.
 */
export const useCinematicStore = defineStore('cinematic', {
  state: () => ({
    phase: 'lobby' as CinematicPhase,
    segmentIndex: 0,
    /** Seconds elapsed inside the current segment (relative to any authored trim). */
    segmentElapsed: 0,
    /** Current time on the source video's native timeline (drives caption sync). */
    nativeTime: 0,
    /** Reported duration of the current segment (0 until the player knows it). */
    segmentDuration: 0,
    /** Seconds of fully completed segments (recorded at each handoff). */
    completedElapsed: 0,
    playing: false,
    crossfading: false,
    /** Whether the one-time Creator Shorts interstitial has already been shown. */
    shortsConsumed: false,
    /**
     * When the authored intro overlay is on stage it owns playback; this override
     * feeds the hero widget its display metadata and transport gating instead of
     * the segment config.
     */
    displayOverride: null as null | {
      chapter: string
      title: string
      artist: string
      artwork: string
      canPrevious: boolean
    },
  }),

  getters: {
    segment: state => CINEMATIC_SEGMENTS[state.segmentIndex] ?? CINEMATIC_SEGMENTS[0],
    segmentCount: () => CINEMATIC_SEGMENTS.length,
    totalElapsed: state => state.completedElapsed + state.segmentElapsed,
    segmentProgress: state =>
      state.segmentDuration > 0 ? Math.min(1, state.segmentElapsed / state.segmentDuration) : 0,
    sequenceDuration(state): number {
      if (state.phase === 'intro') {
        return INTRO_SEQUENCE_DURATION
      }
      if (state.phase === 'cinematic' || state.phase === 'finished') {
        return CINEMATIC_SEQUENCE_DURATION
      }
      return 0
    },
    sequenceElapsed(state): number {
      if (state.phase === 'intro') {
        return authoredSequenceElapsed(INTRO_TIMELINE, state.segmentIndex, state.segmentElapsed)
      }
      if (state.phase === 'cinematic' || state.phase === 'finished') {
        return authoredSequenceElapsed(CINEMATIC_TIMELINE, state.segmentIndex, state.segmentElapsed)
      }
      return 0
    },
    overallDuration: () => OVERALL_SEQUENCE_DURATION,
    overallElapsed(): number {
      if (this.phase === 'intro') {
        return this.sequenceElapsed
      }
      if (this.phase === 'cinematic' || this.phase === 'finished') {
        return INTRO_SEQUENCE_DURATION + this.sequenceElapsed
      }
      return 0
    },
    overallProgress(): number {
      return OVERALL_SEQUENCE_DURATION > 0 ? Math.min(1, this.overallElapsed / OVERALL_SEQUENCE_DURATION) : 0
    },
    isLastSegment: state => state.segmentIndex >= CINEMATIC_SEGMENTS.length - 1,
    /** What the hero widget shows: the intro override when present, else the segment. */
    display(state): { chapter: string, title: string, artist: string, artwork: string, counter: string } {
      if (state.displayOverride) {
        return { ...state.displayOverride, counter: state.displayOverride.chapter }
      }
      const segment = this.segment
      return {
        chapter: segment.chapter,
        title: segment.title,
        artist: segment.artist,
        artwork: segment.artwork,
        counter: `${segment.chapter} · ${state.segmentIndex + 1}/${CINEMATIC_SEGMENTS.length}`,
      }
    },
    widgetCanPrevious(state): boolean {
      if (state.displayOverride) {
        return state.displayOverride.canPrevious
      }
      return state.segmentIndex > 0 && !state.crossfading
    },
    widgetCanNext(state): boolean {
      if (state.displayOverride) {
        return true // the intro's Next doubles as Skip
      }
      return !this.isLastSegment && !state.crossfading
    },
  },

  actions: {
    /** Lobby exit: the authored intro overlay (prologue + guardian trailer) plays first. */
    enterIntro() {
      this.phase = 'intro'
      this.segmentIndex = 0
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = INTRO_TIMELINE[0]?.segmentDuration ?? 0
    },
    enterCinematic() {
      this.phase = 'cinematic'
      this.segmentIndex = 0
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = CINEMATIC_TIMELINE[0]?.segmentDuration ?? 0
    },
    updateTime(elapsed: number, duration: number, nativeTime?: number) {
      this.segmentElapsed = elapsed
      this.nativeTime = nativeTime ?? elapsed
      if (duration > 0) {
        this.segmentDuration = duration
      }
    },
    syncIntroStatus(payload: { segmentIndex: number, segmentElapsed: number, segmentDuration: number, nativeTime: number }) {
      this.phase = 'intro'
      this.segmentIndex = clamp(payload.segmentIndex, 0, INTRO_TIMELINE.length - 1)
      this.segmentElapsed = Math.max(0, payload.segmentElapsed)
      this.segmentDuration = payload.segmentDuration > 0
        ? payload.segmentDuration
        : (INTRO_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0)
      this.nativeTime = Math.max(0, payload.nativeTime)
    },
    setPlaying(playing: boolean) {
      this.playing = playing
    },
    beginCrossfade() {
      this.crossfading = true
    },
    advanceSegment() {
      this.completedElapsed += this.segmentDuration || this.segmentElapsed
      this.segmentIndex = Math.min(this.segmentIndex + 1, CINEMATIC_SEGMENTS.length - 1)
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0
      this.crossfading = false
    },
    /** Manual skip to an arbitrary segment (prev/next); only watched time accrues. */
    jumpToSegment(index: number) {
      this.completedElapsed += this.segmentElapsed
      this.segmentIndex = Math.min(Math.max(index, 0), CINEMATIC_SEGMENTS.length - 1)
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0
      this.crossfading = false
    },
    /**
     * True exactly once: the natural or manual Part I -> Part II boundary, before
     * the one-time Creator Shorts interstitial has been shown.
     */
    creatorShortsDueFor(targetIndex: number): boolean {
      return this.phase === 'cinematic'
        && this.segmentIndex === 0
        && targetIndex === 1
        && !this.shortsConsumed
    },
    /** Bridges Part I into the Creator Shorts interstitial instead of Part II. */
    enterCreatorShorts() {
      this.completedElapsed += this.segmentDuration || this.segmentElapsed
      this.segmentIndex = 1
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = 0
      this.playing = false
      this.crossfading = false
      this.shortsConsumed = true
      this.phase = 'creator-shorts'
    },
    /** Resumes Part II once the Creator Shorts interstitial has finished. */
    completeCreatorShorts() {
      this.phase = 'cinematic'
    },
    finish() {
      this.phase = 'finished'
      this.segmentIndex = CINEMATIC_SEGMENTS.length - 1
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? this.segmentDuration
      this.segmentElapsed = this.segmentDuration
      this.nativeTime = cinematicNativeStart(this.segmentIndex) + this.segmentDuration
      this.playing = false
      this.crossfading = false
    },
    setDisplayOverride(override: typeof this.displayOverride) {
      this.displayOverride = override
    },
    /** Fresh clock for the cinematic proper; intro watch time does not count. */
    resetClock() {
      this.segmentElapsed = 0
      this.completedElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = 0
    },
  },
})
