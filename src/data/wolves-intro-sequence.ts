/**
 * Pure sequencing logic for the Wolves "Start Experience" intro overlay.
 *
 * Kept separate from the Vue component so the state machine (advance / skip / overlay text
 * lookup) can be unit tested without needing a real YouTube player, which jsdom does not
 * support.
 *
 * Two kinds of segment exist:
 * - `video`: a fullscreen YouTube IFrame Player embed (the original design), optionally cut
 *   short of its natural end via `maxDuration`.
 * - `text`: a fullscreen black screen driven by a local clock instead of a video's playback
 *   time (`duration` controls when it auto-advances), optionally with a background-only
 *   YouTube embed for audio (`audioYoutubeVideoId`) and per-cue background artwork.
 */

export interface IntroBackgroundCrossfade {
  readonly day: string
  readonly night: string
}

export interface IntroOverlayTextCue {
  readonly text: string
  readonly start: number
  readonly end: number
  /** Static background image shown behind the text for this cue only (e.g. a single hero photo). */
  readonly backgroundImage?: string
  /** Day/night crossfade background shown behind the text for this cue only. */
  readonly backgroundCrossfade?: IntroBackgroundCrossfade
  /**
   * Animated zoom/pan treatment for `backgroundImage` only. `'kenburns'` slowly zooms and pans
   * the image over the cue's full duration, framed to keep faces in view rather than the empty
   * plant/floor padding around a wide group photo.
   */
  readonly backgroundMotion?: 'kenburns'
}

interface IntroSegmentBase {
  readonly id: string
  readonly overlays?: readonly IntroOverlayTextCue[]
}

export interface IntroVideoSegment extends IntroSegmentBase {
  readonly kind: 'video'
  readonly youtubeVideoId: string
  /** Forces an early advance at this many seconds, before the video's natural end. */
  readonly maxDuration?: number
}

export interface IntroTextSegment extends IntroSegmentBase {
  readonly kind: 'text'
  /** Total seconds this segment plays before auto-advancing. */
  readonly duration: number
  /** Optional background-only YouTube embed (e.g. a music track) with no visible player. */
  readonly audioYoutubeVideoId?: string
}

export type IntroVideoSpec = IntroVideoSegment | IntroTextSegment

export interface IntroSequenceState {
  readonly index: number
  readonly done: boolean
}

export function createIntroSequenceState(): IntroSequenceState {
  return { index: 0, done: false }
}

export function isVideoSegment(segment: IntroVideoSpec): segment is IntroVideoSegment {
  return segment.kind === 'video'
}

export function isTextSegment(segment: IntroVideoSpec): segment is IntroTextSegment {
  return segment.kind === 'text'
}

/**
 * Called when the current segment finishes playing (`ended` on a video, `duration` elapsed on
 * a text card) or fails to load (`error`) — all cases move forward one step so a missing/broken
 * render never blocks the live experience.
 */
export function advanceIntroSequence(state: IntroSequenceState, segmentCount: number): IntroSequenceState {
  if (state.done) {
    return state
  }
  const nextIndex = state.index + 1
  if (nextIndex >= segmentCount) {
    return { index: state.index, done: true }
  }
  return { index: nextIndex, done: false }
}

/**
 * "Skip" always jumps straight past the entire remaining sequence into the live experience,
 * regardless of which segment is currently playing.
 */
export function skipIntroSequence(state: IntroSequenceState): IntroSequenceState {
  return { index: state.index, done: true }
}

export function activeOverlayCue(
  overlays: readonly IntroOverlayTextCue[] | undefined,
  currentTime: number,
): IntroOverlayTextCue | undefined {
  if (!overlays) {
    return undefined
  }
  return overlays.find(cue => currentTime >= cue.start && currentTime < cue.end)
}

export function activeOverlayText(
  overlays: readonly IntroOverlayTextCue[] | undefined,
  currentTime: number,
): string | undefined {
  return activeOverlayCue(overlays, currentTime)?.text
}

/**
 * Whether a `video` segment's forced cutoff has been reached. Segments without `maxDuration`
 * never cut off early; they run to their natural `ENDED` event instead.
 */
export function isVideoCutoffReached(segment: IntroVideoSegment, currentTime: number): boolean {
  return segment.maxDuration != null && currentTime >= segment.maxDuration
}

/**
 * Whether a `text` segment's authored duration has elapsed and it should auto-advance.
 */
export function isTextSegmentComplete(segment: IntroTextSegment, elapsed: number): boolean {
  return elapsed >= segment.duration
}

