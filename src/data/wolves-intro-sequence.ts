/**
 * Pure sequencing logic for the Wolves "Start Experience" intro video overlay.
 *
 * Kept separate from the Vue component so the state machine (advance / skip / overlay text
 * lookup) can be unit tested without needing a real YouTube player, which jsdom does not
 * support.
 */

export interface IntroOverlayTextCue {
  readonly text: string
  readonly start: number
  readonly end: number
}

export interface IntroVideoSpec {
  readonly id: string
  readonly youtubeVideoId: string
  readonly overlays?: readonly IntroOverlayTextCue[]
}

export interface IntroSequenceState {
  readonly index: number
  readonly done: boolean
}

export function createIntroSequenceState(): IntroSequenceState {
  return { index: 0, done: false }
}

/**
 * Called when the current video finishes playing (`ended`) or fails to load (`error`) —
 * both cases move forward one step so a missing/broken render never blocks the live experience.
 */
export function advanceIntroSequence(state: IntroSequenceState, videoCount: number): IntroSequenceState {
  if (state.done) {
    return state
  }
  const nextIndex = state.index + 1
  if (nextIndex >= videoCount) {
    return { index: state.index, done: true }
  }
  return { index: nextIndex, done: false }
}

/**
 * "Skip" always jumps straight past the entire remaining sequence into the live experience,
 * regardless of which video is currently playing.
 */
export function skipIntroSequence(state: IntroSequenceState): IntroSequenceState {
  return { index: state.index, done: true }
}

export function activeOverlayText(
  overlays: readonly IntroOverlayTextCue[] | undefined,
  currentTime: number,
): string | undefined {
  if (!overlays) {
    return undefined
  }
  return overlays.find(cue => currentTime >= cue.start && currentTime < cue.end)?.text
}

/**
 * The intro video played before the live playlist experience begins: an official YouTube
 * IFrame embed referencing a real `youtubeVideoId`, the same legitimate pattern already used
 * for every track in `src/data/wolves-soundtrack.ts` / `public/wolves-playlist.json` — never a
 * downloaded/re-encoded local copy of someone else's footage.
 *
 * The live experience's own hero moment is the YouTube-hosted Track 0 playback that
 * `startSoundtrack()` already starts once this sequence completes, so there is no separate
 * local hero video to chain here.
 */
export function buildIntroVideoSequence(): readonly IntroVideoSpec[] {
  return [
    {
      id: 'wolves-intro',
      youtubeVideoId: 'BKm0TPqeOjY',
      overlays: [
        { text: 'In this world ... our contributors are not just stewards, they are Guardians!', start: 0, end: 6 },
        { text: 'Who would _dare_ to Fight for the User', start: 6, end: 12 },
      ],
    },
  ] as const
}
