import type { ExperienceManifest, ExperienceSegment, PresentationProfile } from '@/config/experience-manifest'
import type { IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { defineStore } from 'pinia'
import { CINEMATIC_SEGMENTS, DEFAULT_CROSSFADE_MS, DIRECTORS_CUT_EUROPA_INTRO_SEGMENT, PRE_END_THRESHOLD_S } from '@/config/wolves-cinematic'
import { DIRECTORS_CUT_FINALE_ANCHORS } from '@/data/wolves-directors-cut-finale'
import { buildIntroVideoSequence, isTextSegment } from '@/data/wolves-intro-sequence'

export type CinematicPhase
  = 'lobby'
    | 'intro'
    | 'cinematic'

type TimelinePhase = Exclude<CinematicPhase, 'lobby'>

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

/**
 * The intro list currently on stage. `/wolves/` can run two different authored
 * intros — the standard `buildIntroVideoSequence()` and the Director's Cut —
 * and they differ in length, segments, and durations. `WolvesApp.vue` publishes
 * the active one through `setIntroSequence()` before entering the intro phase,
 * so index resolution and every duration readout follow the sequence the
 * audience is actually watching.
 */
let INTRO_SEGMENTS: readonly IntroVideoSpec[] = buildIntroVideoSequence()
/**
 * Measured runtime, in seconds, of each cinematic segment's source video — in
 * `CINEMATIC_SEGMENTS` order, one entry per segment.
 *
 * This is a SEVEN-part show, and today the cinematic segments align 1:1 with the
 * seven authored tracks in `public/wolves-playlist.json`: segment index N is
 * playlist track N, for N = 0..6.
 *
 * These are MEASURED values, not authored guesses. Re-measure by reading the ids
 * out of `CINEMATIC_SEGMENTS` in order and running:
 *
 *   yt-dlp --skip-download --print "%(duration)s" \
 *     LASru9j0oIc amKIngGUvCk 9skBT5TUqzo Z--vLaXdlgk 5OFLFVC11Cg san94Q93IcY rYkYLIYvI18
 *
 * The 1:1 alignment is a property of the current curation, not a guarantee: a
 * future curation could again drop or reorder a track here. That is why
 * consumers resolve a playlist track by segment id rather than by index, and why
 * this array is always built from `CINEMATIC_SEGMENTS` order rather than by
 * slicing the playlist. Because `authoredSequenceElapsed()` CLAMPS
 * `segmentElapsed` to these values, a wrong entry freezes the transport's TOTAL
 * readout for the remainder of that segment — a stalled clock in front of a live
 * audience with no way to recover.
 *
 * `wolvesCinematicStores.test.ts` asserts this array stays aligned with
 * `CINEMATIC_SEGMENTS` by length and by segment id order.
 */
const CINEMATIC_AUTHORED_DURATIONS = [424, 347, 251, 384, 193, 234, 271] as const

/**
 * Measured off the finished render (exactly 95.000s), not read off YouTube's
 * rounded duration, because the seek-bar timeline is derived from it.
 */
const DIRECTORS_CUT_EUROPA_INTRO_SECONDS = 95

/** `presentationProfile` value for the standard, seven-part Wolves show. */
export const WOLVES_STANDARD_PROFILE_ID: PresentationProfile = 'wolves-standard'
/** `presentationProfile` value for the Director's Cut. */
export const WOLVES_DIRECTORS_CUT_PROFILE_ID: PresentationProfile = 'wolves-directors-cut'

/**
 * True for either authored Wolves show — the seven-part standard cut or the
 * Director's Cut — false for a generic back-catalogue album (or an
 * experience that has not set a profile at all). This is the typed
 * replacement for raw `experienceId === WOLVES_EXPERIENCE.id` checks, which
 * read a Director's Cut playthrough as a generic album because its manifest
 * carries a different `id`. Code that means "the standard seven-part show
 * specifically" (e.g. restoring it after a Director's Cut run) must still
 * compare against `WOLVES_STANDARD_PROFILE_ID` explicitly rather than call
 * this helper.
 */
export function isWolvesPresentationProfile(profile: PresentationProfile | undefined): boolean {
  return profile === WOLVES_STANDARD_PROFILE_ID || profile === WOLVES_DIRECTORS_CUT_PROFILE_ID
}

/**
 * The authored Wolves cinematic expressed as a generic experience manifest —
 * the default the runtime boots with. Back-catalogue albums load their own
 * manifests through loadExperience(); the renderer is identical for both.
 */
export const WOLVES_EXPERIENCE: ExperienceManifest = {
  id: 'seven-days-to-the-wolves',
  sourcePlaylistId: 'PLA78oiE-RGAE',
  title: 'Seven Days to the Wolves',
  artwork: 'wolves-artwork/LASru9j0oIc.jpg',
  includeIntro: true,
  presentationProfile: WOLVES_STANDARD_PROFILE_ID,
  segments: CINEMATIC_SEGMENTS.map((segment, index) => ({
    ...segment,
    durationSeconds: CINEMATIC_AUTHORED_DURATIONS[index] ?? 0,
  })),
}

/**
 * The Director's Cut cinematic: 7 Days to the Wolves runs its full authored
 * length into its finale, then the Europa intro, which carries `crossfadeMs: 0`
 * so it hits the instant Track 0 ends — out of black, with no title slide and no
 * fade-in delay.
 *
 * This cut is a **fork** of the Wolves show, not a re-edit of it. It keeps 7
 * Days to the Wolves, which the show is named for, and everything after it is
 * new material authored for this cut. That is why Ghosts In The Mist is no
 * longer here: it belongs to the standard show, which still plays it and all
 * seven of its authored tracks, unchanged. Adding a legacy track back to this
 * list is the thing to stop and ask about.
 *
 * The Europa intro sits outside `CINEMATIC_SEGMENTS` because it belongs to this
 * cut alone; see the segment's own note for why it has to be one upload instead
 * of an embed of its three sources.
 *
 * The Director's Cut *intro* (prologue + Destiny trailer,
 * `buildDirectorsCutVideoSequence()`) is published separately through
 * `setIntroSequence()` — this manifest only carries the cinematic segments
 * `loadExperience()` swaps in.
 */
export const WOLVES_DIRECTORS_CUT_EXPERIENCE: ExperienceManifest = {
  id: 'wolves-directors-cut',
  title: 'Director\'s Cut',
  artwork: CINEMATIC_SEGMENTS[0].artwork,
  includeIntro: true,
  presentationProfile: WOLVES_DIRECTORS_CUT_PROFILE_ID,
  segments: [
    {
      ...CINEMATIC_SEGMENTS[0],
      durationSeconds: CINEMATIC_AUTHORED_DURATIONS[0],
    },
    {
      ...DIRECTORS_CUT_EUROPA_INTRO_SEGMENT,
      durationSeconds: DIRECTORS_CUT_EUROPA_INTRO_SECONDS,
    },
  ],
}

// Active experience: module-level so the timeline math below stays plain
// functions; the store's reactive `segments` state mirrors it.
let activeSegments: ExperienceSegment[] = WOLVES_EXPERIENCE.segments
let introIncluded = true

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
  return activeSegments[index]?.durationSeconds ?? 0
}

