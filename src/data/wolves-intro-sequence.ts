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

import { estimatePageSeconds } from '../components/wolves/lore/lore-pages'
import destinyCaptions from './wolves-destiny-captions.txt?raw'

export interface IntroBackgroundCrossfade {
  readonly day: string
  readonly night: string
}

export interface IntroOverlayTextCue {
  readonly text: string
  readonly start: number
  readonly end: number
  /** Optional top nameplate title to publish while this cue is active. */
  readonly nameplateTitle?: string
  /** Optional top nameplate detail to publish while this cue is active. */
  readonly nameplateDetail?: string
  /** Optional bottom music-plaque title to publish while this cue is active. */
  readonly mediaTitle?: string
  /** Publishes a top status nameplate without rendering a lower-third or caption. */
  readonly statusOnly?: boolean
  /**
   * Split-second glitch easter egg: the top nameplate briefly "glitches out" to this cue's
   * `nameplateTitle` with an RGB-split distortion, then snaps back to the segment's default
   * title when the cue ends. Keep these cue windows short (well under a second) so the reveal
   * reads as interference, not a caption. Currently reserved for the #nova4ever bursts.
   */
  readonly glitch?: boolean
  /** Requires the user's CC switch before this burned-in caption is rendered. */
  readonly requiresCaptionToggle?: boolean
  /** Static background image shown behind the text for this cue only (e.g. a single hero photo). */
  readonly backgroundImage?: string
  /** Renders a full-screen comic title card instead of the standard overlay treatment. */
  readonly comicHeroTitleCard?: boolean
  /**
   * Renders the opening title card's lower third: the Ghosts In The Mist guardian nameplate
   * (crest, horizon rules, gradient name, subtitle) with this cue's `text` as the quote body
   * beneath it, rather than the standard centered caption. The quote is rendered verbatim,
   * paragraph-split on blank lines, and is never run through the theater punctuation strip.
   */
  readonly titlePlate?: {
    readonly name: string
    readonly subtitle: string
  }
  /**
   * Day/night crossfade background(s) shown behind the text for this cue only. Accepts one or
   * more stages: a single-stage cue crossfades day->night once over its full duration; a
   * multi-stage cue splits its duration evenly across stages, crossfading day->night within
   * each one in turn (e.g. cycling through several wallpaper scenes under one line of
   * unbroken text).
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
   * (e.g. Christoph Blecker and Natali Vlatko sharing the same shot near the trailer's end) so
   * both callouts can render at once without stacking on top of each other.
   */
  readonly position?: 'left' | 'right'
  /**
   * Raises a Guardian trailer callout from the default lower-third anchor to sit closer to
   * that Guardian's actual position in the shot. Reserved for cues where the default bottom
   * placement would sit far below the Guardian's on-screen character (e.g. Natali Vlatko's
   * Behemoth Titan towers in the upper/center of the shared Christoph Blecker shot).
   */
  readonly raised?: boolean
  /**
   * Overrides the default `backgroundCrossfade` caption placement (which moves text up to the
   * top of the frame, since most Bluefin wallpaper scenes are sky-led landscapes with their
   * busiest imagery lower down). Reserved for scenes where that's reversed, e.g. scene 9's
   * large dark dinosaur-silhouette mass sits in the lower frame, which reads better as a
   * legible backdrop for bottom-anchored text than the top.
   */
  readonly textPosition?: 'top' | 'bottom' | 'bottom-right'
  /** Renders the cue with a lighter, narrower treatment for lines like the final title card. */
  readonly slim?: boolean
  /** Preserves authored punctuation instead of applying the default theater-scale comma/period strip. */
  readonly preservePunctuation?: boolean
  /** Renders the cue as a compact Unix-style status console rather than cinematic display text. */
  readonly presentation?: 'terminal'
  /** Highlights a specific substring inside this cue's text instead of the default B/F auto-highlighting. */
  readonly highlightSubstring?: string
  /** Highlights multiple exact substrings inside this cue's text, disabling default B/F highlighting. */
  readonly highlightSubstrings?: readonly string[]
  /**
   * Renders the plate in a burnished silver treatment with a TRUSTEE // GUARDIAN
   * label, marking Universal Blue trustees. Jorge Castro's Ghosts In The Mist
   * plate mirrors the standard trustee treatment in WolvesComicReader.vue.
   */
  readonly trustee?: boolean
  /** Renders the complete gold leader plate treatment, reserved for Christoph Blecker. */
  readonly leader?: boolean
  /**
   * A single exact substring of this cue's title line to render with a distinctive gold
   * shimmer/"bling" effect (`wolves-guardian-plate-bling` in `WolvesIntroOverlay.vue`), calling
   * it out from the rest of the title line. Reserved for Christoph Blecker's "Platinum Member"
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
  /** Optional alternate source for the same authored segment (e.g. voiced/unvoiced trailer). */
  readonly alternateYoutubeVideoId?: string
  /** Exact label for the alternate-source toggle shown in the shared transport. */
  readonly alternateYoutubeVideoLabel?: string
  /** Forces an early advance at this many seconds, before the video's natural end. */
  readonly maxDuration?: number
  /** Alternate-source authored cutoff, used when preserving time across source switches. */
  readonly alternateMaxDuration?: number
  /**
   * Seconds into the source video where playback should begin, skipping content baked into the
   * footage itself before that point (e.g. a publisher rating card). Passed straight through to
   * the YouTube player's native `start` param, so `activeOverlayCue`/`activeOverlayCues` windows
   * still line up against the video's real (absolute) timeline — they do not need to be shifted.
   */
  readonly startOffset?: number
  /** Burned-in caption cues rendered over the video frame itself. */
  readonly burnedInCaptions?: readonly IntroOverlayTextCue[]
}

