import { defineStore } from 'pinia'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'

export type CinematicPhase
  = 'lobby'
    | 'intro'
    | 'cinematic'
    | 'creator-shorts'
    | 'finished'

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
    },
    enterCinematic() {
      this.phase = 'cinematic'
    },
    updateTime(elapsed: number, duration: number, nativeTime?: number) {
      this.segmentElapsed = elapsed
      this.nativeTime = nativeTime ?? elapsed
      if (duration > 0) {
        this.segmentDuration = duration
      }
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
      this.segmentDuration = 0
      this.crossfading = false
    },
    /** Manual skip to an arbitrary segment (prev/next); only watched time accrues. */
    jumpToSegment(index: number) {
      this.completedElapsed += this.segmentElapsed
      this.segmentIndex = Math.min(Math.max(index, 0), CINEMATIC_SEGMENTS.length - 1)
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = 0
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