/**
 * The sequence played before the live playlist experience begins, in three parts:
 *
 * 1. `wolves-prologue` — a black-screen, text-only cold open set to the full Gayane Ballet
 *    Suite (Adagio) track (5:26 / 326s — the "2001: A Space Odyssey" cue), establishing the
 *    Gardener/Winnower framing, the Collapse, and the "BLUEFIN — seven days to the wolves"
 *    title card, paced across the entire song rather than a short excerpt.
 * 2. `wolves-intro` — the official YouTube IFrame Player embed of Bungie's "Destiny 2: Into
 *    the Light Cinematic" trailer, with HTML/CSS text overlays introducing the six Guardians.
 *    The real trailer runs 2:00, shorter than the requested 2:46 cutoff, so it already ends
 *    naturally within budget and needs no `maxDuration`. A legitimate embed via YouTube's own
 *    IFrame API — the exact same mechanism already used for every track in the soundtrack
 *    playlist — never a downloaded or re-encoded local copy of someone else's footage.
 * 3. `wolves-epilogue` — a short black-screen text card bridging into the live experience.
 *
 * The live experience's own hero moment is the YouTube-hosted Track 0 playback that
 * `startSoundtrack()` already starts once this sequence completes, so there is no separate
 * local hero video to chain here.
 */
export function buildIntroVideoSequence(): readonly IntroVideoSpec[] {
  return [
    {
      id: 'wolves-prologue',
      kind: 'text',
      // The Gayane Ballet Suite (Adagio) track runs its full 5:26 (326s); the authored script
      // is paced across the whole song rather than a fixed 45s excerpt.
      duration: 326,
      audioYoutubeVideoId: 'EB3IokHelRk',
      overlays: [
        { text: 'A Gardener and Winnower walked amongst the stars', start: 0, end: 29 },
        { text: 'One to spread life, and one to cull the dross, to shape the garden.', start: 29, end: 65.2 },
        { text: 'And they had earned the solemn duty, chosen by their peers, to ensure that Open Source Thrived', start: 65.2, end: 101.4 },
        { text: 'The Heart versus the Mind, polar opposites. Forever entrapped in their roles for the greater good', start: 101.4, end: 137.6 },
        { text: 'All for the love of their Children', start: 137.6, end: 159.4 },
        {
          text: '',
          start: 159.4,
          end: 188.4,
          backgroundCrossfade: { day: 'wolves-intro/bluefin-collapse-day.webp', night: 'wolves-intro/bluefin-collapse-night.webp' },
        },
        { text: 'Then one day the planet Earth changed forever ...', start: 188.4, end: 210.1 },
        { text: 'New Children arose.', start: 210.1, end: 224.6 },
        { text: 'They lived as immortals, building the empires which brought people joy, and love.', start: 224.6, end: 253.6 },
        { text: 'They were Maintainer-Guardians. For eons they thrived.', start: 253.6, end: 275.3 },
        { text: '', start: 275.3, end: 289.8, backgroundImage: 'wolves-intro/kubecon-hero-shot.webp', backgroundMotion: 'kenburns' },
        { text: 'Until they did not.', start: 289.8, end: 300.6 },
        { text: 'Now their Children fight for Survival.', start: 300.6, end: 311.5 },
        {
          text: 'In the space of a few days, humanity had lost its future, for the heart of any race is destroyed, and its will to survive is utterly broken, when its children are taken from it.',
          start: 311.5,
          end: 320.6,
        },
        { text: 'B L U E F I N — seven days to the wolves', start: 320.6, end: 326 },
      ],
    },
    {
      // The real trailer runs 2:00 (120s), shorter than the requested 2:46 cutoff, so it
      // already ends naturally within budget — no `maxDuration` needed. Guardian window
      // timings below come from a one-time automated per-frame hue/saturation/brightness
      // analysis of the actual footage (sampled at 2fps), matched chronologically against
      // the requested color per Guardian. Spot-check against the real player before merge,
      // per docs/wolves-maintenance.md's verification checklist.
      id: 'wolves-intro',
      kind: 'video',
      youtubeVideoId: 'BKm0TPqeOjY',
      overlays: [
        { text: 'Void Warlock — Robert Killen — Reconciler of the Arcane', start: 5, end: 24 },
        { text: 'Harbinger Titan — Kat Cosgrove — Defender Queen of the Lost', start: 25.5, end: 37.5 },
        { text: 'Arc Warlock — Kaslin Fields — Rage of the Paradox', start: 38, end: 40 },
        { text: 'Solar Hunter — Laura Santamaria — Paragon to the Order of 7', start: 70.5, end: 77 },
        { text: 'Strand Warlock — Christopher Blecker — First Among Equals — The North Star', start: 83, end: 86.5 },
        { text: 'Behemoth Titan — Natali Vlatko — Boss B*tch', start: 87.5, end: 96 },
      ],
    },
    {
      id: 'wolves-epilogue',
      kind: 'text',
      duration: 8,
      overlays: [
        { text: 'But who will answer the call? Who will be the new Guardians?', start: 0, end: 5 },
        { text: 'Welcome to indie cloud native ...', start: 5, end: 8 },
      ],
    },
  ] as const
}
