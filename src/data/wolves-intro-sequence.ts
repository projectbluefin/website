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
  /**
   * Day/night crossfade background(s) shown behind the text for this cue only. Accepts one or
   * more stages: a single-stage cue crossfades day->night once over its full duration; a
   * multi-stage cue splits its duration evenly across stages, crossfading day->night within
   * each one in turn (e.g. cycling through several Bluefin wallpaper scenes under one line of
   * unbroken text — see `bluefinMonthCrossfadePair`/`bluefinMonthCrossfadePairReversed`).
   */
  readonly backgroundCrossfade?: readonly IntroBackgroundCrossfade[]
  /**
   * Animated zoom/pan treatment for `backgroundImage` only. `'kenburns'` slowly zooms and pans
   * the image over the cue's full duration, framed to keep faces in view rather than the empty
   * plant/floor padding around a wide group photo.
   */
  readonly backgroundMotion?: 'kenburns'
  /**
   * Marks a cue that should dominate the screen visually (much larger, bolder, centered text)
   * rather than the standard lower-third caption treatment. Reserved for singular, high-impact
   * lines like the Arthur C. Clarke quote — do not apply broadly or it loses its weight.
   */
  readonly emphasis?: 'dominant'
  /**
   * Layers the darkening radial vignette over a `backgroundCrossfade` cue. Reserved for the
   * single "Then one day the planet Earth changed forever ..." Collapse cue so the vignette
   * reads as a one-time calamity rather than a recurring effect on every wallpaper stanza.
   */
  readonly calamity?: boolean
  /**
   * Anchors a Guardian trailer callout to one side of the frame instead of the default centered
   * lower-third placement. Reserved for cues whose on-screen window overlaps another Guardian's
   * (e.g. Christopher Blecker and Natali Vlatko sharing the same shot near the trailer's end) so
   * both callouts can render at once without stacking on top of each other.
   */
  readonly position?: 'left' | 'right'
  /**
   * Raises a Guardian trailer callout from the default lower-third anchor to sit closer to
   * that Guardian's actual position in the shot. Reserved for cues where the default bottom
   * placement would sit far below the Guardian's on-screen character (e.g. Natali Vlatko's
   * Behemoth Titan towers in the upper/center of the shared Christopher Blecker shot).
   */
  readonly raised?: boolean
  /**
   * Overrides the default `backgroundCrossfade` caption placement (which moves text up to the
   * top of the frame, since most Bluefin wallpaper scenes are sky-led landscapes with their
   * busiest imagery lower down). Reserved for scenes where that's reversed, e.g. scene 9's
   * large dark dinosaur-silhouette mass sits in the lower frame, which reads better as a
   * legible backdrop for bottom-anchored text than the top.
   */
  readonly textPosition?: 'top' | 'bottom'
  /**
   * Gilds a Guardian trailer callout with a gold treatment instead of the default silver/blue
   * plate, signifying leadership. Reserved for Christopher Blecker's "First Among Equals" cue
   * per explicit user request (2026-07-15) — do not apply broadly, it should read as singular.
   */
  readonly leader?: boolean
  /**
   * A single exact substring of this cue's title line to render with a distinctive gold
   * shimmer/"bling" effect (`wolves-guardian-plate-bling` in `WolvesIntroOverlay.vue`), calling
   * it out from the rest of the title line. Reserved for Christopher Blecker's "Platinum Member"
   * segment per explicit user request (2026-07-15) — must match a title substring exactly
   * (case-sensitive) or it silently renders with no special treatment.
   */
  readonly blingTitle?: string
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
  /**
   * Seconds into the source video where playback should begin, skipping content baked into the
   * footage itself before that point (e.g. a publisher rating card). Passed straight through to
   * the YouTube player's native `start` param, so `activeOverlayCue`/`activeOverlayCues` windows
   * still line up against the video's real (absolute) timeline — they do not need to be shifted.
   */
  readonly startOffset?: number
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
 * regardless of which segment is currently playing. Used only as an internal fallback when a
 * segment fails to load or the sequence is empty — never call this from user-facing nav
 * controls, which should move one segment at a time via `advanceIntroSequence`/
 * `previousIntroSequence` so Prologue -> Guardian trailer -> Epilogue stays navigable.
 */
export function skipIntroSequence(state: IntroSequenceState): IntroSequenceState {
  return { index: state.index, done: true }
}

/**
 * Moves back one segment (e.g. Guardian trailer -> Prologue), for the intro overlay's
 * Previous control. Clamped at the first segment; never re-opens a `done` sequence on its own
 * since Previous is only reachable while the overlay is still visible.
 */