function cinematicNativeStart(index: number): number {
  return activeSegments[index]?.startSeconds ?? 0
}

function buildIntroTimeline(): TimelineEntry[] {
  return INTRO_SEGMENTS.map((segment, index) => ({
    phase: 'intro',
    segmentIndex: index,
    segmentId: segment.id,
    segmentDuration: introSegmentDuration(index),
    seekDuration: introSeekDuration(index),
    nativeStart: introNativeStart(index),
  }))
}

let INTRO_TIMELINE: TimelineEntry[] = buildIntroTimeline()

function buildCinematicTimeline(): TimelineEntry[] {
  return activeSegments.map((segment, index) => ({
    phase: 'cinematic',
    segmentIndex: index,
    segmentId: segment.youtubeId,
    segmentDuration: cinematicSegmentDuration(index),
    seekDuration: cinematicSegmentDuration(index),
    nativeStart: cinematicNativeStart(index),
  }))
}

let CINEMATIC_TIMELINE = buildCinematicTimeline()
let OVERALL_TIMELINE = [...INTRO_TIMELINE, ...CINEMATIC_TIMELINE]

function sumTimelineDurations(entries: readonly TimelineEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.segmentDuration, 0)
}

/**
 * Total authored runtime of the intro sequence currently on stage.
 *
 * Deliberately a live `let`, not a `const` snapshot: the Director's Cut intro is
 * a different list with a different runtime, and consumers import this binding
 * directly (`WolvesApp.vue`'s DEV `__wolvesDurations.intro()` hook and
 * `startCinematicStage()`). ES module bindings are live, so reassigning it here
 * updates every importer without changing a single call site.
 */
