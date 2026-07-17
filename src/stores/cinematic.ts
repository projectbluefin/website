import { defineStore } from 'pinia'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'

export type CinematicPhase = 'lobby' | 'cinematic' | 'finished'

export interface SpotifyPlaybackState {
  status: 'inactive' | 'initializing' | 'ready' | 'playing' | 'paused' | 'error'
  trackTitle: string
  trackArtist: string
  error: string
}

/**
 * All cinematic runtime state lives here. The player composable and the Spotify
 * composable publish into this store; the media widget, captions, and nameplates
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
    spotify: {
      status: 'inactive',
      trackTitle: '',
      trackArtist: '',
      error: '',
    } as SpotifyPlaybackState,
  }),

  getters: {
    segment: state => CINEMATIC_SEGMENTS[state.segmentIndex] ?? CINEMATIC_SEGMENTS[0],
    segmentCount: () => CINEMATIC_SEGMENTS.length,
    totalElapsed: state => state.completedElapsed + state.segmentElapsed,
    segmentProgress: state =>
      state.segmentDuration > 0 ? Math.min(1, state.segmentElapsed / state.segmentDuration) : 0,
    isLastSegment: state => state.segmentIndex >= CINEMATIC_SEGMENTS.length - 1,
  },

  actions: {
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
    finish() {
      this.phase = 'finished'
      this.playing = false
      this.crossfading = false
    },
    setSpotifyState(patch: Partial<SpotifyPlaybackState>) {
      this.spotify = { ...this.spotify, ...patch }
    },
  },
})