export function previousIntroSequence(state: IntroSequenceState): IntroSequenceState {
  return { index: Math.max(0, state.index - 1), done: false }
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
 * All cues active at the given timestamp, not just the first match. Guardian trailer cues can
 * intentionally overlap (e.g. Christopher Blecker and Natali Vlatko share the same shot near
 * the trailer's end) so both need to render side-by-side rather than one hiding the other.
 */
export function activeOverlayCues(
  overlays: readonly IntroOverlayTextCue[] | undefined,
  currentTime: number,
): readonly IntroOverlayTextCue[] {
  if (!overlays) {
    return []
  }
  return overlays.filter(cue => currentTime >= cue.start && currentTime < cue.end)
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
 * Slow, somber text fade-in duration (seconds) for the Prologue/Epilogue text cards, derived
 * from the Gayane Ballet Suite (Adagio) track's actual tempo rather than an arbitrary constant.
 *
 * The track's audio was analyzed with librosa (`onset_strength` + `beat_track`), which reported
 * ~123 BPM — but that figure is a harmonic multiple, not the true pulse: adagio strings have no
 * percussive attack, so onset-based beat trackers commonly lock onto a sixteenth- or
 * eighth-note subdivision of a much slower true tempo. Rather than guess which subdivision is
 * "correct", this reuses the same octave-correction pattern already established for BPM-derived
 * hold times in `WolvesComicReader.vue` (`laterTrackSlideHold`): repeatedly double the beat
 * grouping until the resulting hold lands in a slow, legible range. That bounding makes the
 * final value self-correcting across octave ambiguity — both the raw ~123 BPM and ~136 BPM
 * readings converge to close to the same ~7-8s hold once doubled into range.
 */
export const PROLOGUE_TEXT_FADE_SECONDS = 7.8

/**
 * Crossfade duration (seconds) between one background scene/wallpaper and the next (e.g. one
 * monthly wallpaper stage dissolving into the next, or a stage dissolving into the following
 * cue's scene). Set to exactly half of `PROLOGUE_TEXT_FADE_SECONDS` so the scenery's ebb and
 * flow shares the same BPM-derived musical tempo as the text fade-in rather than an unrelated
 * arbitrary duration -- the two effects breathe together instead of at odds with each other.
 */
export const PROLOGUE_SCENE_CROSSFADE_SECONDS = PROLOGUE_TEXT_FADE_SECONDS / 2

/**
 * Builds a day/night crossfade pair for one of Bluefin's twelve monthly wallpaper scenes
 * (`public/img/wallpapers/bluefin-01-day.webp` .. `bluefin-12-night.webp`, the same asset set
 * `WolvesApp.vue` uses for the live calendar-driven background). Reused here as the Prologue's
 * per-stanza backgrounds, per the user's chosen scene numbers for each line.
 */
function bluefinMonthCrossfadePair(month: number): IntroBackgroundCrossfade {
  const padded = String(month).padStart(2, '0')
  return {
    day: `img/wallpapers/bluefin-${padded}-day.webp`,
    night: `img/wallpapers/bluefin-${padded}-night.webp`,
  }
}

/** Reversed stage: starts on the month's night frame and crossfades into its day frame. */
function bluefinMonthCrossfadePairReversed(month: number): IntroBackgroundCrossfade {
  const pair = bluefinMonthCrossfadePair(month)
  return { day: pair.night, night: pair.day }
}

/** Single-stage form: crossfades day->night once over the cue's full duration. */
function bluefinMonthCrossfade(month: number): readonly IntroBackgroundCrossfade[] {
  return [bluefinMonthCrossfadePair(month)]
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
        // Cold open on total darkness -- nothing exists yet, before Earth or its wallpaper
        // scenes even enter the story. The bluefin-01..12 wallpaper cycle below only begins
        // once life/Earth is introduced starting with the next line.
        { text: 'A Gardener and Winnower walked amongst the stars', start: 0, end: 24 },
        {
          text: 'One to spread life, and one to cull the dross,',
          start: 24,
          end: 49.23,
          backgroundCrossfade: bluefinMonthCrossfade(2),
        },
        {
          text: 'to shape the garden.',
          start: 49.23,
          end: 60.2,
          backgroundCrossfade: bluefinMonthCrossfade(1),
        },
        {
          text: 'And they had earned the solemn duty, chosen by their peers,',
          start: 60.2,
          end: 83.17,
          backgroundCrossfade: bluefinMonthCrossfade(5),
        },
        {
          text: 'to ensure that Open Source Thrived',
          start: 83.17,
          end: 96.4,
          backgroundCrossfade: bluefinMonthCrossfade(8),
        },
        {
          text: 'The Heart versus the Mind, polar opposites.',
          start: 96.4,
          end: 112.61,
          backgroundCrossfade: bluefinMonthCrossfade(6),
        },
        {
          text: 'Forever entrapped in their roles for the greater good',
          start: 112.61,
          end: 132.6,
          backgroundCrossfade: bluefinMonthCrossfade(9),
          textPosition: 'bottom',
        },
        {
          // A single unbroken line, cycling through two wallpaper scenes underneath it: scene
          // 07 reversed (night->day) followed by scene 10 normal (day->night).
          text: 'All for the love of their Children',
          start: 132.6,
          end: 154.4,
          backgroundCrossfade: [bluefinMonthCrossfadePairReversed(7), bluefinMonthCrossfadePair(10)],
        },
        {
          // The day->night crossfade IS the calamity: the background animates from the bright
          // day frame to the dark night frame across this cue's full window (see
          // wolves-intro-overlay-background-day/-night keyframes), and this line is overlaid
          // directly on top of that fade rather than shown on a separate blank beat.
          // NOTE: the two asset filenames are inverted relative to their actual content
          // (confirmed by eye in-browser) — the file literally named "...-day.webp" is the
          // darker/dusk frame and "...-night.webp" is the brighter frame, so the `day`/`night`
          // keys below intentionally point at the opposite filenames to render correctly.
          text: 'Then one day the planet Earth changed forever ...',
          start: 154.4,
          end: 205.1,
          backgroundCrossfade: [{ day: 'wolves-intro/bluefin-collapse-night.webp', night: 'wolves-intro/bluefin-collapse-day.webp' }],
          calamity: true,
        },
        {
          text: 'New Children arose.',
          start: 205.1,
          end: 215.1,
          backgroundCrossfade: bluefinMonthCrossfade(3),
        },
        {
          text: 'They lived as immortals,',
          start: 215.1,
          end: 223.8,
          backgroundCrossfade: bluefinMonthCrossfade(3),
        },
        {
          text: 'building the empires which brought people joy, and love.',
          start: 223.8,
          end: 244.1,
          backgroundCrossfade: bluefinMonthCrossfade(12),
        },
        {
          text: 'They were Maintainer-Guardians. For eons they thrived.',
          start: 244.1,
          end: 265.8,
          backgroundCrossfade: bluefinMonthCrossfade(12),
        },
        { text: '', start: 265.8, end: 280.3, backgroundImage: 'wolves-intro/kubecon-hero-shot.webp', backgroundMotion: 'kenburns' },
        {
          text: 'Until they did not.',
          start: 280.3,
          end: 288.3,
          backgroundCrossfade: bluefinMonthCrossfade(12),
        },
        // Survival and the Clarke quote below deliberately drop back to a plain black screen
        // (no wallpaper) so the dominant quote's high-contrast, much-larger treatment reads as
        // a hard tonal break from the wallpaper-lit stanzas that came before it.
        { text: 'Now their Children fight for Survival.', start: 288.3, end: 299.2 },
        {
          text: 'In the space of a few days, humanity had lost its future,',
          start: 299.2,
          end: 306.17,
          emphasis: 'dominant',
        },
        {
          text: 'for the heart of any race is destroyed, and its will to survive is utterly broken,',
          start: 306.17,
          end: 316.2,
          emphasis: 'dominant',
        },
        {
          text: 'when its children are taken from it.',
          start: 316.2,
          end: 320.6,
          emphasis: 'dominant',
        },
        { text: 'B L U E F I N — seven days to the wolves', start: 320.6, end: 326 },
      ],
    },
    {
      // The real trailer runs 2:00 (120s), shorter than the requested 2:46 cutoff, so it
      // already fits within budget. It is deliberately cut a few seconds short of its own
      // natural end via `maxDuration` (see below) to skip dead time after the narrator
      // finishes speaking. Guardian window timings below were re-verified frame-by-frame
      // against the real embed (Playwright + the YouTube IFrame API, screenshotting every
      // ~1-2s) per docs/wolves-maintenance.md's verification checklist, replacing the
      // original automated hue/brightness pass that had mismatched two of the six windows:
      // - Robert Killen's Void Warlock (the first purple, a crystalline void-arm close-up) runs
      //   5-17.5s footage-wise; the whip-pan cut to a Titan Ward of Dawn bubble forming happens
      //   at ~17.5s (confirmed via 0.5s-resolution frame capture — 17.0s is still clearly the
      //   Warlock's caped back, 18.5s is already the Titan crouched inside the bubble).
      // - Kat Cosgrove's plate is deliberately cued 1s ahead of the frame-verified footage cut,
      //   at 16.5s (explicit user request, confirmed 2026-07-15: her nameplate should "come
      //   forward"). Robert Killen's window is shortened to match (5-16.5s) so the two plates
      //   stay adjacent rather than overlapping — neither has a `position`, so two simultaneous
      //   cues here would stack on top of each other instead of rendering side-by-side. Her
      //   plate now runs 16.5-24.5s. This is an intentional exception to frame-accurate cueing —
      //   do not "fix" the boundary back to 17.5 without a fresh user request.
      // - Kaslin Fields' Arc Warlock lightning duel runs the full 38-48s (previously cut off at
      //   40s, well before the footage itself ends).
      // - Laura Santamaria's Solar Hunter window (70.5-77s) was already correct.
      // - Christopher Blecker (Strand, green) and Natali Vlatko (Behemoth Titan, icy blue) share
      //   the same shot from ~87.5-90s onward, so their windows now overlap (83-96s and
      //   87.5-96s) with `position` anchoring each to its own side of the frame instead of one
      //   caption overwriting the other. Christopher's window was extended from 90s to 96s
      //   (matching Natali's own end) at explicit user request, confirmed 2026-07-15 — his green
      //   Strand arm is still clearly visible reaching into frame through 94-96s (re-verified via
      //   frame capture), so this also corrects the plate disappearing while he's still on
      //   screen, not just a stylistic hold. His plate additionally carries `leader: true`,
      //   gilding it gold instead of the standard silver/blue treatment to signify leadership,
      //   pairing with his existing "First Among Equals" title line — reserved for him alone,
      //   do not apply broadly. His title line now carries four segments joined the same way
      //   ("First Among Equals — The North Star — Uncompromising Purity — Platinum Member"),
      //   all rendered on one `wolves-guardian-plate-title` line with identical styling so every
      //   title reads with equal visual weight (no segment is emphasized over another) — per
      //   explicit user request, confirmed 2026-07-15, to add "Uncompromising Purity" and
      //   "Platinum Member" with even association to his existing titles. "Platinum Member" was
      //   later renamed from "Platinum Sponsor" and given its own `blingTitle` shimmer treatment
      //   (`wolves-guardian-plate-bling`), per a follow-up request the same day for a
      //   "distinctive bling effect" — reserved for that one segment alone.
      // - Natali Vlatko's title line adds a second line after "Boss B*tch" ("He's wearing a
      //   dress, I'm wearing a FIST"), per explicit user request, confirmed 2026-07-15. The
      //   user's original line ended in a trailing ellipsis; substituted with an em dash to
      //   match this file's join convention and the sitewide ellipsis ban
      //   (docs/wolves-maintenance.md), while preserving the same dramatic trail-off.
      // - The narrator's final line ("...for all time.") finishes around 113s, confirmed via
      //   0.2s-resolution frame capture (the caption is still on screen at 113.2-113.5s, with
      //   the same squad shot still holding, no cut yet). From ~113.7s the trailer cuts to a
      //   black frame, then a "Destiny 2: Season of the Wish" promotional card, before its
      //   natural end at 120s — none of that is Guardian content. `maxDuration: 114` ends the
      //   segment right after the last line lands, skipping ~7s of dead promotional time, per
      //   explicit user request (2026-07-15).
      id: 'wolves-intro',
      kind: 'video',
      youtubeVideoId: 'BKm0TPqeOjY',
      // The source video opens on Bungie's own ESRB "TEEN" rating card (visible ~0-1.5s,
      // confirmed frame-by-frame), which isn't part of the Guardian content we want to show.
      // Starting 2s in skips past it entirely without touching any of the cue windows below,
      // since those are keyed to the video's absolute/native timeline, not this offset.
      startOffset: 2,
      // Ends the segment right after the narrator's last line, before the black cut and
      // "Season of the Wish" promo card — see the comment block above.
      maxDuration: 114,
      overlays: [
        { text: 'Void Warlock — Robert Killen — Reconciler of the Arcane', start: 5, end: 16.5 },
        { text: 'Harbinger Titan — Kat Cosgrove — Defender Queen of the Lost', start: 16.5, end: 24.5 },
        { text: 'Arc Warlock — Kaslin Fields — Rage of the Paradox', start: 38, end: 48 },
        { text: 'Solar Hunter — Laura Santamaria — Paragon to the Order of 7', start: 70.5, end: 77 },
        { text: 'Strand Warlock — Christopher Blecker — First Among Equals — The North Star — Uncompromising Purity — Platinum Member', start: 83, end: 96, position: 'left', leader: true, blingTitle: 'Platinum Member' },
        { text: 'Behemoth Titan — Natali Vlatko — Boss B*tch — He\'s wearing a dress, I\'m wearing a FIST', start: 87.5, end: 96, position: 'right', raised: true },
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