// eslint-disable-next-line import/no-mutable-exports -- live binding is the point: see above.
export let INTRO_SEQUENCE_DURATION = sumTimelineDurations(INTRO_TIMELINE)

function introSequenceDuration(): number {
  return introIncluded ? INTRO_SEQUENCE_DURATION : 0
}

function cinematicSequenceDuration(): number {
  return sumTimelineDurations(CINEMATIC_TIMELINE)
}

function overallSequenceDuration(): number {
  return introSequenceDuration() + cinematicSequenceDuration()
}

function rebuildTimelines() {
  CINEMATIC_TIMELINE = buildCinematicTimeline()
  OVERALL_TIMELINE = introIncluded
    ? [...INTRO_TIMELINE, ...CINEMATIC_TIMELINE]
    : [...CINEMATIC_TIMELINE]
}

/** Swap the intro list the timeline math is derived from. */
function applyIntroSequence(segments: readonly IntroVideoSpec[]) {
  INTRO_SEGMENTS = segments
  INTRO_TIMELINE = buildIntroTimeline()
  INTRO_SEQUENCE_DURATION = sumTimelineDurations(INTRO_TIMELINE)
  rebuildTimelines()
}

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
  const overallDuration = overallSequenceDuration()
  const overallElapsed = clamp(elapsed, 0, overallDuration)
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
        overallDuration,
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
    overallElapsed: overallDuration,
    overallDuration,
  }
}

export function resolveOverallRatioTarget(ratio: number): OverallTimelineTarget {
  return resolveOverallElapsedTarget(clamp(ratio, 0, 1) * overallSequenceDuration())
}

/**
 * All cinematic runtime state lives here. The player composable and the intro
 * overlay publish into this store; the media widget, captions, and nameplates
 * are pure subscribers. Components never pass playback data to each other.
 */