export interface IntroTextSegment extends IntroSegmentBase {
  readonly kind: 'text'
  /** Total seconds this segment plays before auto-advancing. */
  readonly duration: number
  /** Optional background-only YouTube embed (e.g. a music track) with no visible player. */
  readonly audioYoutubeVideoId?: string
  /**
   * Ramp the background audio's volume to zero over this many seconds leading into the
   * segment's cutoff, so the excerpt ends on a musical decay instead of a hard cut.
   */
  readonly audioFadeOutSeconds?: number
}

export type IntroVideoSpec = IntroVideoSegment | IntroTextSegment

export interface IntroSequenceState {
  readonly index: number
  readonly done: boolean
}

export interface IntroStatusPayload {
  readonly currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly segmentId: string
  readonly canGoPrevious: boolean
  readonly nameplateTitle?: string
  /** True while a `glitch` cue is active, so the top nameplate applies the glitch treatment. */
  readonly nameplateGlitch?: boolean
  readonly nameplateDetail?: string
  readonly mediaTitle?: string
  readonly showVoiceOverToggle?: boolean
  readonly voiceOverEnabled?: boolean
  readonly showCaptionToggle?: boolean
  readonly captionsEnabled?: boolean
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
 * intentionally overlap (e.g. Christoph Blecker and Natali Vlatko share the same shot near
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

export function buildOverlayTextParts(
  text: string,
  highlightSubstring?: string | readonly string[],
): readonly { char: string, highlight: boolean }[] {
  const highlightSubstrings = highlightSubstring == null
    ? []
    : Array.isArray(highlightSubstring)
      ? highlightSubstring.filter(Boolean)
      : [highlightSubstring]

  if (highlightSubstrings.length === 0) {
    return Array.from(text).map(char => ({ char, highlight: char.toUpperCase() === 'B' || char.toUpperCase() === 'F' }))
  }

  const normalizedText = text.toLowerCase()
  const highlightedIndexes = new Set<number>()

  for (const rawHighlight of highlightSubstrings) {
    const normalizedHighlight = rawHighlight.toLowerCase()
    if (!normalizedHighlight) {
      continue
    }

    let startIndex = normalizedText.indexOf(normalizedHighlight)
    while (startIndex !== -1) {
      const endIndex = startIndex + normalizedHighlight.length
      for (let index = startIndex; index < endIndex; index++) {
        highlightedIndexes.add(index)
      }
      startIndex = normalizedText.indexOf(normalizedHighlight, startIndex + normalizedHighlight.length)
    }
  }

  return Array.from(text).map((char, index) => ({
    char,
    highlight: highlightedIndexes.has(index),
  }))
}

export function parseDestinyCaptionFile(source: string): readonly IntroOverlayTextCue[] {
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  const cues: IntroOverlayTextCue[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const parts = line.split('|')
    if (parts.length < 2) {
      continue
    }
    const timestamp = Number.parseFloat(parts[0])
    const explicitEnd = parts.length >= 3 ? Number.parseFloat(parts[parts.length - 1]) : Number.NaN
    const text = parts.length >= 3
      ? parts.slice(1, -1).join('|').trim()
      : parts.slice(1).join('|').trim()
    if (Number.isNaN(timestamp) || !text) {
      continue
    }
    const start = timestamp
    const nextLine = lines[index + 1]
    const nextTimestamp = nextLine ? Number.parseFloat(nextLine.slice(0, nextLine.indexOf('|'))) : Number.NaN
    const end = Number.isNaN(explicitEnd)
      ? (Number.isNaN(nextTimestamp) ? start + 2.5 : nextTimestamp)
      : explicitEnd
    cues.push({ text, start, end })
  }
  return cues
}

export function buildDestinyCaptionCues(): readonly IntroOverlayTextCue[] {
  const cues = parseDestinyCaptionFile(destinyCaptions)
  return [
    ...cues,
    { text: '', start: 24, end: 38, comicHeroTitleCard: true },
  ]
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
 * Native start time (seconds, video-absolute) of a Guardian's nameplate cue in the wolves
 * intro, looked up by the Guardian's full display name against the authored overlay cues.
 * Returns `null` for Guardians without a section in the intro (their thumbnails fall back
 * to starting the intro from the beginning).
 */
export function guardianIntroStartTime(guardianName: string): number | null {
  for (const segment of buildIntroVideoSequence()) {
    for (const cue of segment.overlays ?? []) {
      if (cue.text.includes(guardianName)) {
        return cue.start
      }
    }
  }
  return null
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
 * The recovered full-resolution Flickr original of the orange-shirt stage photo (2048x1365),
 * used as the opening title card's backdrop. The earlier low-resolution copy was replaced
 * from the Amsterdam gallery; do not swap this back to a thumbnail-sized source.
 */
const OPENING_TITLE_CARD_IMAGE = 'img/wallpapers/wolves/people/Yikes!.webp'

/**
 * The sequence played before the live playlist experience begins:
 *
 * `wolves-intro` — the official YouTube IFrame Player embed of Bungie's "Destiny 2: Into
 *    the Light Cinematic" trailer, with HTML/CSS text overlays introducing the six Guardians.
 *    The default unvoiced source runs ~2:03 and now uses an authored black-frame outro hold
 *    (`maxDuration`) while the optional Ikora-voiced source clamps to its own shorter end. A
 *    legitimate embed via YouTube's own
 *    IFrame API — the exact same mechanism already used for every track in the soundtrack
 *    playlist — never a downloaded or re-encoded local copy of someone else's footage.
 *
 * The live experience's own hero moment is the YouTube-hosted Track 0 playback that
 * `startSoundtrack()` already starts once this sequence completes, so there is no separate
 * local hero video to chain here.
 */
/**
 * The opening title card, played before the Destiny trailer.
 *
 * Deliberately silent: it is the presenter's own welcome slide, so the room hears the
 * speaker rather than a music bed, and the segment simply fades into the Destiny video
 * when it ends. The nameplate replicates the Ghosts In The Mist lower third
 * (`src/data/wolves-gallery-featured.ts`) with the guardian class and honorifics dropped
 * per explicit user request (2026-08-06) — just the name and one affiliation subtitle.
 *
 * The quote is authored verbatim and must stay that way: it names a real device count and
 * two real foundations, so paraphrasing it would misstate fact from the stage.
 */
function buildOpeningTitleCardSegment(): IntroTextSegment {
  const parts = [
    'Welcome Linux gamers! As we celebrate 100k weekly Bazzite devices, let me explain who we are.',
    'This summer the Apache Foundation and CNCF collided. Buildstream, Kubernetes, and bootc. None of you have any idea what that means. But let\'s just say ...',
    'Modern Linux is unified. Don\'t believe me? Meet your new teammates.',
    'The people in these slides were once just like you. Ask them. The Linux you want exists ... suit up.',
  ]
  // Each paragraph holds for exactly what it costs to read from the back row, using the same
  // theater reading model every other Wolves text surface uses (`estimatePageSeconds`: a fixed
  // beat for putting a page up and taking it down, plus its word count at theater pace). That
  // keeps the weighting the card was authored for -- the long CNCF beat holds longest, the
  // "Don't believe me?" punch holds shortest -- without hand-picking any of the numbers.
  //
  // These windows used to be a hand-written [14, 16, 12, 17]. That ran 59 seconds against
  // 34 seconds of actual reading cost: roughly six seconds of dead air on every paragraph,
  // before a single frame of the show. A welcome slide that outstays its own content is the
  // one thing an audience is guaranteed to notice, because nothing has started yet.
  const windows = parts.map(text => Math.ceil(estimatePageSeconds(text)))
  const titlePlate = {
    name: 'Jorge Castro',
    subtitle: 'Project Bluefin // Universal Blue // Kubernetes',
  } as const

  let start = 0
  const overlays = parts.map((text, index) => {
    const end = start + windows[index]
    const cue: IntroOverlayTextCue = {
      text,
      start,
      end,
      titlePlate,
      backgroundImage: OPENING_TITLE_CARD_IMAGE,
      preservePunctuation: true,
    }
    start = end
    return cue
  })

  return {
    id: 'wolves-title-card',
    kind: 'text',
    duration: start,
    overlays,
  }
}

export function buildIntroVideoSequence(): readonly IntroVideoSpec[] {
  return [
    buildOpeningTitleCardSegment(),
    {
      // The Destiny segment now defaults to the unvoiced source and carries an optional voiced
      // toggle. Guardian window timings below were re-verified frame-by-frame
      // against the real embed (Playwright + the YouTube IFrame API, screenshotting every
      // ~1-2s) per the Wolves content verification checklist, replacing the
      // original automated hue/brightness pass that had mismatched two of the six windows:
      // - Bob Killen's Void Warlock (the first purple, a crystalline void-arm close-up) runs
      //   5-17.5s footage-wise; the whip-pan cut to a Titan Ward of Dawn bubble forming happens
      //   at ~17.5s (confirmed via 0.5s-resolution frame capture — 17.0s is still clearly the
      //   Warlock's caped back, 18.5s is already the Titan crouched inside the bubble).
      // - Kat Cosgrove's plate is deliberately cued ahead of the frame-verified footage cut,
      //   at 14.5s (explicit user request, 2026-07-18: her plate replaces Bob's with a quick
      //   fade instead of overlapping). Bob Killen's window is shortened to match (5-14.5s) —
      //   neither has a `position`, so two simultaneous cues here would stack on top of each
      //   other instead of rendering side-by-side. Her plate now runs 14.5-24.5s. This is an
      //   intentional exception to frame-accurate cueing — do not "fix" the boundary back to
      //   17.5 without a fresh user request.
      // - Kaslin Fields' Arc Warlock lightning duel runs 40-48s, beginning on her visible
      //   electric reveal (previously cut off at
      //   40s, well before the footage itself ends).
      // - Laura Santamaria's Solar Hunter window (70.5-77s) was already correct.
      // - Christoph Blecker (Strand, green) and Natali Vlatko (Behemoth Titan, icy blue) share
      //   the same shot from ~89.5-90s onward, so their windows overlap (85-95s and
      //   89.5-96s) with `position` anchoring each to its own side of the frame instead of one
      //   caption overwriting the other. Christoph's plate ends a second before Natali's so
      //   the two nameplates do not linger together after his shot has settled. His complete leader plate is gold, while its
      //   trustee label remains authoritative. His title line carries two segments joined the same way
      //   ("First Among Equals — The North Star"), rendered on one `wolves-guardian-plate-title`
      //   line with identical styling so both read with equal visual weight. "Uncompromising
      //   Purity" and "Platinum Member" (added 2026-07-15, the latter with a `blingTitle`
      //   shimmer) were removed the same day per a follow-up explicit user request to drop back
      //   to just the original two titles — do not re-add either without a fresh user request.
      // - Natali Vlatko's title line is "Punch first, document later.", per explicit user request.
      // - The default unvoiced source (`BV3BZKbpBns`) runs ~124.0s naturally. Real-player frame
      //   verification (Playwright + `.wolves-intro-overlay-player` screenshots, 0.1s steps)
      //   showed its own authored black-frame outro beginning at ~119.0s: 118.8s still carries
      //   the previous bright frame, 119.0s is fully black and stays there through the end card.
      //   Cut both sources at 118.8s so YouTube's end-screen layer never becomes visible.
      id: 'wolves-intro',
      kind: 'video',
      youtubeVideoId: 'BV3BZKbpBns',
      alternateYoutubeVideoId: 'BKm0TPqeOjY',
      alternateYoutubeVideoLabel: 'Ikora voice over',
      // The source video opens on Bungie's own ESRB "TEEN" rating card (visible ~0-1.5s,
      // confirmed frame-by-frame), which isn't part of the Guardian content we want to show.
      // Starting 2s in skips past it entirely without touching any of the cue windows below,
      // since those are keyed to the video's absolute/native timeline, not this offset.
      startOffset: 2,
      // Stop before YouTube's end-screen layer appears over the final source frames.
      // Destiny dialogue captions are intentionally disabled; the Comic Hero Shots title card remains timed.
      maxDuration: 118.8,
      alternateMaxDuration: 118.8,
      burnedInCaptions: buildDestinyCaptionCues(),
      overlays: [
        { text: 'Voidwalker Warlock — Bob Killen — Reconciler of the Plane', start: 5, end: 14.5, trustee: true },
        { text: 'Sentinel Titan — Kat Cosgrove — Defender Queen of the Lost', start: 14.5, end: 24.5 },
        { text: 'Stormcaller Warlock — Kaslin Fields — Rage of the Paradox', start: 40, end: 48 },
        // #nova4ever easter egg: the default "fighting for something greater than themselves" status briefly
        // glitches out to the hashtag a few times during the 48-70.5 montage, then snaps back.
        { text: '#nova4ever', start: 52, end: 52.45, nameplateTitle: '#nova4ever', statusOnly: true, glitch: true },
        { text: '#nova4ever', start: 60.6, end: 61.05, nameplateTitle: '#nova4ever', statusOnly: true, glitch: true },
        { text: '#nova4ever', start: 68.1, end: 68.55, nameplateTitle: '#nova4ever', statusOnly: true, glitch: true },
        { text: 'Gunslinger Hunter — Laura Santamaria — The Order of Seven', start: 70.5, end: 77 },
        { text: 'Broodweaver Warlock — Christoph Blecker — First Among Equals — The North Star', start: 85, end: 95, position: 'left', trustee: true, leader: true },
        { text: 'Behemoth Titan — Natali Vlatko — Shipwright of Kubernetes', start: 89.5, end: 96, position: 'right', raised: true },
        { text: 'Follow the path, we\'ve got your back', start: 106.5, end: 118.8, nameplateDetail: 'Legends Sought', nameplateTitle: 'Follow the path, we\'ve got your back', statusOnly: true },
      ],
    },
  ] as const
}

/**
 * Director's Cut video sequence: includes the Gayane Ballet Suite (Adagio) prologue cold open
 * before the Destiny 2 trailer sequence.
 */
export function buildDirectorsCutVideoSequence(): readonly IntroVideoSpec[] {
  return [
    buildOpeningTitleCardSegment(),
    {
      id: 'wolves-prologue',
      kind: 'text',
      duration: 94,
      audioFadeOutSeconds: 2.5,
      audioYoutubeVideoId: 'EB3IokHelRk',
      overlays: [
        { text: 'A Gardener and a Winnower walked among the stars.', start: 0, end: 5 },
        {
          text: `One to spread life,
and one to cull the dross
to shape the Garden of Earth.`,
          start: 5,
          end: 13.75,
          backgroundCrossfade: [
            {
              day: 'img/wallpapers/bluefin-06-day.webp',
              night: 'img/wallpapers/bluefin-06-night.webp',
            },
          ],
          textPosition: 'bottom-right',
          highlightSubstrings: ['life', 'dross', 'Garden'],
        },
        {
          text: 'One day changed the Garden forever.',
          start: 13.75,
          end: 21.5,
          backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
        },
        {
          text: 'New Children arose and filled the pattern.',
          start: 21.5,
          end: 29.5,
          emphasis: 'dominant',
          textPosition: 'bottom',
          backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
        },
        {
          text: 'For eons, Maintainer-Guardians cultivated the Garden...',
          start: 29.5,
          end: 36.25,
          backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
        },
        {
          text: `Until an AI-fueled Society deemed Guardians unnecessary.
And then, a threat.`,
          start: 36.25,
          end: 45,
          backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
        },
        {
          text: 'Others came to claim a bountiful and unprotected Garden.',
          start: 45,
          end: 50,
        },
        {
          text: `In the space of a few days,
humanity had lost its future`,
          start: 50,
          end: 59.375,
          emphasis: 'dominant',
          textPosition: 'bottom',
          nameplateTitle: 'From the Age of Dinosaurs to the Pinnacle of Humanity',
        },
        {
          text: `For the heart of any race is destroyed
And its will to survive is utterly Broken`,
          start: 59.375,
          end: 65,
          emphasis: 'dominant',
          textPosition: 'bottom',
        },
        {
          text: 'When its children are taken from it',
          start: 65,
          end: 72.5,
          textPosition: 'bottom',
        },
        {
          text: `Now, what's left of a proud order fights for survival,
surrounded by predators.`,
          start: 72.5,
          end: 78.5,
          emphasis: 'dominant',
          textPosition: 'bottom',
          highlightSubstring: 'fights',
        },
        { text: 'PROJECT BLUEFIN\nseven days to the wolves', start: 78.5, end: 94, slim: true },
      ],
    },
    ...buildIntroVideoSequence(),
  ] as const
}