export const useCinematicStore = defineStore('cinematic', {
  state: () => ({
    phase: 'lobby' as CinematicPhase,
    /** Stable manifest identity used by experience-specific presentation rules. */
    experienceId: WOLVES_EXPERIENCE.id,
    /**
     * Which authored presentation is active: `'wolves-standard'`,
     * `'wolves-directors-cut'`, or `'generic'` for a back-catalogue album.
     * Set from the manifest in `loadExperience()`; typed consumers use
     * `isWolvesPresentation` or compare against a `*_PROFILE_ID` constant
     * rather than re-deriving this from `experienceId`.
     */
    presentationProfile: (WOLVES_EXPERIENCE.presentationProfile ?? 'generic') as PresentationProfile,
    /** Segments of the active experience (defaults to the Wolves cinematic). */
    segments: WOLVES_EXPERIENCE.segments as ExperienceSegment[],
    segmentIndex: 0,
    /**
     * Bumped whenever the module-level timelines are rebuilt (experience swap or
     * intro-sequence swap). Duration getters read it so they invalidate: without
     * a reactive dependency a Pinia getter computed from module state would cache
     * its first value forever.
     */
    timelineRevision: 0,
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
    /**
     * Whether the transport has run the active experience to its end and
     * stopped. Latched by `finish()` and released the moment the player
     * publishes an earlier time, so a backward seek out of the terminal state
     * is a clock event and needs no explicit reset call.
     *
     * This is an experience-level end, not a Track 0 one: in the multi-song
     * Director's Cut it latches at the end of Ghosts, the last segment, long
     * after Track 0's finale. The finale's terminal black is keyed to Track 0's
     * own clock instead (see `directorTerminalBlack`), because its
     * `terminalFadeEnd` anchor is authored ahead of the final
     * `PRE_END_THRESHOLD_S` the transport never publishes.
     */
    finished: false,
    /**
     * Where a crossfade in flight is headed. The overlay has to decide on the
     * incoming segment, and `segmentIndex` still names the outgoing one until
     * the fade completes. Null whenever no crossfade is in flight.
     */
    pendingSegmentIndex: null as number | null,
    /** Whether the authored segment-transition overlay should appear for this experience. */
    showTransitionOverlay: true,
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
    segment: state => state.segments[state.segmentIndex] ?? state.segments[0],
    segmentCount: state => state.segments.length,
    /** Crossfade window for the active experience's segment at `index`. */
    crossfadeMsAt: state => (index: number): number =>
      state.segments[index]?.crossfadeMs ?? DEFAULT_CROSSFADE_MS,
    totalElapsed: state => state.completedElapsed + state.segmentElapsed,
    segmentProgress: state =>
      state.segmentDuration > 0 ? Math.min(1, state.segmentElapsed / state.segmentDuration) : 0,
    sequenceDuration(state): number {
      void state.timelineRevision
      if (state.phase === 'intro') {
        return INTRO_SEQUENCE_DURATION
      }
      if (state.phase === 'cinematic') {
        return cinematicSequenceDuration()
      }
      return 0
    },
    sequenceElapsed(state): number {
      void state.timelineRevision
      if (state.phase === 'intro') {
        return authoredSequenceElapsed(INTRO_TIMELINE, state.segmentIndex, state.segmentElapsed)
      }
      if (state.phase === 'cinematic') {
        return authoredSequenceElapsed(CINEMATIC_TIMELINE, state.segmentIndex, state.segmentElapsed)
      }
      return 0
    },
    overallDuration: (state): number => {
      void state.timelineRevision
      return overallSequenceDuration()
    },
    overallElapsed(): number {
      void this.timelineRevision
      if (this.phase === 'intro') {
        return this.sequenceElapsed
      }
      if (this.phase === 'cinematic') {
        return introSequenceDuration() + this.sequenceElapsed
      }
      return 0
    },
    overallProgress(): number {
      void this.timelineRevision
      const duration = overallSequenceDuration()
      return duration > 0 ? Math.min(1, this.overallElapsed / duration) : 0
    },
    isLastSegment: state => state.segmentIndex >= state.segments.length - 1,
    /**
     * True for either authored Wolves show. The typed replacement for raw
     * `experienceId === WOLVES_EXPERIENCE.id` checks — see
     * `isWolvesPresentationProfile()` for why the Director's Cut needs both
     * profiles covered.
     */
    isWolvesPresentation: state => isWolvesPresentationProfile(state.presentationProfile),
    /**
     * The Director's Cut finale is scored to Track 0's own native timeline, so
     * every finale predicate below keys on Track 0 being the segment on air —
     * NOT on "the last segment of the experience". Track 0 is now followed by
     * Ghosts In The Mist, whose independent 0–347s native clock would otherwise
     * cross the finale's earliest anchor (the 344.956s companion pre-arm) and
     * mount the finale over the wrong song. Track 0 is the authored
     * `trackZeroExperience` segment, the same signal `CinematicStage` and
     * `TheaterExperience` resolve their immersive treatment from.
     */
    isDirectorsCutTrackZero: (state): boolean =>
      state.presentationProfile === WOLVES_DIRECTORS_CUT_PROFILE_ID
      && state.phase === 'cinematic'
      && state.segments[state.segmentIndex]?.trackZeroExperience === true,
    /**
     * The Director's Cut finale has mounted its companion player but has not
     * taken the frame yet. The finale needs a mounted, cued, muted and parked
     * YouTube player well before the audience sees it, or the corner opens on a
     * cold black frame in front of the room.
     */
    directorFinalePrearmed(): boolean {
      return this.isDirectorsCutTrackZero
        && this.nativeTime >= DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm
    },
    /**
     * The Director's Cut finale owns the frame: the ordinary theater grid,
     * nameplate, organization ads, captions and media widget are all suppressed
     * from the cover beat to the end of Track 0. It stands down again when the
     * show hands off to Ghosts, whose chrome is the ordinary later-part
     * treatment.
     *
     * Derived from the Track 0 clock (via `isDirectorsCutTrackZero`) plus the
     * published soundtrack time, never latched, so seeking backward out of the
     * finale restores every piece of chrome at once without any surface having
     * to unwind its own state.
     */
    directorFinaleActive(): boolean {
      return this.isDirectorsCutTrackZero
        && this.nativeTime >= DIRECTORS_CUT_FINALE_ANCHORS.coverStart
    },
    /**
     * The finale's terminal fade has completed. Keyed to Track 0's own clock
     * reaching `terminalFadeEnd` (422.301s), which is authored 1.699s before the
     * 424s segment ends — ahead of the final `PRE_END_THRESHOLD_S` the transport
     * never publishes — so the black always lands on a tick that actually
     * arrives. It deliberately does NOT read `finished`: in the multi-song cut
     * `finish()` belongs to the end of Ghosts, the real last segment, and would
     * pin black over the wrong song.
     */
    directorTerminalBlack(): boolean {
      return this.directorFinaleActive
        && this.nativeTime >= DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd
    },
    /** What the hero widget shows: the intro override when present, else the segment. */
    display(state): { chapter: string, title: string, artist: string, artwork: string, counter: string } {
      if (state.displayOverride) {
        return { ...state.displayOverride, counter: state.displayOverride.chapter }
      }
      const segment = this.segment
      const title = this.isWolvesPresentation
        ? segment.title
        : `${segment.title} by ${segment.artist}`
      return {
        chapter: segment.chapter,
        title,
        artist: segment.artist,
        artwork: segment.artwork,
        counter: `${segment.chapter} · ${state.segmentIndex + 1}/${state.segments.length}`,
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
    /**
     * Swap the active experience. The Wolves cinematic is loaded by default;
     * back-catalogue albums pass their generated manifests here. Resets all
     * playback state and returns to the lobby phase.
     */
    loadExperience(manifest: ExperienceManifest) {
      activeSegments = manifest.segments
      introIncluded = manifest.includeIntro === true
      rebuildTimelines()
      this.timelineRevision += 1
      this.segments = manifest.segments
      this.experienceId = manifest.id
      this.presentationProfile = manifest.presentationProfile ?? 'generic'
      this.phase = 'lobby'
      this.segmentIndex = 0
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = 0
      this.completedElapsed = 0
      this.playing = false
      this.crossfading = false
      this.pendingSegmentIndex = null
      // Reuse the profile just assigned above rather than recomputing it from the manifest —
      // same value (undefined and 'generic' both resolve false), one source of truth.
      this.showTransitionOverlay = isWolvesPresentationProfile(this.presentationProfile)
      this.displayOverride = null
      this.finished = false
    },
    /**
     * Publish the intro list about to be performed. `/wolves/` has two authored
     * intros of different lengths and durations; the store's index clamping and
     * every duration readout must follow the active one, so call this *before*
     * `enterIntro()` and before any `syncIntroStatus()`.
     */
    setIntroSequence(segments: readonly IntroVideoSpec[]) {
      applyIntroSequence(segments)
      this.timelineRevision += 1
    },
    /** Lobby exit: the authored Destiny intro overlay plays first. */
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
      this.finished = false
    },
    updateTime(elapsed: number, duration: number, nativeTime?: number) {
      this.segmentElapsed = elapsed
      this.nativeTime = nativeTime ?? elapsed
      if (duration > 0) {
        this.segmentDuration = duration
      }
      // A published time short of the finish point means the transport is
      // running again — a backward seek out of the terminal state, or a fresh
      // run. Releasing the latch here is what lets the Director's Cut finale
      // hand the show back without an explicit "un-finish" call from anywhere.
      if (this.finished && this.segmentDuration > 0 && elapsed < this.segmentDuration - PRE_END_THRESHOLD_S) {
        this.finished = false
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
    beginCrossfade(targetIndex: number) {
      this.crossfading = true
      this.pendingSegmentIndex = Math.min(Math.max(targetIndex, 0), this.segments.length - 1)
    },
    advanceSegment() {
      // Credit the AUTHORED duration of the segment being left, not whatever the
      // player last reported. `sequenceElapsed` sums authored timeline values, so
      // sourcing `completedElapsed` from the player would let the two elapsed
      // readouts drift apart mid-show.
      const authoredDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0
      this.completedElapsed += authoredDuration || this.segmentElapsed
      this.segmentIndex = Math.min(this.segmentIndex + 1, this.segments.length - 1)
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0
      this.crossfading = false
      this.pendingSegmentIndex = null
      this.finished = false
    },
    /** Manual skip to an arbitrary segment (prev/next); only watched time accrues. */
    jumpToSegment(index: number) {
      this.completedElapsed += this.segmentElapsed
      this.segmentIndex = Math.min(Math.max(index, 0), this.segments.length - 1)
      this.segmentElapsed = 0
      this.nativeTime = 0
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? 0
      this.crossfading = false
      this.pendingSegmentIndex = null
      this.finished = false
    },
    finish() {
      this.segmentIndex = this.segments.length - 1
      this.segmentDuration = CINEMATIC_TIMELINE[this.segmentIndex]?.segmentDuration ?? this.segmentDuration
      this.segmentElapsed = this.segmentDuration
      this.nativeTime = cinematicNativeStart(this.segmentIndex) + this.segmentDuration
      this.playing = false
      this.crossfading = false
      this.pendingSegmentIndex = null
      this.finished = true
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
