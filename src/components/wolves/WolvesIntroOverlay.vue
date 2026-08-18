<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { WolvesComicHeroShot } from '@/data/wolves-comic-hero-shots'
import type { IntroOverlayTextCue, IntroStatusPayload, IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import qrMakeMeAComic from '@/assets/svg/qr-makemeacomic.svg'
import { getChromeFreeYoutubePlayerVars, getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi, suppressYoutubeCaptions } from '@/composables/useYoutubeIframeApi'
import { getActiveComicHeroShot, wolvesComicHeroShots } from '@/data/wolves-comic-hero-shots'
import { dinosaurSpecies } from '@/data/wolves-dinosaur-species'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from '@/data/wolves-directors-cut-artwork'
import {
  DEFAULT_PROLOGUE_MOOD_ID,
  DIRECTORS_CUT_HANDOFF_HOLD_MAX_MS,
  DIRECTORS_CUT_IKORA_PREWARM_SECOND,
  DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
  DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS,
  DIRECTORS_CUT_TEXT_FADE_SECONDS,
  PROLOGUE_MOODS,
  resolvePrologueMood,
} from '@/data/wolves-directors-cut-intro'
import { wolvesGuardianDinosaurBonds } from '@/data/wolves-guardian-dinosaur-bonds'
import {
  activeOverlayCue,
  activeOverlayCues,
  advanceIntroSequence,
  buildOverlayTextParts,
  createIntroSequenceState,
  isInsideTrackEndWindow,
  isTextSegment,
  isTextSegmentComplete,
  isVideoSegment,
  previousIntroSequence,
  PROLOGUE_SCENE_CROSSFADE_SECONDS,
  PROLOGUE_TEXT_FADE_SECONDS,
  skipIntroSequence,
  STANDARD_DESTINY_SEGMENT_ID,
} from '@/data/wolves-intro-sequence'

const props = defineProps<{
  videos: readonly IntroVideoSpec[]
  holdForHandoff?: boolean
  transparentHandoff?: boolean
  /**
   * Native (video-absolute) seconds to open the first video segment at, e.g. a Guardian's
   * nameplate cue when deep-linked from the lobby character gallery. Only applied once, on
   * that segment's initial `onReady`; ignored when it falls before the authored startOffset.
   */
  startAtNativeTime?: number
}>()

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'status', payload: IntroStatusPayload): void
}>()

const baseUrl = import.meta.env.BASE_URL
const comicHeroQrUrl = 'https://makemeacomic.com'
const comicHeroQrDomain = 'makemeacomic.com'
const comicHeroQrDialogue = 'Level Up a Maintainer'
const sequenceState = ref(createIntroSequenceState())
const currentTime = ref(0)
const isPaused = ref(false)
const destinyVoiceOverEnabled = ref(false)
const destinyCaptionsEnabled = ref(false)
/** The active segment's known duration, driving the hero widget's progress readout. */
const activeSegmentDuration = ref(0)
const mountHost = ref<HTMLDivElement | null>(null)
const audioMountHost = ref<HTMLDivElement | null>(null)

/**
 * Real (or authored) duration of every segment in the sequence, used to drive the permanent
 * progress bar across the whole intro rather than just the currently-playing segment. Text
 * segments' durations are known upfront; a video segment's entry stays 0 until its player
 * reports a real duration (or its `maxDuration` cutoff) in `onReady`.
 */
const segmentDurations = ref<number[]>(props.videos.map(video => (isTextSegment(video) ? video.duration : 0)))

const currentSegment = computed<IntroVideoSpec | undefined>(() => props.videos[sequenceState.value.index])
const canGoToPrevious = computed(() => sequenceState.value.index > 0)
/**
 * The last segment of the intro is the one that hands off to Track 0, so it is the only one
 * whose video audio has to be taken down before the concert's first bar arrives.
 */
const isFinalSegment = computed(() => sequenceState.value.index === props.videos.length - 1)

const activeCue = computed<IntroOverlayTextCue | undefined>(() => activeOverlayCue(currentSegment.value?.overlays, currentTime.value))
const burnedInCaptionCues = computed<readonly IntroOverlayTextCue[] | undefined>(() => {
  if (!currentSegment.value || !isVideoSegment(currentSegment.value)) {
    return undefined
  }
  return currentSegment.value.burnedInCaptions
})
/**
 * The alternate-source switch is offered by the segment's own data, never by its id: it exists
 * only where an authored segment actually carries a second upload of the same footage. The
 * Director's Cut therefore offers none — Ikora's is its primary source, there is no alternate
 * to switch to, and a theater audience has nothing to press anyway.
 */
const canToggleDestinyVoiceOver = computed(() => {
  const segment = currentSegment.value
  return Boolean(segment && isVideoSegment(segment) && segment.alternateYoutubeVideoId)
})
/**
 * The CC switch belongs to the standard conference cut's trailer, where a laptop viewer can
 * reach it. The Director's Cut is performed to a room with no input device and its only
 * burned-in cue is the Comic Hero title card, which renders switch or no switch, so it
 * publishes no caption toggle at all.
 */
const canToggleDestinyCaptions = computed(() => {
  const segment = currentSegment.value
  return Boolean(segment && isVideoSegment(segment) && segment.id === STANDARD_DESTINY_SEGMENT_ID)
})
const activeComicTitleCardCue = computed<IntroOverlayTextCue | undefined>(() => {
  const cues = burnedInCaptionCues.value ?? currentSegment.value?.overlays
  if (!cues) {
    return undefined
  }
  return cues.find((cue: IntroOverlayTextCue) => cue.comicHeroTitleCard && currentTime.value >= cue.start && currentTime.value < cue.end)
})
const activeComicHeroShot = computed(() => activeComicTitleCardCue.value
  ? getActiveComicHeroShot(currentTime.value, activeComicTitleCardCue.value)
  : undefined)
/**
 * The opening title card's cue, if one is on screen. Its quote is rendered inside the
 * nameplate block rather than as a standard caption, so the normal overlay text is
 * suppressed while it is active — otherwise the same words would paint twice.
 */
const activeTitlePlateCue = computed<IntroOverlayTextCue | undefined>(() =>
  activeCue.value?.titlePlate ? activeCue.value : undefined,
)
const comicHeroLeftOffsets = ref<Record<string, number>>({})
/**
 * The painting held on screen while a promoted trailer spins up, so the handoff is a
 * dissolve out of the prologue rather than a black frame in front of a live room.
 */
const handoffHoldCue = ref<IntroOverlayTextCue | undefined>()
/** The last cue the Director's prologue actually showed, which is what the hold holds. */
const lastDirectorsCutCue = ref<IntroOverlayTextCue | undefined>()
/** Whether the persistent player host is mounted: a video is on stage, or one is warming. */
const prewarmHostRequested = ref(false)
const isDirectorsCutPrologue = computed(() => currentSegment.value?.id === DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
/**
 * Which score the prologue is playing.
 *
 * Local to the overlay on purpose. The cut - its window, its marks, every cue -
 * is authored against the default and does not change with the mood, so
 * swapping one does not rebuild the sequence or disturb the store's timeline;
 * it reloads the hidden audio embed and nothing else.
 *
 * It is an affordance, never a dependency: a run where nobody touches the
 * transport plays `DEFAULT_PROLOGUE_MOOD_ID` from end to end, which is the
 * guarantee the whole presentation is built on.
 */
const activeMoodId = ref<string>(DEFAULT_PROLOGUE_MOOD_ID)
/**
 * Whatever the background layer should be showing. Normally the active cue; during a warm
 * handoff, the prologue's last painting, which outlives its own segment by design.
 */
const sceneCue = computed<IntroOverlayTextCue | undefined>(() => handoffHoldCue.value ?? activeCue.value)
const overlayCueForDisplay = computed<IntroOverlayTextCue | undefined>(() => {
  if (handoffHoldCue.value) {
    return handoffHoldCue.value
  }
  return activeComicTitleCardCue.value?.comicHeroTitleCard ? activeComicTitleCardCue.value : activeCue.value
})
const overlayText = computed(() => overlayCueForDisplay.value?.text)
/**
 * A scored cue's window is a musical section; its words are a thought. `textHoldSeconds`
 * separates the two, so a line clears once it has been read while its shot plays on. Cues
 * without one behave exactly as before: the words last as long as the cue does.
 */
const overlayTextVisible = computed(() => {
  const cue = overlayCueForDisplay.value
  if (!cue || handoffHoldCue.value || cue.textHoldSeconds == null) {
    return true
  }
  return currentTime.value < cue.start + cue.textHoldSeconds
})
/** The prologue's own stage: the black screen and its scene layer, plus any warm handoff. */
const sceneStageVisible = computed(() => currentSegment.value?.kind === 'text' || Boolean(handoffHoldCue.value))
/** The trailer's stage. Mounted early to warm, revealed only once it is really the show. */
const playerHostMounted = computed(() => currentSegment.value?.kind === 'video' || prewarmHostRequested.value)
const videoStageVisible = computed(() => currentSegment.value?.kind === 'video' && !handoffHoldCue.value)
const activeBurnedInCaptions = computed<readonly IntroOverlayTextCue[]>(() =>
  activeOverlayCues(burnedInCaptionCues.value, currentTime.value)
    .filter(cue => !cue.comicHeroTitleCard && (!cue.requiresCaptionToggle || destinyCaptionsEnabled.value)),
)
const activeMediaTitle = computed(() => activeBurnedInCaptions.value.find(cue => cue.mediaTitle)?.mediaTitle)
/**
 * All cues active right now, not just the first match — the Guardian trailer intentionally
 * overlaps Christoph Blecker's and Natali Vlatko's windows since they share the same shot, so
 * both callouts need to render side-by-side via their `position` anchor.
 */
const activeCues = computed<readonly IntroOverlayTextCue[]>(() => activeOverlayCues(currentSegment.value?.overlays, currentTime.value))
const activeGuardianCues = computed<readonly IntroOverlayTextCue[]>(() =>
  activeComicTitleCardCue.value ? [] : activeCues.value.filter(cue => !cue.statusOnly),
)

/**
 * Splits a Guardian cue's authored "Class — Name — Title" string into its own dossier-style
 * fields for the nerd-plate callout. A cue with more than three ` — `-separated segments (e.g.
 * Christoph Blecker's "Strand Warlock — Christoph Blecker — First Among Equals — The North
 * Star") joins everything after the name back into a single title line rather than dropping it.
 */
function parseGuardianCue(text: string): { guardianClass: string, name: string, title: string } | undefined {
  const parts = text.split(' — ')
  if (parts.length < 3) {
    return undefined
  }
  const [guardianClass, name, ...titleParts] = parts
  return { guardianClass, name, title: titleParts.join(' — ') }
}

/**
 * Splits a title line into plain/"bling" segments around one exact substring (`cue.blingTitle`),
 * so the template can wrap just that piece in a shimmering blue span instead of the whole title.
 * Falls back to a single plain segment if `blingTitle` is unset or isn't found verbatim.
 */
function titleSegments(title: string, blingTitle: string | undefined): { text: string, bling: boolean }[] {
  if (!blingTitle) {
    return [{ text: title, bling: false }]
  }
  const index = title.indexOf(blingTitle)
  if (index === -1) {
    return [{ text: title, bling: false }]
  }
  const before = title.slice(0, index)
  const after = title.slice(index + blingTitle.length)
  return [
    ...(before ? [{ text: before, bling: false }] : []),
    { text: blingTitle, bling: true },
    ...(after ? [{ text: after, bling: false }] : []),
  ]
}

type TitleToken = { kind: 'text', text: string, bling: boolean } | { kind: 'sep' }

/**
 * Flattens a multi-segment title (authored with ` — ` joins, see `parseGuardianCue`) into a
 * render-ready token stream: text segments plus explicit `sep` tokens where the author's em-dash
 * joins used to sit. The template renders `sep` tokens as a blue vertical bar
 * (`wolves-guardian-plate-title-sep`) instead of the literal em-dash characters, per explicit
 * user request, so multi-title guardians read as distinct badges divided by a UI rule rather
 * than punctuation. `blingTitle` matching still runs per segment via `titleSegments`.
 */
function titleTokens(title: string, blingTitle: string | undefined): TitleToken[] {
  const parts = title.split(' — ')
  const tokens: TitleToken[] = []
  parts.forEach((part, index) => {
    if (index > 0) {
      tokens.push({ kind: 'sep' })
    }
    for (const segment of titleSegments(part, blingTitle)) {
      tokens.push({ kind: 'text', text: segment.text, bling: segment.bling })
    }
  })
  return tokens
}

interface GuardianDinosaurCompanion {
  name?: string
  scientificName: string
  speciesId: string
  artwork: string
}

/**
 * Resolves a guardian's documented dinosaur bond into the companion plate's
 * display data: the authored dinosaur name (when a character sheet names it),
 * the species' scientific name, and the artwork URL.
 */
function guardianDinosaurCompanion(guardianName: string): GuardianDinosaurCompanion | undefined {
  const bond = wolvesGuardianDinosaurBonds.find(entry => entry.guardianName === guardianName)
  const species = bond && dinosaurSpecies.find(entry => entry.id === bond.dinosaurSpeciesId)
  if (!bond || !species) {
    return undefined
  }
  return {
    name: bond.dinosaurName,
    scientificName: species.scientificName,
    speciesId: species.id,
    artwork: `${baseUrl}${species.artwork.slice(2)}`,
  }
}

let comicHeroArtworkPredecoded = false
function predecodeComicHeroArtwork() {
  if (comicHeroArtworkPredecoded) {
    return
  }
  comicHeroArtworkPredecoded = true
  for (const shot of wolvesComicHeroShots) {
    const image = new Image()
    image.src = `${baseUrl}${shot.src}`
    void image.decode().catch(() => {
      // The image still loads normally when decode is unavailable or fails.
    })
  }
}

function centerComicHeroShot(event: Event, shot: WolvesComicHeroShot) {
  const image = event.currentTarget as HTMLImageElement
  if (!image.naturalWidth || !image.naturalHeight) {
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  try {
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let minX = canvas.width
    let maxX = -1
    // A four-pixel sample is enough for layout centering and avoids making
    // a large hero image block the title-card transition on decode.
    for (let x = 0; x < canvas.width; x += 4) {
      for (let y = 0; y < canvas.height; y += 4) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          break
        }
      }
    }
    if (maxX < minX) {
      return
    }

    const visibleCenter = (minX + maxX) / 2 / canvas.width
    const left = 50 - visibleCenter * shot.contentFrame.width
    comicHeroLeftOffsets.value = { ...comicHeroLeftOffsets.value, [shot.id]: left }
  }
  catch {
    // Cross-origin artwork cannot be sampled; retain the authored fallback frame.
  }
}

function comicHeroShotStyle(shot: WolvesComicHeroShot) {
  return {
    width: `${shot.contentFrame.width}%`,
    left: `${comicHeroLeftOffsets.value[shot.id] ?? shot.contentFrame.left}%`,
    top: `${shot.contentFrame.top}%`,
  }
}

function predecodeGuardianCompanionArtwork() {
  const preloadedArtwork = new Set<string>()

  for (const bond of wolvesGuardianDinosaurBonds) {
    const companion = guardianDinosaurCompanion(bond.guardianName)
    if (!companion || preloadedArtwork.has(companion.artwork)) {
      continue
    }

    preloadedArtwork.add(companion.artwork)
    const image = new Image()
    image.src = companion.artwork
    void image.decode().catch((error: unknown) => {
      console.warn(`Unable to predecode guardian companion artwork: ${companion.artwork}`, error)
    })
  }
}

let directorsCutConceptArtworkPredecoded = false
let directorsCutConceptWarmAbandoned = false
/**
 * Warm every approved Destiny concept painting the moment the Director's Cut
 * prologue takes the stage.
 *
 * The montage cuts on measured section marks from 133.58 s onward, and its
 * later holds are under ten seconds. A cue transition that opens on an
 * undecoded 4K painting spends that hold on an empty scene layer — on a
 * projector that reads as a dropped slide, and the cut cannot be replayed.
 *
 * **One at a time, in montage order.** Firing all ten at once is what the
 * prologue's idle minutes appear to invite, and it is wrong: the ten paintings
 * are the largest assets in the show, and ten parallel fetches saturate the
 * connection pool that the Track 0 slide preloader and the scored audio embed
 * are also using. Measured with `tests/wolves-directors-cut-slides.mjs`, a
 * ten-wide burst starved the gallery hard enough that the 35.666 s cut still
 * had the previous slide on stage. Chaining on `decode()` keeps exactly one
 * painting in flight, and because the registry order *is* the montage order,
 * the chain naturally stays ahead of the cue that needs each painting.
 *
 * Failures are swallowed on purpose: a painting that cannot be predecoded still
 * loads normally from its own `<img>`, and nothing here may hold up the scored
 * intro.
 */
async function predecodeDirectorsCutConceptArtwork() {
  if (directorsCutConceptArtworkPredecoded) {
    return
  }
  directorsCutConceptArtworkPredecoded = true

  const requested = new Set<string>()
  for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
    if (directorsCutConceptWarmAbandoned) {
      return
    }
    const url = `${baseUrl}${record.localPath}`
    if (requested.has(url)) {
      continue
    }
    requested.add(url)
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    try {
      await image.decode?.()
    }
    catch (error: unknown) {
      console.warn(`Unable to predecode Destiny concept artwork: ${url}`, error)
    }
  }
}

onMounted(() => {
  predecodeGuardianCompanionArtwork()
  // Keeps `framedLetterbox` honest when the frame changes under it.
  window.addEventListener('resize', trackViewportSize)
  trackViewportSize()
})

/**
 * Keyed to the Director's Cut prologue by segment id, not to "any text
 * segment": the standard intro must not fetch a single concept painting.
 */
watch(currentSegment, (segment) => {
  if (segment?.id === DIRECTORS_CUT_PROLOGUE_SEGMENT_ID) {
    void predecodeDirectorsCutConceptArtwork()
  }
}, { immediate: true })

watch(activeComicTitleCardCue, (cue) => {
  if (cue) {
    predecodeComicHeroArtwork()
  }
})

/**
 * Remembers what the Director's prologue last had on stage, so the handoff has a painting to
 * hold over the trailer while it spins up.
 */
watch(activeCue, (cue) => {
  if (cue && isDirectorsCutPrologue.value) {
    lastDirectorsCutCue.value = cue
  }
})

/**
 * Warms the trailer against a measured mark in the prologue's own clock, not against a wall
 * timer: this is the same clock every other cue is read off, so a paused, seeked or ad-broken
 * show warms at the same musical moment it would have anyway.
 */
watch(currentTime, (seconds) => {
  if (isDirectorsCutPrologue.value && seconds >= DIRECTORS_CUT_IKORA_PREWARM_SECOND) {
    void prewarmNextSegment()
  }
})

/**
 * The Prologue/Epilogue's somber, BPM-paced fade only applies to text-card segments; the
 * trailer's Guardian overlays stay snappy since they're synced to fast-moving footage.
 */
const isSomberTextSegment = computed(() => currentSegment.value?.kind === 'text' || Boolean(handoffHoldCue.value))
/**
 * The somber fade is capped to a fraction of the active cue's own on-screen window so a short
 * cue (e.g. the Epilogue's 3s closing line) still fully fades in with time to read, rather than
 * always using the full BPM-derived duration regardless of how briefly the cue is shown.
 *
 * The Director's Cut prices its fade off the *reading hold*, not the musical window: its
 * windows are long sections, so 20% of a 25s section was a five-second reveal on a line meant
 * to land in under two.
 */
const somberFadeDuration = computed(() => {
  const cue = activeCue.value
  if (!cue) {
    return PROLOGUE_TEXT_FADE_SECONDS
  }
  const cueWindow = cue.end - cue.start
  if (currentSegment.value?.id === DIRECTORS_CUT_PROLOGUE_SEGMENT_ID) {
    return Math.min(DIRECTORS_CUT_TEXT_FADE_SECONDS, (cue.textHoldSeconds ?? cueWindow) * 0.2)
  }
  return Math.min(PROLOGUE_TEXT_FADE_SECONDS, cueWindow * 0.85)
})
/** The Director's cut dissolves scenes at its own reveal tempo; every other segment inherits. */
const sceneCrossfadeDuration = computed(() => (
  isDirectorsCutPrologue.value ? DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS : PROLOGUE_SCENE_CROSSFADE_SECONDS
))

/**
 * The viewport, as reactive state, so the painted-box maths below re-runs when the
 * frame changes. A projector is a fixed size, but the browser this is authored and
 * verified in is not, and a value sampled once at mount is wrong for every resize
 * after it.
 */
const viewportWidth = ref(typeof window === 'undefined' ? 1920 : window.innerWidth)
const viewportHeight = ref(typeof window === 'undefined' ? 1080 : window.innerHeight)

function trackViewportSize(): void {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

/**
 * The letterbox bars around a framed painting, in pixels.
 *
 * Framed cues render `object-fit: contain` and are capped at their own source
 * pixels, so the painting almost never fills the frame: a 2048x771 panorama in a
 * 1920x1080 projector paints 1920x723 and leaves a 178.6px black bar above and
 * below it. The caption, meanwhile, was anchored to `bottom: 12%` of the
 * viewport* — 130px at 1080p — which put the words 48px *below the bottom edge
 * of the picture*, sitting on the bar. That is the "words are colliding with the
 * letterbox" defect from the owner's review, and it is a geometry bug, not a
 * taste one: it is fully determined by the source aspect ratio and reproduces
 * exactly on any screen wide enough to letterbox that record.
 *
 * Deriving the bar here lets the caption sit inside the painted box on every
 * record without hand-tuning a percentage per painting — the thing that would
 * rot the moment the registry changed, which it just did.
 */
function letterboxFor(framing: IntroOverlayTextCue['backgroundFraming']): { x: number, y: number } {
  if (!framing) {
    return { x: 0, y: 0 }
  }

  // Mirrors the CSS exactly: `contain` inside the frame, then capped at the
  // source's own pixels by `max-width`/`max-height` so the browser never
  // enlarges past what the artist delivered.
  const scale = Math.min(
    viewportWidth.value / framing.sourceWidth,
    viewportHeight.value / framing.sourceHeight,
    1,
  )

  return {
    x: Math.max(0, (viewportWidth.value - framing.sourceWidth * scale) / 2),
    y: Math.max(0, (viewportHeight.value - framing.sourceHeight * scale) / 2),
  }
}

const framedLetterbox = computed(() => letterboxFor(sceneCue.value?.backgroundFraming))

/**
 * The closing title's first line, split so the `F` of BLUEFIN can be set in the
 * brand blue.
 *
 * Requested directly by the owner (2026-08-10): "Color in the F in bluefin blue
 * on that one." It is deliberately keyed to the word rather than to the first
 * `F` in the string or to a character offset — the line is authored data, and a
 * bare index would silently colour the wrong glyph the moment the title text
 * changes. If the word is not present the line renders exactly as before.
 */
const slimTitleSegments = computed(() => {
  const line = overlayText.value?.split('\n')[0] ?? ''
  const word = 'BLUEFIN'
  const wordStart = line.indexOf(word)

  if (wordStart < 0) {
    return [{ text: line, brand: false }]
  }

  const letterIndex = wordStart + word.indexOf('F')

  return [
    { text: line.slice(0, letterIndex), brand: false },
    { text: line.slice(letterIndex, letterIndex + 1), brand: true },
    { text: line.slice(letterIndex + 1), brand: false },
  ].filter(part => part.text.length > 0)
})

function barStyle(bar: { x: number, y: number }): Record<string, string> {
  return {
    '--wc-frame-bar-x': `${Math.round(bar.x)}px`,
    '--wc-frame-bar-y': `${Math.round(bar.y)}px`,
  }
}

/** The scrim belongs to the scene, so it measures the scene's own painting. */
const framedBoxStyle = computed(() => barStyle(framedLetterbox.value))

/**
 * The caption measures the cue it is actually painting, which is not always the
 * scene cue: text outlives its shot by a fade, so binding the caption to
 * `sceneCue` offsets it by the *previous* painting's bar. In Chromium that
 * showed up as the title plate — a full-frame 16:9 image with no bars at all —
 * being inset by 203px, which is the bar belonging to the 1920x1369 record
 * before it, while the record that actually needed the inset got none.
 */
const captionBoxStyle = computed(() => barStyle(letterboxFor(overlayCueForDisplay.value?.backgroundFraming)))

/**
 * A `backgroundCrossfade` cue can list one or more day/night stages; multi-stage cues split
 * their duration evenly and cycle through each stage in turn as `currentTime` advances. This
 * picks the active stage plus its own start/duration so each stage gets an independent,
 * freshly-keyed crossfade animation.
 */
const activeCrossfadeStage = computed(() => {
  const cue = sceneCue.value
  const stages = cue?.backgroundCrossfade
  if (!cue || !stages || stages.length === 0) {
    return undefined
  }
  const cueDuration = cue.end - cue.start
  const stageDuration = cueDuration / stages.length
  const elapsed = currentTime.value - cue.start
  const index = Math.min(stages.length - 1, Math.max(0, Math.floor(elapsed / stageDuration)))
  const stageStart = cue.start + index * stageDuration
  return { crossfade: stages[index], index, start: stageStart, duration: stageDuration }
})

/**
 * A stable identity for whatever is currently occupying the background layer (a static image,
 * a crossfade stage, or nothing/black) so the outer `<Transition>` in the template can tell
 * when the *scene itself* changes (a new stage, or moving into/out of a wallpaper-lit cue)
 * versus when it's merely re-rendering the same scene. Changing this key is what triggers the
 * cross-dissolve between one scene and the next.
 */
const activeSceneKey = computed(() => {
  if (sceneCue.value?.backgroundImage) {
    return `image:${sceneCue.value.backgroundImage}`
  }
  if (activeCrossfadeStage.value) {
    return `stage:${activeCrossfadeStage.value.start}`
  }
  return 'blank'
})

/**
 * `aria-description` has unreliable screen-reader support, so the montage
 * credit is exposed instead through `aria-describedby` pointing at a
 * visually hidden node (see `.wolves-intro-overlay-visually-hidden` below).
 * The id is derived from the already-unique `activeSceneKey` so it stays
 * stable per painting without a second identity source.
 */
const activeFigureCreditId = computed(() => {
  if (!sceneCue.value?.backgroundFigure) {
    return undefined
  }
  const slug = activeSceneKey.value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
  return `wolves-intro-figure-credit-${slug}`
})

/** Splits text into single-character parts so every literal B/F can be highlighted without v-html. */
/**
 * Punctuation is stripped from displayed intro text only (authored data keeps
 * it): periods and commas read as clutter at theater scale, per owner request.
 */
function stripIntroPunctuation(text: string): string {
  return text.replace(/[.,]/g, '')
}

function formatIntroCueText(text: string, preservePunctuation?: boolean): string {
  return preservePunctuation ? text : stripIntroPunctuation(text)
}

function activeVideoId(segment: Extract<IntroVideoSpec, { kind: 'video' }>): string {
  return destinyVoiceOverEnabled.value && segment.alternateYoutubeVideoId
    ? segment.alternateYoutubeVideoId
    : segment.youtubeVideoId
}

function activeVideoCutoffDuration(segment: Extract<IntroVideoSpec, { kind: 'video' }>): number | undefined {
  return destinyVoiceOverEnabled.value
    ? (segment.alternateMaxDuration ?? segment.maxDuration)
    : segment.maxDuration
}

function clampVideoSourceTime(segment: Extract<IntroVideoSpec, { kind: 'video' }>, time: number): number {
  const cutoff = activeVideoCutoffDuration(segment)
  return cutoff == null ? time : Math.min(time, cutoff)
}

const overlayTextParts = computed(() => {
  const cue = overlayCueForDisplay.value
  const text = formatIntroCueText(overlayText.value ?? '', cue?.preservePunctuation)
  const explicitHighlights = cue?.highlightSubstrings
    ?? (cue?.highlightSubstring ? [cue.highlightSubstring] : undefined)
  return buildOverlayTextParts(
    text,
    explicitHighlights?.map(highlight => formatIntroCueText(highlight, cue?.preservePunctuation)),
  )
})

let player: YoutubePlayer | null = null
let audioPlayer: YoutubePlayer | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let textTimer: ReturnType<typeof setInterval> | null = null
/** Resolution of a text card's own tick, and the unit the stall watchdog counts in. */
const TEXT_CLOCK_TICK_MS = 100
/**
 * How long the background audio's clock may sit pinned at 0 before the card gives up on it.
 *
 * Short, because releasing is cheap and reversible: the recovery check hands the card straight
 * back to the music the instant the player's clock moves, so a false positive on a slow cold
 * buffer costs a brief desync and nothing else. A pre-roll ad does not look like this — during
 * an ad the embed reports the ad's own advancing time, so it never sits frozen on exactly 0.
 * A clock still pinned to the origin this long is a player the browser refused to start.
 */
const BLOCKED_AUDIO_SECONDS = 5

/**
 * How long a video segment may sit on its opening frame before the show skips it.
 *
 * Three times the audio threshold, because this decision cannot be taken back: advancing
 * discards the segment, so it must outlast a cold buffer on a bad conference network rather
 * than merely a hesitation. The audio side can afford to be twitchy; this side cannot.
 */
const BLOCKED_VIDEO_SECONDS = 15
/** performance.now() corresponding to elapsed 0 on a silent text card. */
let textClockOriginMs = 0
/** The background audio embed published its own `ENDED` state for the active scored card. */
let audioTrackEnded = false
/** The background audio died (error, or an `ENDED` before it started); its clock is abandoned. */
let audioClockReleased = false
/** Milliseconds the background audio's clock has sat on `lastAudioClockReading`. */
let audioClockStalledMs = 0
/** Previous reading from the background audio's clock, used only to detect a frozen one. */
let lastAudioClockReading: number | null = null

/**
 * How long the trailer's audio takes to reach silence at the intro→Track 0 junction.
 *
 * The authored `audioFadeOutSeconds` musical fade only exists on `text` segments and only
 * touches `audioPlayer`, but the final intro segment is the Destiny trailer — a `video`
 * segment on the main `player`. Without this the trailer's audio was severed mid-air by
 * `destroyPlayer()` and Track 0 slammed in at full volume over the silence.
 */
const VIDEO_HANDOFF_FADE_SECONDS = 2
/** Ramp resolution for the completion-time fallback fade; the poll loop drives the lead fade. */
const VIDEO_HANDOFF_FADE_STEP_MS = 50
/** Last volume actually pushed to the video player, so a ramp can resume from where it sits. */
let videoVolume = 100
let handoffFadeTimer: ReturnType<typeof setInterval> | null = null

/**
 * Equal-power taper: two linear ramps sum to a dip in perceived loudness at the midpoint, and
 * Track 0 is coming up underneath this one.
 */
function equalPowerFadeOut(progress: number): number {
  return Math.cos(Math.min(Math.max(progress, 0), 1) * (Math.PI / 2))
}

function stopHandoffFade() {
  if (handoffFadeTimer) {
    clearInterval(handoffFadeTimer)
    handoffFadeTimer = null
  }
}

function applyVideoVolume(level: number) {
  const clamped = Math.round(Math.min(Math.max(level, 0), 100))
  if (clamped === videoVolume) {
    return
  }
  videoVolume = clamped
  player?.setVolume?.(clamped)
}

/**
 * Guard against a click landing a hair before the active cue's own start and "advancing" to
 * the cue already on screen, which reads to the presenter as a dead click.
 */
const CUE_ADVANCE_EPSILON_SECONDS = 0.05

let loadToken = 0
let pendingPausedSourceSwitchTime: number | null = null
/** Whether the one-shot `startAtNativeTime` deep-link opening has already been applied. */
let deepLinkStartConsumed = false
/**
 * The warm handoff's staging area: a player built during the prologue and parked, plus the
 * numbers the promotion needs so it can start playing without re-deriving (and re-seeking)
 * anything. Kept out of `player` so `destroyPlayer()` — which every segment change calls —
 * cannot tear down the very thing the handoff is warming.
 */
let prewarmedPlayer: YoutubePlayer | null = null
let prewarmedSegmentId: string | null = null
let prewarmedStartSeconds = 0
let prewarmedIsDeepLink = false
/** Whether the warmed player has reported ready and been parked. An unready one cannot promote. */
let prewarmedReady = false
let prewarmToken = 0
let handoffHoldTimer: ReturnType<typeof setTimeout> | null = null
const handoffPending = ref(false)

/** Seek within the active segment by 0..1 ratio, driven by the hero widget's progress bar. */
function seekToSeconds(targetSeconds: number) {
  const clamped = Math.min(Math.max(targetSeconds, 0), activeSegmentDuration.value)
  currentTime.value = clamped
  if (currentSegment.value?.kind === 'video') {
    player?.seekTo?.(clamped, true)
  }
  else {
    // Text segments follow the background audio's clock, so the audio must move too.
    // A silent card has no audio player, so rebase its own clock origin instead.
    audioPlayer?.seekTo?.(clamped, true)
    textClockOriginMs = performance.now() - clamped * 1000
  }
}

function seekToNativeSeconds(targetSeconds: number) {
  const clamped = Math.max(targetSeconds, 0)
  currentTime.value = clamped
  if (currentSegment.value?.kind === 'video') {
    player?.seekTo?.(clamped, true)
  }
  else {
    audioPlayer?.seekTo?.(clamped, true)
  }
}

function seekToRatio(ratio: number) {
  if (activeSegmentDuration.value <= 0) {
    return
  }
  seekToSeconds(Math.min(Math.max(ratio, 0), 1) * activeSegmentDuration.value)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopTextTimer() {
  if (textTimer) {
    clearInterval(textTimer)
    textTimer = null
  }
}

function destroyPlayer() {
  stopPolling()
  stopHandoffFade()
  pendingPausedSourceSwitchTime = null
  player?.destroy?.()
  player = null
  videoVolume = 100
}

/**
 * Take the trailer's audio down across the final segment's own closing seconds, recomputed
 * every tick so seeking back out of the window restores full volume instead of leaving the
 * trailer stuck quiet. Same contract as the authored `audioFadeOutSeconds` text fade.
 */
function updateHandoffFade() {
  if (!isFinalSegment.value || isPaused.value || activeSegmentDuration.value <= 0 || !player?.setVolume) {
    return
  }
  const remaining = activeSegmentDuration.value - currentTime.value
  if (remaining > VIDEO_HANDOFF_FADE_SECONDS) {
    applyVideoVolume(100)
    return
  }
  applyVideoVolume(equalPowerFadeOut(1 - remaining / VIDEO_HANDOFF_FADE_SECONDS) * 100)
}

/**
 * Completion-time safety net for every path that reaches the end without running the lead
 * fade above — an early `ENDED`, a player error, Skip, or the presenter pressing Next. It
 * ramps from wherever the volume already sits (so a completed lead fade destroys at once)
 * and destroys the player only when the ramp lands.
 *
 * This never delays `emit('complete')`: Track 0's load has to start in parallel with the
 * ramp, because the overlay is held opaque until `stage.start()` resolves. Serialising them
 * would lengthen the very gap this fade exists to close.
 */
function fadeOutAndDestroyPlayer() {
  if (handoffFadeTimer) {
    return
  }
  stopPolling()

  const activePlayer = player
  if (!activePlayer?.setVolume || videoVolume <= 0) {
    destroyPlayer()
    return
  }

  const rampMs = VIDEO_HANDOFF_FADE_SECONDS * 1000 * (videoVolume / 100)
  const startVolume = videoVolume
  const startedAtMs = performance.now()
  handoffFadeTimer = setInterval(() => {
    // Unmount or a fresh segment load can tear the player out from under the ramp.
    if (player !== activePlayer) {
      stopHandoffFade()
      return
    }
    const progress = (performance.now() - startedAtMs) / rampMs
    applyVideoVolume(equalPowerFadeOut(progress) * startVolume)
    if (progress >= 1) {
      destroyPlayer()
    }
  }, VIDEO_HANDOFF_FADE_STEP_MS)
}

function destroyAudioPlayer() {
  audioPlayer?.destroy?.()
  audioPlayer = null
  audioTrackEnded = false
  audioClockReleased = false
  audioClockStalledMs = 0
  lastAudioClockReading = null
}

function advance() {
  sequenceState.value = advanceIntroSequence(sequenceState.value, props.videos.length)
}

/**
 * Hand a scored card back to its own origin clock when the background audio stops being one — a
 * player error, or an `ENDED` that arrives outside the track's measured silent tail (an ad
 * break, a dead or region-blocked upload).
 *
 * This is not a second clock running alongside the music. It is provisional: the tick keeps
 * watching the real clock, and the moment it moves again the card snaps straight back to it.
 * Without it the card would freeze on whichever cue was on screen, because every later cue keys
 * off an audio clock that will never move again; with it, the authored windows still play out
 * and the card still ends where it was written to end — the only outcome a live room survives.
 *
 * Clearing `audioTrackEnded` here matters: an out-of-window `ENDED` is exactly what triggers a
 * release, and leaving the flag `true` would stay stale on the card's own free-running clock —
 * completing the card the instant that clock crossed into the end window, up to a full second
 * before the authored duration, on the strength of a signal that was never inside the window.
 */
function releaseAudioClock() {
  audioClockReleased = true
  audioClockStalledMs = 0
  audioTrackEnded = false
  textClockOriginMs = performance.now() - currentTime.value * 1000
}

async function loadAudioTrack(youtubeVideoId: string | undefined, token: number, startSeconds = 0) {
  destroyAudioPlayer()
  if (!youtubeVideoId) {
    return
  }

  try {
    await loadYoutubeIframeApi()
  }
  catch {
    return
  }

  await nextTick()

  const PlayerCtor = getYoutubePlayerConstructor()
  if (!PlayerCtor || !audioMountHost.value || token !== loadToken) {
    return
  }

  audioMountHost.value.replaceChildren()
  const mountNode = document.createElement('div')
  audioMountHost.value.appendChild(mountNode)

  audioPlayer = new PlayerCtor(mountNode, {
    width: '1',
    height: '1',
    videoId: youtubeVideoId,
    // A mood longer than the show is entered at its offset, the same way the
    // video segments skip a rating card, using YouTube's own `start` param.
    playerVars: getChromeFreeYoutubePlayerVars({
      autoplay: 1,
      ...(startSeconds ? { start: Math.round(startSeconds) } : {}),
    }),
    events: {
      // The background embed's own end state is the scored card's completion backstop: a real
      // player's clock routinely plateaus short of the duration it reports, so waiting for
      // `elapsed >= duration` alone can hang the show on its closing title. These handlers only
      // raise flags — the 100ms tick below stays the single place that decides the card is
      // over, so no signal can advance the sequence twice.
      onStateChange: (event: { data: number }) => {
        if (token !== loadToken || event.data !== getYoutubePlayerState().ENDED) {
          return
        }
        audioTrackEnded = true
      },
      onError: () => {
        if (token !== loadToken) {
          return
        }
        releaseAudioClock()
      },
    },
  })
}

function startTextSegment(segment: Extract<IntroVideoSpec, { kind: 'text' }>) {
  stopTextTimer()
  const token = loadToken
  currentTime.value = 0
  activeSegmentDuration.value = segment.duration
  textClockOriginMs = performance.now()
  void loadAudioTrack(segment.audioYoutubeVideoId, token, segment.audioStartSeconds ?? 0)

  textTimer = setInterval(() => {
    const now = performance.now()
    if (isPaused.value) {
      // Hold the clock by trailing the origin, so resuming continues where it stopped.
      textClockOriginMs = now - currentTime.value * 1000
      // A paused clock is held, not stalled; the end-of-track backstop must not read it as one.
      audioClockStalledMs = 0
      return
    }
    // Ad resilience: when a background audio embed exists, cues key off the
    // audio's real getCurrentTime(). Pre-roll ads hold it at 0 and mid-roll ads
    // freeze it, so the cold open waits for the music instead of desyncing.
    // A mood entered part-way through its own recording reports the *track's*
    // time, not the show's, so the offset comes back off here. Without this the
    // segment would open on whatever cue happens to sit at the offset and run
    // out early.
    const audioOffset = segment.audioStartSeconds ?? 0
    const audioClock = audioPlayer && typeof audioPlayer.getCurrentTime === 'function'
      ? Math.max(0, (audioPlayer.getCurrentTime() ?? 0) - audioOffset)
      : null
    // A released clock is watched, not abandoned. The moment the player's own clock moves again
    // — an ad finished, a stalled stream recovered — the card snaps back to the music, which is
    // the only thing it is ever allowed to synchronise with.
    if (audioClock != null && audioClockReleased && audioClock > (lastAudioClockReading ?? 0)) {
      audioClockReleased = false
      audioTrackEnded = false
    }
    if (audioClock != null && !audioClockReleased) {
      // Watchdog only, never a cue source: how long the player's own clock has sat on the
      // identical reading. A playing player reports a new value every tick, so any repeat is
      // buffering, an ad, or the end of the track — `isTextSegmentComplete` decides which.
      audioClockStalledMs = audioClock === lastAudioClockReading ? audioClockStalledMs + TEXT_CLOCK_TICK_MS : 0
      lastAudioClockReading = audioClock
      currentTime.value = audioClock
      // Blocked autoplay, which is the one stall that is not an ad and never recovers on its
      // own. A pre-roll ad or a buffering stream freezes the clock somewhere inside the piece
      // and resumes; a player the browser refused to start never leaves 0 at all, and the
      // stall backstop above cannot save it because that only fires inside the track's end
      // window. Left alone, the cold open holds its first card in front of the room forever.
      // Releasing hands the card to its own wall clock so the show still plays; the recovery
      // check above snaps it back the instant the music actually starts.
      if (audioClock === 0 && audioClockStalledMs / 1000 > BLOCKED_AUDIO_SECONDS) {
        releaseAudioClock()
      }
    }
    else {
      // A silent card (the presenter's welcome slide) has no player to read, so it
      // derives elapsed time from a fixed origin. Two rules this encodes the hard
      // way: never assume the interval fired on schedule — a hardcoded `+= 0.2` on
      // a 100ms tick ran every silent card at double speed, so the 59s opening slide
      // played in 29.5s and nobody in the back row finished a paragraph — and never
      // accumulate deltas, which drifts over a card this long.
      currentTime.value = (now - textClockOriginMs) / 1000
    }
    // An `ENDED` from outside the source's measured silent tail is an ad break or a dead
    // upload, not the end of the music: believing it would cut the scored act short mid-piece.
    if (audioTrackEnded && !audioClockReleased && !isInsideTrackEndWindow(segment, currentTime.value)) {
      releaseAudioClock()
    }
    // Authored musical fade: ramp the audio down across the excerpt's final
    // seconds so it ends on the phrase's own decay instead of a hard cut. The
    // window is recomputed every tick, so seeking back out of it restores full
    // volume instead of leaving the music stuck quiet (the "glitched fade").
    if (segment.audioFadeOutSeconds && audioPlayer?.setVolume) {
      const remaining = segment.duration - currentTime.value
      if (remaining <= segment.audioFadeOutSeconds) {
        const ratio = Math.max(0, remaining / segment.audioFadeOutSeconds)
        audioPlayer.setVolume(Math.round(ratio * 100))
      }
      else {
        audioPlayer.setVolume(100)
      }
    }
    if (isTextSegmentComplete(segment, currentTime.value, {
      ended: audioTrackEnded,
      stalledSeconds: audioClockStalledMs / 1000,
    })) {
      // Stop first: the card is over, and a second tick must never advance a second time.
      stopTextTimer()
      advance()
    }
  }, TEXT_CLOCK_TICK_MS)
}

/**
 * Everything the show does once a player is actually its player: assert the opening frame,
 * publish the segment's duration, and start the transport poll.
 *
 * Split out of `onReady` because a promoted player has already been ready for a minute. The
 * `assertOpeningFrame` flag is what separates the two paths: a cold player has to be pushed
 * back onto its authored opening frame (YouTube restores prior watch positions for a reused
 * video id), while a warmed player is already parked exactly there — re-loading and re-seeking
 * it is the visible stutter the prewarm exists to remove.
 */
function beginSegmentPlayback(
  segment: Extract<IntroVideoSpec, { kind: 'video' }>,
  openingTime: number,
  options: { assertOpeningFrame: boolean, isDeepLink: boolean },
) {
  if (options.assertOpeningFrame) {
    if (!options.isDeepLink) {
      // Reload only for front-door entries: loadVideoById restarts playback from the
      // buffered beginning, which would discard a deep-linked Guardian opening time.
      player?.loadVideoById?.({ videoId: activeVideoId(segment), startSeconds: openingTime })
    }
    player?.seekTo?.(openingTime, true)
  }
  currentTime.value = openingTime
  activeSegmentDuration.value = activeVideoCutoffDuration(segment) ?? player?.getDuration?.() ?? 0
  segmentDurations.value[sequenceState.value.index] = activeSegmentDuration.value
  stopPolling()
  let lastVideoTime = -1
  let lastVideoAdvanceMs = performance.now()
  pollTimer = setInterval(() => {
    currentTime.value = player?.getCurrentTime?.() ?? 0
    updateHandoffFade()
    const now = performance.now()
    if (currentTime.value !== lastVideoTime) {
      lastVideoTime = currentTime.value
      lastVideoAdvanceMs = now
    }
    if (isPaused.value) {
      // A paused player is held, not stalled. Trailing the mark here is what stops a deliberate
      // pause from accumulating into a blocked-autoplay verdict and skipping the segment.
      lastVideoAdvanceMs = now
      return
    }
    if (activeVideoCutoffDuration(segment) == null) {
      return
    }
    if (currentTime.value >= activeSegmentDuration.value) {
      advance()
      return
    }
    // Unattended fallback, the video-segment twin of the audio clock's blocked-autoplay
    // release: a player still sitting on its opening frame this long was never allowed to
    // start, and there is nobody in the room who can click it. Advancing costs one segment;
    // waiting costs the rest of the show, in front of everyone.
    const nearStart = currentTime.value <= Math.min(10, activeSegmentDuration.value / 2)
    if (nearStart && (now - lastVideoAdvanceMs) / 1000 > BLOCKED_VIDEO_SECONDS) {
      advance()
    }
  }, 200)
}

/**
 * Builds a segment's player into the persistent host.
 *
 * The same constructor serves the warm and the cold path because YouTube fixes a player's
 * event handlers at construction: a player warmed with inert handlers could never be given
 * live ones at promotion. The handlers instead ask whether this player is the show's player
 * yet, so a parked player's own CUED/ENDED/error traffic cannot touch the sequence, and the
 * moment it is promoted the very same handlers become live.
 */
function buildSegmentPlayer(
  segment: Extract<IntroVideoSpec, { kind: 'video' }>,
  options: { parked: boolean, startTime: number, isDeepLink: boolean },
): YoutubePlayer | null {
  const PlayerCtor = getYoutubePlayerConstructor()
  if (!PlayerCtor || !mountHost.value) {
    return null
  }

  mountHost.value.replaceChildren()
  const mountNode = document.createElement('div')
  mountHost.value.appendChild(mountNode)

  const playerVars = getChromeFreeYoutubePlayerVars({
    autoplay: options.parked ? 0 : 1,
    // Keep YouTube's own captions off so the burned-in subtitles remain the only overlay.
    cc_load_policy: 0,
    ...(options.startTime ? { start: Math.round(options.startTime) } : {}),
  })

  let self: YoutubePlayer | null = null
  const isShowPlayer = () => self != null && player === self

  self = new PlayerCtor(mountNode, {
    width: '100%',
    height: '100%',
    videoId: activeVideoId(segment),
    playerVars,
    events: {
      // YouTube's caption module can arrive long after `onReady`, when the
      // stream's own caption track resolves. `onApiChange` is the event that
      // fires on exactly that, so it is where the suppression has to hold — the
      // burned-in subtitles below are the only captions this show projects.
      onApiChange: () => {
        suppressYoutubeCaptions(self)
      },
      onReady: () => {
        suppressYoutubeCaptions(self)
        if (!isShowPlayer()) {
          parkPrewarmedPlayer(self!, segment, options.startTime)
          return
        }
        beginSegmentPlayback(segment, options.startTime, { assertOpeningFrame: true, isDeepLink: options.isDeepLink })
      },
      onStateChange: (event: { data: number }) => {
        if (!isShowPlayer()) {
          return
        }
        if (event.data === getYoutubePlayerState().PLAYING) {
          isPaused.value = false
          // A real frame from the trailer is the only thing allowed to end the warm handoff.
          releaseHandoffHold()
          if (pendingPausedSourceSwitchTime != null) {
            const pausedTime = pendingPausedSourceSwitchTime
            pendingPausedSourceSwitchTime = null
            currentTime.value = pausedTime
            player?.seekTo?.(pausedTime, true)
            player?.pauseVideo?.()
            return
          }
        }
        if (event.data === getYoutubePlayerState().PAUSED || event.data === getYoutubePlayerState().CUED) {
          isPaused.value = true
        }
        if (event.data === getYoutubePlayerState().ENDED) {
          advance()
        }
      },
      onError: () => {
        if (!isShowPlayer()) {
          // A dead warm player is discarded silently; the cold path will try again at the cut.
          discardPrewarmedPlayer()
          return
        }
        // A missing/restricted video must never block the live experience.
        releaseHandoffHold()
        advance()
      },
    },
  })

  return self
}

/**
 * Parks a warmed player: muted, cued to its authored opening frame, and paused.
 *
 * `mute()` rather than `setVolume(0)` — the mute latch is what a browser's autoplay policy
 * actually reads, and a volume of zero on an unmuted player is still an unmuted player.
 * `cueVideoById` rather than `loadVideoById` — a cue stages the stream without playing it,
 * which is the whole point; a load would start the trailer under the music.
 */
function parkPrewarmedPlayer(warmed: YoutubePlayer, segment: Extract<IntroVideoSpec, { kind: 'video' }>, startTime: number) {
  warmed.mute?.()
  warmed.cueVideoById?.({ videoId: activeVideoId(segment), startSeconds: startTime })
  warmed.seekTo?.(startTime, true)
  warmed.pauseVideo?.()
  // Adopt on readiness rather than on construction: readiness is what makes a warmed player
  // promotable, and it is the only moment guaranteed to be after the constructor returned.
  prewarmedPlayer = warmed
  prewarmedReady = true
}

function discardPrewarmedPlayer() {
  prewarmedPlayer?.destroy?.()
  prewarmedPlayer = null
  prewarmedSegmentId = null
  prewarmedStartSeconds = 0
  prewarmedIsDeepLink = false
  prewarmedReady = false
  prewarmHostRequested.value = false
}

/**
 * Builds the next segment's player early and parks it, so the cut into the trailer is a cut
 * and not a wait. Gated on the Director's prologue by segment id, not on "any text segment":
 * the standard conference cut must not open a second embed nobody asked for.
 */
async function prewarmNextSegment() {
  const next = props.videos[sequenceState.value.index + 1]
  if (prewarmedSegmentId || !next || !isVideoSegment(next)) {
    return
  }

  // Claim the slot before the first await so a second tick cannot start a second player.
  prewarmedSegmentId = next.id
  prewarmHostRequested.value = true
  const token = ++prewarmToken

  try {
    await loadYoutubeIframeApi()
  }
  catch {
    discardPrewarmedPlayer()
    return
  }

  await nextTick()

  if (token !== prewarmToken || sequenceState.value.done || currentSegment.value?.kind !== 'text') {
    return
  }

  const deepLinkTime = deepLinkStartConsumed ? null : (props.startAtNativeTime ?? null)
  deepLinkStartConsumed = true
  prewarmedStartSeconds = Math.max(next.startOffset ?? 0, deepLinkTime ?? 0)
  prewarmedIsDeepLink = deepLinkTime != null

  const warmed = buildSegmentPlayer(next, {
    parked: true,
    startTime: prewarmedStartSeconds,
    isDeepLink: prewarmedIsDeepLink,
  })
  if (!warmed) {
    discardPrewarmedPlayer()
    return
  }
  prewarmedPlayer = warmed
}

/**
 * Ends the warm handoff and reveals the trailer. Idempotent: the bounded timeout and the
 * player's first real frame race each other by design, and whichever lands first wins.
 */
function releaseHandoffHold() {
  if (handoffHoldTimer) {
    clearTimeout(handoffHoldTimer)
    handoffHoldTimer = null
  }
  handoffHoldCue.value = undefined
}

/**
 * Promotes the warmed player into the show player: unmute, play, and hold the prologue's
 * last painting over it until it produces a real frame.
 *
 * The music is already gone by the time this runs — `loadCurrentSegment` destroys the audio
 * player before it reaches here — so the unmute can never put the trailer's audio on top of
 * the score.
 */
function promotePrewarmedPlayer(segment: Extract<IntroVideoSpec, { kind: 'video' }>): boolean {
  if (!prewarmedPlayer || prewarmedSegmentId !== segment.id || !prewarmedReady) {
    return false
  }

  const warmed = prewarmedPlayer
  const openingTime = prewarmedStartSeconds
  const isDeepLink = prewarmedIsDeepLink
  prewarmedPlayer = null
  prewarmedSegmentId = null
  prewarmedReady = false
  prewarmHostRequested.value = false
  player = warmed

  handoffHoldCue.value = lastDirectorsCutCue.value
  if (handoffHoldCue.value) {
    handoffHoldTimer = setTimeout(releaseHandoffHold, DIRECTORS_CUT_HANDOFF_HOLD_MAX_MS)
  }

  videoVolume = 100
  warmed.unMute?.()
  warmed.playVideo?.()
  beginSegmentPlayback(segment, openingTime, { assertOpeningFrame: false, isDeepLink })
  return true
}

async function loadVideoSegment(segment: Extract<IntroVideoSpec, { kind: 'video' }> | undefined) {
  const token = ++loadToken
  currentTime.value = 0
  destroyPlayer()

  if (!segment) {
    // Nothing left to play (e.g. an empty sequence) — never block the live experience.
    sequenceState.value = skipIntroSequence(sequenceState.value)
    return
  }

  if (promotePrewarmedPlayer(segment)) {
    return
  }
  discardPrewarmedPlayer()

  try {
    await loadYoutubeIframeApi()
  }
  catch {
    if (token === loadToken) {
      advance()
    }
    return
  }

  // Component may have advanced/unmounted while the API script was loading.
  if (token !== loadToken || sequenceState.value.done) {
    return
  }

  await nextTick()

  // Re-check after the second await — Skip (or a fresh advance) may have landed while
  // waiting for the DOM flush above.
  if (token !== loadToken || sequenceState.value.done) {
    return
  }

  // A gallery deep link overrides the authored opening frame, once, for the first player.
  const deepLinkTime = deepLinkStartConsumed ? null : (props.startAtNativeTime ?? null)
  deepLinkStartConsumed = true
  const startTime = Math.max(segment.startOffset ?? 0, deepLinkTime ?? 0)

  player = buildSegmentPlayer(segment, { parked: false, startTime, isDeepLink: deepLinkTime != null })
  if (!player) {
    advance()
  }
}

function loadCurrentSegment(segment: IntroVideoSpec | undefined) {
  loadToken += 1
  isPaused.value = false
  // Leaving a segment that offers an alternate source drops back to its primary, so a
  // Director's Cut segment can never inherit a switch state set on the standard cut.
  if (!segment || !isVideoSegment(segment) || !segment.alternateYoutubeVideoId) {
    destinyVoiceOverEnabled.value = false
  }
  destroyPlayer()
  releaseHandoffHold()
  stopTextTimer()
  destroyAudioPlayer()

  if (!segment) {
    sequenceState.value = skipIntroSequence(sequenceState.value)
    return
  }

  if (isTextSegment(segment)) {
    // A card is back on stage (the show started, or the presenter stepped back): whatever was
    // warmed for a cut that is no longer next has to go, or it holds the host the next
    // warm-up needs.
    discardPrewarmedPlayer()
    startTextSegment(segment)
    return
  }

  if (isVideoSegment(segment)) {
    void loadVideoSegment(segment)
  }
}

watch(() => sequenceState.value.done, (done) => {
  if (done) {
    fadeOutAndDestroyPlayer()
    discardPrewarmedPlayer()
    releaseHandoffHold()
    stopTextTimer()
    destroyAudioPlayer()
    handoffPending.value = props.holdForHandoff ?? false
    emit('complete')
  }
})

watch(currentSegment, (segment) => {
  loadCurrentSegment(segment)
}, { immediate: true })

function handleNext() {
  sequenceState.value = advanceIntroSequence(sequenceState.value, props.videos.length)
}

/**
 * Presenter pacing for a silent text card: jump to the next authored cue, or into the next
 * segment once the last cue is up.
 *
 * This is an operator affordance, not a narrative dependency. The card still advances itself
 * on its own clock, so an unattended run behaves exactly as before and never waits for input.
 * It exists because the welcome card is spoken live: the presenter finishes a line and wants
 * the next one, rather than standing in silence until the authored window expires.
 *
 * Scored cards are deliberately excluded. A card with a music bed has its cues written against
 * that track, so moving the text without moving the music desyncs the segment for the rest of
 * its run. Only a silent card, where the presenter's own voice is the soundtrack, is safe to
 * pace by hand.
 */
function advanceTextCue() {
  const segment = currentSegment.value
  if (!segment || !isTextSegment(segment) || segment.audioYoutubeVideoId || isPaused.value) {
    return
  }

  const nextCue = segment.overlays
    ?.filter(cue => cue.start > currentTime.value + CUE_ADVANCE_EPSILON_SECONDS)
    .sort((a, b) => a.start - b.start)[0]

  if (!nextCue) {
    handleNext()
    return
  }

  seekToSeconds(nextCue.start)
}

/**
 * Advance the welcome card when the presenter clicks it. Clicks on the transport chrome are
 * left alone so Play/Pause/Next keep their own meaning, and video and scored segments are
 * untouched: only a silent, presenter-spoken text card is click-advanced.
 */
function handleOverlayClick(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest('button, a, input, [role="button"]')) {
    return
  }
  advanceTextCue()
}
function handlePrevious() {
  sequenceState.value = previousIntroSequence(sequenceState.value)
}

function setPrologueMood(id: string) {
  const segment = currentSegment.value
  if (!segment || !isTextSegment(segment) || !isDirectorsCutPrologue.value) {
    return
  }

  const mood = resolvePrologueMood(id)
  if (mood.id === activeMoodId.value) {
    return
  }

  activeMoodId.value = mood.id
  // Enter the new track where the show already is, not at its beginning: the
  // audience is mid-prologue and the cut keeps running underneath. Same
  // contract as the Destiny segment's voice-over switch, which preserves time
  // across two sources.
  void loadAudioTrack(mood.youtubeVideoId, loadToken, mood.offsetSeconds + currentTime.value)
}

function setVoiceOverEnabled(enabled: boolean) {
  const segment = currentSegment.value
  if (!segment || !isVideoSegment(segment) || !canToggleDestinyVoiceOver.value) {
    return
  }

  if (destinyVoiceOverEnabled.value === enabled) {
    return
  }

  destinyVoiceOverEnabled.value = enabled

  if (!player?.loadVideoById) {
    return
  }

  const shouldPause = isPaused.value
  const preservedTime = clampVideoSourceTime(segment, player.getCurrentTime?.() ?? currentTime.value)
  currentTime.value = preservedTime
  activeSegmentDuration.value = activeVideoCutoffDuration(segment) ?? player.getDuration?.() ?? activeSegmentDuration.value
  segmentDurations.value[sequenceState.value.index] = activeSegmentDuration.value
  pendingPausedSourceSwitchTime = shouldPause ? preservedTime : null

  player.loadVideoById({
    videoId: activeVideoId(segment),
    startSeconds: preservedTime,
  })
}

function setCaptionsEnabled(enabled: boolean) {
  if (!canToggleDestinyCaptions.value) {
    return
  }
  destinyCaptionsEnabled.value = enabled
}

function handleTogglePlayback() {
  const isVideoPlayback = Boolean(currentSegment.value && isVideoSegment(currentSegment.value))
  const activePlayer = isVideoPlayback ? player : audioPlayer
  const nextPaused = !isPaused.value
  if (isPaused.value) {
    activePlayer?.playVideo?.()
  }
  else {
    activePlayer?.pauseVideo?.()
  }
  if (!isVideoPlayback) {
    isPaused.value = nextPaused
  }
}

onBeforeUnmount(() => {
  // The intro is over (skipped, or handed off to Track 0): stop warming
  // paintings nobody is going to see, so the chain cannot keep taking
  // bandwidth from the show that replaced it.
  directorsCutConceptWarmAbandoned = true
  window.removeEventListener('resize', trackViewportSize)
  destroyPlayer()
  discardPrewarmedPlayer()
  releaseHandoffHold()
  stopTextTimer()
  destroyAudioPlayer()
  if (import.meta.env.DEV) {
    delete (window as any).__wolvesIntro
  }
})

// Publishes playback state so the app-level Destiny hero widget (the single
// transport surface) can render intro progress without owning any player.
watchEffect(() => {
  emit('status', {
    currentTime: currentTime.value,
    duration: activeSegmentDuration.value,
    paused: isPaused.value,
    segmentId: currentSegment.value?.id ?? '',
    canGoPrevious: canGoToPrevious.value,
    nameplateTitle: activeCue.value?.nameplateTitle,
    nameplateGlitch: activeCue.value?.glitch,
    nameplateDetail: activeCue.value?.nameplateDetail,
    mediaTitle: activeMediaTitle.value,
    showVoiceOverToggle: canToggleDestinyVoiceOver.value,
    voiceOverEnabled: canToggleDestinyVoiceOver.value ? destinyVoiceOverEnabled.value : false,
    moods: isDirectorsCutPrologue.value ? PROLOGUE_MOODS.map(mood => ({ id: mood.id, label: mood.label })) : [],
    activeMoodId: activeMoodId.value,
    showCaptionToggle: canToggleDestinyCaptions.value,
    captionsEnabled: canToggleDestinyCaptions.value ? destinyCaptionsEnabled.value : false,
  })
})

watchEffect(() => {
  if (!import.meta.env.DEV) {
    return
  }
  ;(window as any).__wolvesIntro = {
    seekTo: (seconds: number) => seekToSeconds(seconds),
    seekToNativeTime: (seconds: number) => seekToNativeSeconds(seconds),
    getCurrentTime: () => currentTime.value,
    getDuration: () => activeSegmentDuration.value,
    getPlayerDuration: () => player?.getDuration?.() ?? 0,
    getVideoId: () => (currentSegment.value && isVideoSegment(currentSegment.value) ? activeVideoId(currentSegment.value) : ''),
    isPaused: () => isPaused.value,
    setVoiceOverEnabled,
    setCaptionsEnabled,
  }
})

defineExpose({
  next: handleNext,
  setPrologueMood,
  previous: handlePrevious,
  setVoiceOverEnabled,
  setCaptionsEnabled,
  toggle: handleTogglePlayback,
  seekToRatio,
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="currentSegment && (!sequenceState.done || handoffPending)"
      class="wolves-intro-overlay"
      :class="{ 'wolves-intro-overlay--transparent-handoff': props.transparentHandoff }"
      @click="handleOverlayClick"
    >
      <div
        v-if="playerHostMounted"
        ref="mountHost"
        class="wolves-intro-overlay-player"
        :class="{ 'wolves-intro-overlay-player-hidden': !videoStageVisible }"
        :aria-hidden="videoStageVisible ? undefined : 'true'"
        :inert="!videoStageVisible"
      />
      <template v-if="sceneStageVisible">
        <div class="wolves-intro-overlay-blackscreen">
          <Transition name="wolves-scene-crossfade">
            <div
              :key="activeSceneKey"
              class="wolves-intro-overlay-scene"
              :role="sceneCue?.backgroundFigure ? 'figure' : undefined"
              :aria-label="sceneCue?.backgroundFigure?.label"
              :aria-describedby="activeFigureCreditId"
              :style="{ transitionDuration: `${sceneCrossfadeDuration}s` }"
            >
              <span
                v-if="sceneCue?.backgroundFigure"
                :id="activeFigureCreditId"
                class="wolves-intro-overlay-visually-hidden"
              >{{ sceneCue.backgroundFigure.credit }}</span>
              <img
                v-if="sceneCue?.backgroundImage"
                class="wolves-intro-overlay-background"
                :class="{
                  'wolves-intro-overlay-background-title-card': sceneCue.titlePlate,
                  'wolves-intro-overlay-background-framed': sceneCue.backgroundFraming,
                }"
                :style="sceneCue.backgroundFraming ? {
                  maxWidth: `${sceneCue.backgroundFraming.sourceWidth}px`,
                  maxHeight: `${sceneCue.backgroundFraming.sourceHeight}px`,
                } : undefined"
                :src="`${baseUrl}${sceneCue.backgroundImage}`"
                alt=""
              >
              <template v-else-if="activeCrossfadeStage">
                <img
                  class="wolves-intro-overlay-background wolves-intro-overlay-background-day"
                  :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
                  :src="`${baseUrl}${activeCrossfadeStage.crossfade.day}`"
                  alt=""
                >
                <img
                  class="wolves-intro-overlay-background wolves-intro-overlay-background-night"
                  :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
                  :src="`${baseUrl}${activeCrossfadeStage.crossfade.night}`"
                  alt=""
                >
                <div
                  v-if="sceneCue?.calamity"
                  class="wolves-intro-overlay-calamity-vignette"
                  :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
                />
              </template>
              <!-- Legibility is bought here, over the text region only, rather than by dimming
                   the whole painting: a concept painting is the subject of its shot, and a
                   global dim spends the artwork to pay for the caption. And the scrim exists
                   only while a caption does — on a wordless shot it is haze with nothing to
                   buy, so the condition mirrors the caption's own exactly. -->
              <div
                v-if="sceneCue?.backgroundFraming && overlayText && overlayTextVisible"
                class="wolves-intro-overlay-scrim"
                :class="{ 'wolves-intro-overlay-scrim-top': sceneCue.textPosition === 'top' }"
                :style="framedBoxStyle"
              />
            </div>
          </Transition>
        </div>
        <div v-if="currentSegment.kind === 'text'" ref="audioMountHost" class="wolves-intro-overlay-audio-mount" />
      </template>

      <template v-if="!isSomberTextSegment">
        <div v-if="activeComicTitleCardCue" class="wolves-intro-overlay-title-card">
          <div class="wolves-intro-overlay-title-card-layout">
            <div class="wolves-intro-overlay-title-card-main">
              <p
                v-if="activeComicTitleCardCue.text"
                class="wolves-intro-overlay-title-card-line"
              >
                {{ activeComicTitleCardCue.text }}
              </p>
              <div v-if="activeComicHeroShot" class="wolves-intro-overlay-title-card-art-frame">
                <Transition name="comic-hero-shot-fade">
                  <img
                    :key="activeComicHeroShot.id"
                    :src="`${baseUrl}${activeComicHeroShot.src}`"
                    :alt="activeComicHeroShot.label"
                    :data-comic-hero-shot="activeComicHeroShot.id"
                    :style="comicHeroShotStyle(activeComicHeroShot)"
                    class="wolves-intro-overlay-title-card-art"
                    @load="centerComicHeroShot($event, activeComicHeroShot)"
                  >
                </Transition>
              </div>
            </div>

            <a
              :href="comicHeroQrUrl"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open makemeacomic.com"
              class="wolves-intro-overlay-title-card-qr"
              data-comic-hero-qr-link
            >
              <div class="wolves-intro-overlay-title-card-qr-frame" data-comic-hero-qr-card>
                <img
                  :src="qrMakeMeAComic"
                  alt="QR code linking to makemeacomic.com"
                  class="wolves-intro-overlay-title-card-qr-image"
                  data-comic-hero-qr-image
                >
              </div>
              <span class="wolves-intro-overlay-title-card-qr-dialogue" data-comic-hero-qr-dialogue>
                {{ comicHeroQrDialogue }}
              </span>
              <span class="wolves-intro-overlay-title-card-qr-domain" data-comic-hero-qr-domain>
                {{ comicHeroQrDomain }}
              </span>
            </a>
          </div>
          <blockquote class="wolves-intro-overlay-title-card-amber-quote" data-amber-quote>
            <p>"You don't need permission to contribute to your own destiny."</p>
            <div class="wolves-intro-overlay-title-card-amber-attribution">
              <strong>— Amber Graner</strong>
              <span>Maintainer Guardian // The Iron Standard - Subclass [ REDACTED ]</span>
            </div>
          </blockquote>
        </div>
        <div v-if="activeBurnedInCaptions.length" class="wolves-intro-overlay-burned-captions">
          <div v-for="cue in activeBurnedInCaptions" :key="`${cue.start}-${cue.end}-${cue.text}`" class="wolves-intro-overlay-burned-caption">
            {{ formatIntroCueText(cue.text, cue.preservePunctuation) }}
          </div>
        </div>

        <!-- Quick fade when one centered plate replaces another (e.g. Cortney Nickerson -> Kat
           Cosgrove at 14.5s); the entering plate keeps its authored impact animation.
           Each row anchors the guardian plate plus, for documented dinosaur bonds, the
           companion plate that shows the partnership beside the guardian's name. -->
        <TransitionGroup name="wolves-guardian-plate-swap">
          <div
            v-for="cue in activeGuardianCues"
            :key="cue.text"
            class="wolves-guardian-plate-row"
            :class="{
              'wolves-guardian-plate-left': cue.position === 'left',
              'wolves-guardian-plate-right': cue.position === 'right',
              'wolves-guardian-plate-raised': cue.raised,
            }"
          >
            <div
              class="wolves-guardian-plate font-mono"
              :class="{
                'wolves-guardian-plate-trustee': cue.trustee,
                'wolves-guardian-plate-leader': cue.leader,
              }"
            >
              <template v-if="parseGuardianCue(cue.text)">
                <div class="wolves-guardian-plate-burst" aria-hidden="true" />
                <div class="wolves-guardian-plate-header">
                  <div class="wolves-guardian-plate-horizon wolves-guardian-plate-horizon-left" aria-hidden="true" />
                  <svg class="wolves-guardian-plate-crest" viewBox="0 0 100 100" aria-hidden="true">
                    <polygon points="50,5 85,20 95,55 50,95 5,55 15,20" class="wolves-guardian-plate-crest-outer" />
                    <polygon points="50,12 78,25 87,52 50,85 13,52 22,25" class="wolves-guardian-plate-crest-inner" />
                    <path d="M35,45 L50,60 L65,45" class="wolves-guardian-plate-crest-chevron" />
                  </svg>
                  <div class="wolves-guardian-plate-horizon wolves-guardian-plate-horizon-right" aria-hidden="true" />
                </div>
                <p class="wolves-guardian-plate-label">
                  {{ cue.trustee ? 'TRUSTEE // GUARDIAN' : 'MAINTAINER // GUARDIAN' }}
                </p>
                <p class="wolves-guardian-plate-class">
                  {{ parseGuardianCue(cue.text)!.guardianClass }}
                </p>
                <p class="wolves-guardian-plate-name">
                  {{ parseGuardianCue(cue.text)!.name }}
                </p>
                <p class="wolves-guardian-plate-title">
                  <template v-for="(token, index) in titleTokens(parseGuardianCue(cue.text)!.title, cue.blingTitle)" :key="index">
                    <span v-if="token.kind === 'sep'" class="wolves-guardian-plate-title-sep" aria-hidden="true">|</span>
                    <span v-else-if="token.bling" class="wolves-guardian-plate-bling">{{ token.text }}</span>
                    <template v-else>
                      {{ token.text }}
                    </template>
                  </template>
                </p>
              </template>
              <p v-else class="wolves-guardian-plate-name">
                {{ cue.text }}
              </p>
            </div>
            <div
              v-if="parseGuardianCue(cue.text) && guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)"
              class="wolves-companion-plate font-mono"
            >
              <Transition name="wolves-companion-art-swap" mode="out-in">
                <img
                  :key="guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.speciesId"
                  :src="guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.artwork"
                  alt=""
                  aria-hidden="true"
                  class="wolves-companion-plate-art"
                  :class="`wolves-companion-plate-art--${guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.speciesId}`"
                >
              </Transition>
              <div class="wolves-companion-plate-card">
                <p class="wolves-companion-plate-label">
                  GUARDIAN BOND
                </p>
                <p
                  v-if="guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.name"
                  class="wolves-companion-plate-name"
                >
                  {{ guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.name }}
                </p>
                <p class="wolves-companion-plate-species">
                  {{ guardianDinosaurCompanion(parseGuardianCue(cue.text)!.name)!.scientificName }}
                </p>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </template>

      <template v-else-if="!activeTitlePlateCue">
        <Transition name="wolves-intro-text-hold">
          <p
            v-if="overlayText && overlayTextVisible"
            :key="overlayText"
            class="wolves-intro-overlay-text font-mono"
            :class="{
              'wolves-intro-overlay-text-framed': Boolean(overlayCueForDisplay?.backgroundFraming),
              'wolves-intro-overlay-text-somber': isSomberTextSegment,
              'wolves-intro-overlay-text-director': isDirectorsCutPrologue || handoffHoldCue,
              'wolves-intro-overlay-text-dominant': overlayCueForDisplay?.emphasis === 'dominant',
              'wolves-intro-overlay-text-terminal': overlayCueForDisplay?.presentation === 'terminal',
              'wolves-intro-overlay-text-slim': overlayCueForDisplay?.slim,
              'wolves-intro-overlay-text-top': overlayCueForDisplay?.backgroundCrossfade && overlayCueForDisplay.emphasis !== 'dominant' && !overlayCueForDisplay.calamity && overlayCueForDisplay.textPosition !== 'bottom' && overlayCueForDisplay.textPosition !== 'bottom-right',
              'wolves-intro-overlay-text-bottom-right': overlayCueForDisplay?.textPosition === 'bottom-right',
            }"
            :style="isSomberTextSegment ? { 'animationDuration': `${somberFadeDuration}s`, '--wolves-intro-text-fade': `${somberFadeDuration}s`, ...captionBoxStyle } : captionBoxStyle"
          >
            <template v-if="overlayCueForDisplay?.slim && overlayText.includes('\n')">
              <span class="wolves-intro-overlay-text-slim-line1"><span
                v-for="(part, index) in slimTitleSegments"
                :key="index"
                :class="{ 'wolves-intro-overlay-text-slim-brand': part.brand }"
              >{{ part.text }}</span></span>
              <span class="wolves-intro-overlay-text-slim-line2">{{ formatIntroCueText(overlayText.split('\n')[1], overlayCueForDisplay?.preservePunctuation) }}</span>
            </template>
            <template v-else>
              <span
                v-for="(part, index) in overlayTextParts"
                :key="index"
                :class="{ 'wolves-intro-letter-highlight': part.highlight }"
              >{{ part.char }}</span>
            </template>
          </p>
        </Transition>
      </template>

      <!-- Opening title card lower third. Replicates the Ghosts In The Mist guardian
           nameplate from WolvesComicReader.vue (crest, horizon rules, gradient name) with
           the class and honorific lines dropped, then renders the welcome quote beneath it
           one authored paragraph at a time. Rendered verbatim: this quote states real
           figures and organisation names, so it never goes through the theater punctuation
           strip that the cinematic display cues use. -->
      <div v-if="activeTitlePlateCue" class="wolves-intro-title-card-plate font-mono">
        <div class="wolves-intro-title-card-header" aria-hidden="true">
          <div class="wolves-intro-title-card-horizon wolves-intro-title-card-horizon-left" />
          <svg class="wolves-intro-title-card-crest" viewBox="0 0 100 100">
            <polygon points="50,5 85,20 95,55 50,95 5,55 15,20" class="wolves-intro-title-card-crest-outer" />
            <polygon points="50,12 78,25 87,52 50,85 13,52 22,25" class="wolves-intro-title-card-crest-inner" />
            <path d="M35,45 L50,60 L65,45" class="wolves-intro-title-card-crest-chevron" />
          </svg>
          <div class="wolves-intro-title-card-horizon wolves-intro-title-card-horizon-right" />
        </div>
        <p class="wolves-intro-title-card-name">
          {{ activeTitlePlateCue.titlePlate!.name }}
        </p>
        <p class="wolves-intro-title-card-subtitle">
          {{ activeTitlePlateCue.titlePlate!.subtitle }}
        </p>
        <Transition name="wolves-intro-title-card-quote-fade" mode="out-in">
          <div :key="activeTitlePlateCue.text" class="wolves-intro-title-card-quote">
            <p
              v-for="(paragraph, index) in activeTitlePlateCue.text.split('\n\n')"
              :key="index"
              class="wolves-intro-title-card-quote-body"
            >
              {{ paragraph }}
            </p>
          </div>
        </Transition>
      </div>

    <!-- Transport now lives in the app-level Destiny hero widget; the overlay
         exposes next/previous/toggle/seekToRatio and emits status instead. -->
    </div>
  </Teleport>
</template>

<style scoped>
.wolves-intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  overflow: hidden;
  /* Handoff dissolve duration; must match INTRO_HANDOFF_FADE_MS in WolvesApp.vue. */
  transition: opacity 0.4s ease;
}

.wolves-intro-overlay--transparent-handoff {
  opacity: 0;
}

.wolves-intro-overlay-player {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* A player warmed ahead of its cut. Hidden by opacity, never by `display: none` or
   `visibility: hidden`: an unrendered iframe stops decoding, which throws away exactly the
   warm-up this exists to buy. It keeps its box and its layer, and simply is not seen. */
.wolves-intro-overlay-player-hidden {
  opacity: 0;
  pointer-events: none;
  will-change: opacity;
}

.wolves-intro-overlay-blackscreen {
  position: absolute;
  inset: 0;
  background: #000;
}

/* The wrapper `<Transition>`-ed per scene/stage: gives the whole scene (day+night images and
   any vignette together) a single fade identity, so switching scenes cross-dissolves the old
   scene out while the new one fades in simultaneously, rather than a hard cut between them. */
.wolves-intro-overlay-scene {
  position: absolute;
  inset: 0;
}

/* Exposes the montage credit to assistive tech via aria-describedby without
   painting a visible caption over the artwork. */
.wolves-intro-overlay-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.wolves-scene-crossfade-enter-active,
.wolves-scene-crossfade-leave-active {
  transition-property: opacity;
  transition-timing-function: ease-in-out;
}

.wolves-scene-crossfade-enter-from,
.wolves-scene-crossfade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wolves-scene-crossfade-enter-active,
  .wolves-scene-crossfade-leave-active {
    transition: none;
  }
}

.wolves-intro-overlay-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Full brightness: legibility is bought by the scrim over the text region only, not by a
     global dim that spends the artwork. The one unframed still left in the show — the
     Collapse night plate — is a wordless beat, so there is no caption for a dim to pay for.
     The day/night crossfade beats override this via their own animated opacity below, and
     framed paintings override it entirely. */
  opacity: 1;
}

/* A painting, not a backdrop.

   `cover` crops to the frame, which on this registry means amputating a 2.66:1 panorama top
   and bottom and a 1.37:1 canvas left and right — and then upscaling whatever survived.
   `contain` shows the whole canvas, and the per-record `max-width`/`max-height` (bound
   inline from the asset ledger's measured source geometry) stop the browser enlarging it
   past the pixels the artist actually delivered. The margins letterbox it in the frame.

   Full brightness for the same reason: legibility is bought by the scrim below, over the
   text region only, instead of by spending the artwork. */
.wolves-intro-overlay-background-framed {
  object-fit: contain;
  opacity: 1;
  inset: auto;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* The legibility scrim: a gradient behind the caption band only, so the painting above it
   stays at full brightness while the text below keeps its contrast. */
.wolves-intro-overlay-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to top, rgb(0 0 0 / 78%) 0%, rgb(0 0 0 / 45%) 22%, rgb(0 0 0 / 0%) 46%);
}

/* The scrim buys the caption its contrast, so it has to cover the same band the
   caption occupies. Left on the viewport it would gradient the letterbox bar --
   darkening nothing, and stopping short of the text it exists to back. */
.wolves-intro-overlay-scrim {
  inset: var(--wc-frame-bar-y, 0px) var(--wc-frame-bar-x, 0px);
}

.wolves-intro-overlay-scrim-top {
  background: linear-gradient(to bottom, rgb(0 0 0 / 78%) 0%, rgb(0 0 0 / 45%) 22%, rgb(0 0 0 / 0%) 46%);
}

/* The opening title card's photo is the subject of the slide, not a backdrop for text, so
   it is dimmed far less than the cinematic still beats above. The lower third carries its
   own panel, which keeps the quote legible without darkening the whole frame. */
.wolves-intro-overlay-background-title-card {
  opacity: 0.92;
  /* Portrait keeps `cover` (inherited above) biased to the upper frame, because `contain` in
     a tall viewport shrinks the 3:2 photo to a stamp floating in black. */
  object-position: center 30%;
}

/* Landscape, which is what a projector shows: the photo is 3:2 and the frame is wider, so
   `cover` scaled it to the frame width and cropped the top and bottom away. `contain` shows
   the whole photo, keeping the full gesture in frame for the back of the room. */
@media (min-aspect-ratio: 4 / 3) {
  .wolves-intro-overlay-background-title-card {
    object-fit: contain;
    object-position: center center;
  }
}

/* Opening title card lower third. Palette, crest geometry and gradient name mirror
   `.theater-guardian-*` in WolvesComicReader.vue so the two plates read as the same object;
   only the class and honorific lines are absent here. */
.wolves-intro-title-card-plate {
  position: absolute;
  /* Clears the transport widget's fixed bottom dock (z-index 1000, ~100px tall). The widget
     auto-hides during the intro, but the quote must stay readable while it is on screen. */
  bottom: max(4%, 11.5rem);
  left: 50%;
  transform: translateX(-50%);
  /* Narrow enough that the quote breaks into readable lines. At the old 96rem the body ran
     to roughly 90 characters per line, far past the ~50-75 an audience can track. */
  width: min(92%, 68rem);
  max-height: 58%;
  overflow-y: auto;
  z-index: 12;
  padding: clamp(1.1rem, 0.9rem + 0.8vw, 1.7rem) clamp(1.5rem, 1.2rem + 1.4vw, 2.6rem);
  /* A soft scrim rather than a panel: the photo is the slide, so the plate darkens just
     enough to hold contrast and fades out at its edges instead of drawing a lit box on
     top of the frame. Legibility is carried by the blur and the text shadow. */
  border: 0;
  border-radius: 1.5rem;
  background: radial-gradient(
    120% 140% at 50% 50%,
    rgb(6 9 14 / 82%) 0%,
    rgb(6 9 14 / 74%) 55%,
    rgb(6 9 14 / 30%) 100%
  );
  box-shadow: none;
  backdrop-filter: blur(10px);
  text-align: center;
  color: #f5f5f5;
  text-shadow: 0 2px 8px rgb(0 0 0 / 70%);
}

.wolves-intro-title-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.wolves-intro-title-card-horizon {
  flex: 1 1 auto;
  height: 2px;
  min-width: 2rem;
  background: linear-gradient(to right, transparent, #d1d5db 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(226 232 240 / 55%);
}

.wolves-intro-title-card-horizon-right {
  background: linear-gradient(to left, transparent, #d1d5db 60%, #fff 100%);
}

.wolves-intro-title-card-crest {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  filter: drop-shadow(0 0 6px rgb(226 232 240 / 65%));
}

.wolves-intro-title-card-crest-outer {
  fill: none;
  stroke: #d1d5db;
  stroke-width: 2;
}

.wolves-intro-title-card-crest-inner {
  fill: rgb(8 12 20 / 95%);
  stroke: #f5f5f5;
  stroke-width: 1;
}

.wolves-intro-title-card-crest-chevron {
  fill: none;
  stroke: #d1d5db;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wolves-intro-title-card-name {
  margin: 0.2rem 0 0;
  font-size: clamp(2.2rem, 1.7rem + 1.3vw, 3.2rem);
  font-weight: 700;
  line-height: 1.15;
  color: #f5f5f5;
  background: linear-gradient(to bottom, #fff 0%, #e2e8f0 60%, #a0aec0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgb(255 255 255 / 25%));
}

.wolves-intro-title-card-subtitle {
  margin: 0.35rem 0 1.1rem;
  font-size: clamp(1.3rem, 1.1rem + 0.6vw, 1.7rem);
  color: #94a3b8;
}

/* Sized for readers in theater seats rather than at a desk: this is the slide's message,
   not a caption under a photo, so it runs larger than the Ghosts plate's body copy. */
.wolves-intro-title-card-quote-body {
  /* `balance` splits the paragraph into even lines so no beat ends on a one-word orphan,
     which is the single most distracting thing about projected text. */
  margin: 0 auto 0.6rem;
  max-width: 46ch;
  font-size: clamp(1.5rem, 1.2rem + 0.8vw, 2.1rem);
  line-height: 1.5;
  text-wrap: balance;

  &:last-child {
    margin-bottom: 0;
  }
}

/* Each authored paragraph cross-dissolves into the next rather than cutting, matching the
   unhurried pace of the rest of the intro. */
.wolves-intro-title-card-quote-fade-enter-active,
.wolves-intro-title-card-quote-fade-leave-active {
  transition: opacity 0.5s ease;
}

.wolves-intro-title-card-quote-fade-enter-from,
.wolves-intro-title-card-quote-fade-leave-to {
  opacity: 0;
}

.wolves-intro-overlay-background-day {
  opacity: 1;
  animation-name: wolves-intro-collapse-day-fade;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

.wolves-intro-overlay-background-night {
  opacity: 0;
  mix-blend-mode: screen;
  animation-name: wolves-intro-collapse-night-fade;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

/* The day frame dims out first, confirming the cue starts on the bright day image... */
@keyframes wolves-intro-collapse-day-fade {
  0% {
    opacity: 1;
    filter: brightness(1);
  }
  55% {
    opacity: 0.75;
    filter: brightness(0.85);
  }
  80% {
    opacity: 0.2;
    filter: brightness(0.4);
  }
  100% {
    opacity: 0;
    filter: brightness(0.2);
  }
}

/* ...while the night frame rises in underneath it, so the cue ends fully on the dark image. */
@keyframes wolves-intro-collapse-night-fade {
  0%,
  30% {
    opacity: 0;
  }
  55% {
    opacity: 0.25;
  }
  80% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* A slow-building darkness pulse layered over the crossfade, dramatizing the calamity rather
   than a plain linear dissolve between the two frames. */
.wolves-intro-overlay-calamity-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 0%, rgb(0 0 0 / 85%) 100%);
  opacity: 0;
  animation-name: wolves-intro-calamity-vignette;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

@keyframes wolves-intro-calamity-vignette {
  0%,
  45% {
    opacity: 0;
  }
  70% {
    opacity: 0.55;
  }
  100% {
    opacity: 0.85;
  }
}

.wolves-intro-overlay-audio-mount {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.wolves-intro-overlay-burned-captions {
  position: absolute;
  inset: 13rem 0 auto; /* top band: clear of the bottom guardian plates and the hero widget */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 6vw;
  pointer-events: none;
  z-index: 7;
}
.wolves-intro-overlay-burned-caption {
  max-width: 72rem;
  padding: 1rem 2.2rem;
  background: rgb(8 9 12 / 78%);
  /* Standard dialogue rides the plate blue; blue stays reserved for power moments. */
  border: 1px solid rgb(147 197 253 / 30%);
  border-left: 2px solid #93c5fd;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 0.9rem), calc(100% - 0.9rem) 100%, 0 100%);
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(1.9rem, 2.2vw, 2.6rem);
  line-height: 1.45;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #e9e9e5;
  text-align: center;
}

.wolves-intro-overlay-title-card {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Top/bottom padding reserves the pinned text bands (title above, pill
     below) so the centered art region can never reach them. */
  padding: clamp(17rem, 26vh, 21rem) clamp(1.6rem, 4vw, 4rem) 19rem;
  background: #000;
  color: #fff;
  text-align: center;
  z-index: 6;
}

.wolves-intro-overlay-title-card-layout {
  display: flex;
  align-items: center;
  gap: clamp(2rem, 4vw, 5rem);
  width: fit-content;
  max-width: 100%;
  transform: translate(-6.25vw, -5rem);
}

.wolves-intro-overlay-title-card-main {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.wolves-intro-overlay-title-card-art-frame {
  /* This square viewport measures each source image by its visible alpha-content
     bounds, not its transparent canvas. The title and pill remain pinned outside
     the frame, so the hero art cannot move either text band. */
  position: relative;
  width: min(58vw, 50vh, 52rem);
  aspect-ratio: 1;
}

.comic-hero-shot-fade-enter-active,
.comic-hero-shot-fade-leave-active {
  transition: opacity 0.35s ease;
}

.comic-hero-shot-fade-enter-from,
.comic-hero-shot-fade-leave-to {
  opacity: 0;
}

.wolves-intro-overlay-title-card-art {
  position: absolute;
  max-width: none;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 24px rgb(0 0 0 / 70%));
}

.wolves-intro-overlay-title-card-line {
  margin: 0;
  max-width: min(90vw, 960px);
  font-family: 'Eurostile', 'Uni Sans', 'Arial Narrow', 'Segoe UI', sans-serif;
  font-size: clamp(2.6rem, 4vw, 4.2rem);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #dbeafe;
  text-shadow:
    -3px -3px 0 #000,
    3px -3px 0 #000,
    -3px 3px 0 #000,
    3px 3px 0 #000,
    0 0 24px rgb(0 0 0 / 90%);
  -webkit-text-stroke: 2.8px #000;
}

.wolves-intro-overlay-title-card-line:not(.wolves-intro-overlay-title-card-line-small) {
  /* Pinned above the art so the cycling image can never move the title. */
  position: absolute;
  top: clamp(11rem, 17vh, 14rem);
  left: clamp(1.6rem, 4vw, 4rem);
  width: min(72vw, 80rem);
  text-align: left;
}

.wolves-intro-overlay-title-card-line-small {
  /* Pinned to the screen above the fixed footer widget dock, out of the
     art's layout flow. */
  position: absolute;
  bottom: clamp(12rem, 14vh, 15rem);
  left: 50%;
  transform: translateX(-50%);
  display: inline-block;
  padding: 0.25em 0.6em;
  border: 1px solid rgb(255 244 200 / 45%);
  border-radius: 999px;
  background: rgb(0 0 0 / 45%);
  font-size: clamp(1.2rem, 1.8vw, 1.8rem);
  letter-spacing: 0.15em;
  font-weight: 900;
  line-height: 1.1;
  text-shadow: none;
  white-space: nowrap;
  -webkit-text-stroke: 0;
}

.wolves-intro-overlay-title-card-amber-quote {
  position: absolute;
  bottom: clamp(12.5rem, 14vh, 13rem);
  left: 50%;
  width: min(90vw, 90rem);
  margin: 0;
  padding: 0;
  color: #fff;
  text-align: center;
  text-shadow:
    0 3px 12px rgb(0 0 0 / 95%),
    0 0 24px rgb(0 0 0 / 75%);
  transform: translateX(-50%);
}

.wolves-intro-overlay-title-card-amber-quote p {
  margin: 0;
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(2rem, 3.4vw, 4rem);
  line-height: 1.15;
  letter-spacing: 0.03em;
  color: #f8fafc;
  text-align: center;
}

.wolves-intro-overlay-title-card-amber-attribution {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 0.35rem;
  margin-top: 1rem;
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  text-align: center;
}

.wolves-intro-overlay-title-card-amber-quote strong {
  color: #93c5fd;
  font-size: clamp(1.15rem, 1.4vw, 1.6rem);
}

.wolves-intro-overlay-title-card-amber-quote span {
  color: #cbd5e1;
  font-size: clamp(1rem, 1.2vw, 1.3rem);
  line-height: 1.35;
}

.wolves-intro-overlay-title-card-qr {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  justify-self: end;
  width: min(100%, 38rem);
  padding: 1.2rem;
  border: 1px solid rgb(147 197 253 / 32%);
  border-radius: 2rem;
  background: linear-gradient(180deg, rgb(9 11 16 / 92%) 0%, rgb(5 7 10 / 96%) 100%);
  color: #fff;
  text-decoration: none;
}

.wolves-intro-overlay-title-card-qr-frame {
  width: min(100%, 32rem);
  aspect-ratio: 1;
  padding: 0.65rem;
  border-radius: 1.35rem;
  border: 1px solid rgb(147 197 253 / 45%);
  background: #020617;
  box-shadow: inset 0 0 24px rgb(59 130 246 / 14%);
}

.wolves-intro-overlay-title-card-qr-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.75rem;
  filter: invert(1);
}

.wolves-intro-overlay-title-card-qr-dialogue,
.wolves-intro-overlay-title-card-qr-domain {
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  color: #93c5fd;
}

@media (max-width: 700px) {
  .wolves-intro-overlay-title-card {
    padding: 21rem 1.2rem 24rem;
  }

  .wolves-intro-overlay-title-card-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
    justify-items: center;
    gap: 0.8rem;
    transform: none;
    width: 100%;
  }

  .wolves-intro-overlay-title-card-main {
    display: contents;
  }

  .wolves-intro-overlay-title-card-line:not(.wolves-intro-overlay-title-card-line-small) {
    /* Below the taller two-line mobile nameplate. */
    top: 17rem;
    left: 1.2rem;
    width: 86vw;
  }

  .wolves-intro-overlay-title-card-art-frame {
    grid-column: 1;
    grid-row: 1;
    width: min(52vw, 34vh, 26rem);
  }

  .wolves-intro-overlay-title-card-line-small {
    /* Above the taller mobile footer widget dock. */
    bottom: 19rem;
    z-index: 1;
    color: #dbeafe;
    width: max-content;
    max-width: 94vw;
    padding: 0.4em 0.5em;
    font-size: 1rem;
    letter-spacing: 0.08em;
    text-shadow: none;
    white-space: normal;
    -webkit-text-stroke: 0;
  }

  .wolves-intro-overlay-title-card-amber-quote {
    bottom: 19rem;
    left: 50%;
    width: min(92vw, 36rem);
  }

  .wolves-intro-overlay-title-card-amber-quote p {
    font-size: clamp(1.6rem, 5.2vw, 2.4rem);
  }

  .wolves-intro-overlay-title-card-qr {
    width: min(100%, 22rem);
    padding: 0.8rem;
  }

  .wolves-intro-overlay-title-card-qr-frame {
    width: min(100%, 20rem);
    padding: 0.5rem;
  }

  /* Narrow screens: tighten the guardian + companion pair so both cards fit
     side by side without overflowing the frame. */
  .wolves-guardian-plate-row {
    gap: 0.8rem;
    max-width: 92%;
  }

  .wolves-guardian-plate {
    min-width: 0;
    flex: 1 1 auto;
    padding: 1.4rem 1rem 1.2rem;
  }

  .wolves-companion-plate {
    width: 11rem;
  }

  .wolves-companion-plate-art {
    margin-bottom: -2.2rem;
  }

  .wolves-companion-plate-card {
    padding: 2.8rem 1rem 1rem;
  }
}

.wolves-intro-overlay-text {
  position: absolute;
  left: 5%;
  bottom: 12%;
  right: 5%;
  margin: 0;
  color: #e9e9e5;
  /* Weyland-era display type (Michroma = Microgramma/Eurostile Extended stand-in). */
  font-family: var(--wc-font-weyland, 'Michroma', 'Arial Narrow', sans-serif);
  /* Michroma renders much wider than the old stack; this keeps the same optical
     size while letting authored lines fit without double-wrapping. */
  font-size: clamp(2.4rem, 4.6vw, 4.4rem);
  line-height: 1.2;
  font-weight: 400; /* Michroma ships one weight; synthetic bold ruins it */
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-shadow: 0 2px 18px rgb(0 0 0 / 85%);
  /* Some prologue cues author an explicit line break in their `text` (a JS/TS template
     literal newline) to control where a long line wraps -- preserve it instead of collapsing
     to a single line, per explicit user request (2026-07-15). */
  white-space: pre-line;
}

.wolves-intro-overlay-text-terminal {
  top: 12%;
  bottom: auto;
  left: 7%;
  right: 7%;
  width: min(86%, 96rem);
  padding: clamp(1.6rem, 3vw, 2.8rem);
  border: 1px solid rgb(127 212 212 / 30%);
  border-left: 2px solid #7fd4d4;
  background: rgb(3 10 14 / 88%);
  box-shadow: inset 0 0 28px rgb(59 130 246 / 8%);
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(1.5rem, 2vw, 2.2rem);
  line-height: 1.55;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: none;
  color: #7fd4d4;
  text-shadow: none;
  animation: none;
  opacity: 1;
}

/* The Bluefin wallpaper scenes (backgroundCrossfade cues) are sky-led landscapes with the
   most legible open space along the top of the frame, unlike the KubeCon crowd shot or plain
   black cards -- so their caption moves up out of the busier lower portion of the artwork. */
.wolves-intro-overlay-text-top {
  top: 10%;
  bottom: auto;
}

.wolves-intro-overlay-text-bottom-right {
  left: auto;
  width: min(94%, 136rem);
  /* Scaled with the Michroma base so authored lines fit without double-wrapping. */
  font-size: clamp(2.4rem, 4.2vw, 4.2rem);
  line-height: 1.25;
  text-align: right;
}

/* A slow, subtle, somber fade-in for the Prologue/Epilogue's black-screen text cards, paced to
   the Gayane Ballet Suite (Adagio)'s own tempo (see PROLOGUE_TEXT_FADE_SECONDS). Kept to a bare
   opacity change (no letter-spacing/translate motion) so it reads as gentle rather than showy,
   and respects prefers-reduced-motion below. The trailer's Guardian overlay cards do not use
   this class and simply appear immediately. */
.wolves-intro-overlay-text-somber {
  opacity: 0;
  animation-name: wolves-intro-text-somber-fade;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}

.wolves-intro-overlay-text-terminal.wolves-intro-overlay-text-somber {
  animation: none;
  opacity: 1;
}

@keyframes wolves-intro-text-somber-fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* A thought leaving on its reading hold fades out at the same tempo it arrived on, so a
   cleared line reads as a decision rather than as a dropped frame. */
.wolves-intro-text-hold-leave-active {
  transition: opacity var(--wolves-intro-text-fade, 1.6s) ease-in-out;
  animation: none;
}

.wolves-intro-text-hold-leave-to {
  opacity: 0;
}

/* The Director's Cut prologue's own crescendo treatment (4:36, "Now, what's left...").
   Scoped so the shared `dominant` rule, and the Clarke quote it was written for, do not
   move. It sits above the narrow-viewport block on purpose: that block carries a rule of
   exactly this specificity, and CSS breaks the tie on source order, so putting this after
   it would silently undo the phone treatment.

   Two things this fixes. The shared rule tops out at `8rem`, which at 1280 is 81px in a
   1075px box — wider than every authored line in this narration, so the browser re-wrapped
   the lining mid-phrase and `dominant` had to be abandoned here. And its `font-weight: 700`
   is synthetic bold on Michroma, which ships one weight; the base caption rule already says
   so.

   Sizing in `vw` rather than `rem` is the point. Every other caption is capped at `4.4rem`,
   so on the 1920-wide projector this show is performed on they all still render ~45px
   however large the screen gets. This one tracks the frame — ~51px at 1280, ~77px at 1920 —
   so the biggest musical event in the piece is also the biggest type in the show, and the
   fit is proportional to the box instead of being true only at the one width it was
   measured at. Verified in Chromium with Michroma loaded: four rendered line boxes against
   four authored, at both 1280x720 and 1920x1080. */
.wolves-intro-overlay-text-director.wolves-intro-overlay-text-dominant {
  left: 3%;
  right: 3%;
  font-size: clamp(2.6rem, 4vw, 7.5rem);
  font-weight: 400;
  line-height: 1.25;
}

/* Words live inside the picture, never on the letterbox.

   `.wolves-intro-overlay-text` anchors to the viewport, which is right while the
   image is a full-bleed backdrop and wrong the moment it is a framed painting: a
   `contain` fit leaves bars whose size is decided by the source's aspect ratio,
   and the caption happily rendered on top of them. Measured in Chromium at
   1920x1080, the 1920x1369 record paints 1514px wide and leaves a 203px bar down
   each side, while the caption ran 96px to 1824px -- over the bar on both sides.

   `--wc-frame-bar-x/y` is that bar, computed from the ledger geometry in
   `framedLetterbox` and published per cue, so the caption tracks the picture on
   every record and at every size rather than being tuned per painting. The extra
   3% is title-safe margin: type stopping exactly on the picture edge reads as an
   accident from the back row.

   Placed here, after the base and dominant rules, and written at two-class
   specificity on purpose. The first attempt sat earlier in the sheet at one
   class, tied with `.wolves-intro-overlay-text`, and lost on source order -- it
   passed every unit test and still painted the words on the bar, which is
   exactly the class of defect only a laid-out browser catches.

   `max()` rather than plain addition, because a 16:9 record has no bar at all
   and must keep the placement it already had. */
.wolves-intro-overlay-text.wolves-intro-overlay-text-framed {
  bottom: max(12%, calc(var(--wc-frame-bar-y, 0px) + 3%));
  left: max(5%, calc(var(--wc-frame-bar-x, 0px) + 3%));
  right: max(5%, calc(var(--wc-frame-bar-x, 0px) + 3%));
}

.wolves-intro-overlay-text-director.wolves-intro-overlay-text-dominant.wolves-intro-overlay-text-framed {
  left: max(3%, calc(var(--wc-frame-bar-x, 0px) + 3%));
  right: max(3%, calc(var(--wc-frame-bar-x, 0px) + 3%));
}

@media (max-width: 640px) {
  .wolves-guardian-plate-row {
    bottom: max(18%, 12rem);
  }

  .wolves-companion-plate {
    bottom: max(18%, 12rem);
  }

  /* Mobile keeps the footage and the app-level playback widget only. */
  .wolves-intro-overlay-burned-captions,
  .wolves-intro-overlay-title-card,
  .wolves-guardian-plate-row,
  .wolves-intro-overlay-text:not(.wolves-intro-overlay-text-director) {
    display: none !important;
  }

  /* The Director's Cut is the exception: it is a scored prologue whose narration *is* the
     content, so blanking its captions leaves a phone or a narrow projector window showing
     paintings with the story removed. It keeps its words and rescales them to the frame
     instead, which is what the rule was reaching for in the first place. */
  .wolves-intro-overlay-text-director {
    left: 4%;
    right: 4%;
    width: auto;
    bottom: 9%;
    font-size: clamp(1.15rem, 5.4vw, 1.9rem);
    line-height: 1.35;
  }

  .wolves-intro-overlay-text-director.wolves-intro-overlay-text-dominant {
    /* Restated, not inherited: the prologue's crescendo rule above sets 3% and
       outranks the `.wolves-intro-overlay-text-director` 4% this block relies on,
       so without this the phone silently picked up the projector's margins. */
    left: 4%;
    right: 4%;
    font-size: clamp(1.5rem, 7vw, 2.5rem);
    line-height: 1.2;
  }

  .wolves-intro-overlay-text-director.wolves-intro-overlay-text-bottom-right {
    font-size: clamp(1.3rem, 6vw, 2.1rem);
  }

  .wolves-intro-overlay-text-director.wolves-intro-overlay-text-slim .wolves-intro-overlay-text-slim-line1 {
    font-size: clamp(1.6rem, 7.4vw, 2.6rem);
  }

  .wolves-intro-overlay-text-director.wolves-intro-overlay-text-slim .wolves-intro-overlay-text-slim-line2 {
    font-size: clamp(1rem, 4.4vw, 1.6rem);
  }
}

/* The one coloured glyph in the show's own name.

   Requested directly by the owner: the `F` of BLUEFIN in the brand blue. It
   inherits every other property from the title line, so it keeps the same
   baseline, weight and tracking — only the colour changes, which is what makes
   it read as a logo rather than as a highlighted letter.

   It sits at top level, after the line it colours. The first attempt was
   inserted into the `max-width: 640px` block by a careless anchor match, where
   it did nothing at projector sizes and quietly corrupted the selector above
   it. */
.wolves-intro-overlay-text-slim-brand {
  color: var(--color-blue, #2f6fed);
}

@media (prefers-reduced-motion: reduce) {
  .wolves-intro-overlay-text-somber {
    animation: none;
    opacity: 1;
  }

  .wolves-intro-overlay-background-day {
    animation: none;
    opacity: 0;
    filter: brightness(0.2);
  }

  .wolves-intro-overlay-background-night {
    animation: none;
    opacity: 1;
  }

  .wolves-intro-overlay-calamity-vignette {
    animation: none;
    opacity: 0.85;
  }
}

.wolves-intro-letter-highlight {
  color: var(--color-blue);
  font-weight: 900;
}

/* The Arthur C. Clarke quote is the emotional hinge of the Prologue (the line that explains
   why the Wolves' extinction stakes matter) and should visually dominate rather than read as
   just another caption: centered, much larger, bolder, and spanning most of the screen. */
.wolves-intro-overlay-text-dominant {
  left: 8%;
  right: 8%;
  bottom: auto;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-weight: 700;
  font-size: clamp(4rem, 8vw, 8rem);
  line-height: 1.2;
  letter-spacing: 0.015em;
  text-shadow: 0 4px 24px rgb(0 0 0 / 90%);
}

.wolves-intro-overlay-text-slim {
  font-weight: 500;
  letter-spacing: 0.03em;
  text-align: center;
}

.wolves-intro-overlay-text-slim-line1 {
  display: block;
  font-size: clamp(3.2rem, 5.8vw, 5.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  margin-bottom: 0.6rem;
  color: #fff;
  text-align: center;
}

.wolves-intro-overlay-text-slim-line2 {
  display: block;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #cbd5e1;
  text-transform: uppercase;
  text-align: center;
}

/* Positioned anchor for a guardian plate plus its optional dinosaur companion
   plate. Default pairing: the companion sits in the row's bottom-right corner,
   bottoms horizontally aligned with the name plate. */
.wolves-guardian-plate-row {
  position: absolute;
  bottom: 10%;
  left: 5%;
  display: flex;
  align-items: flex-end;
  gap: 1.8rem;
  pointer-events: none;
}

/* Guardian trailer callout, redesigned as a Destiny 2 "Guardian Rank Up" style HUD burst:
   a chamfered plate with a radial ignition flash, a crest badge flanked by horizon accent
   lines, and a slow letter-spacing text drift -- built from research into Bungie's diegetic
   HUD notification style (geometry, glow/bloom, and animation choreography). Replaces the
   earlier plain "nerd plate" card. */
.wolves-guardian-plate {
  position: relative;
  max-width: 44rem;
  padding: 1.75rem 2rem 1.5rem;
  overflow: visible;
  border: 1px solid rgb(147 197 253 / 45%);
  border-radius: 0.75rem;
  clip-path: polygon(16px 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0% 100%, 0% 16px);
  background: rgb(8 12 20 / 82%);
  color: #e2e8f0;
  text-align: center;
  text-shadow: 0 2px 10px rgb(0 0 0 / 80%);
  animation: wolves-guardian-plate-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Quick fade-out when one plate is replaced by the next (Cortney Nickerson -> Kat Cosgrove). */
.wolves-guardian-plate-swap-leave-active {
  transition: opacity 0.25s ease-out;
}

.wolves-guardian-plate-swap-leave-to {
  opacity: 0;
}

/* Anchors this callout row to the left/right side of the frame instead of the default
   lower-left placement, reserved for cues whose window overlaps another Guardian's (they
   share the shot, so both plates need to sit side-by-side rather than stacking). */
.wolves-guardian-plate-left {
  left: 5%;
  right: auto;
}

.wolves-guardian-plate-right {
  left: auto;
  right: 5%;
}

/* Raises the callout row from the default lower-third anchor to sit closer to a Guardian's
   actual on-screen position when it towers above the frame's lower third (see the `raised`
   field doc comment in wolves-intro-sequence.ts). */
.wolves-guardian-plate-raised {
  bottom: auto;
  top: 28%;
}

/* Dinosaur companion plate: the guardian's documented bonded dinosaur split out
   into its own card in the row's bottom-right corner, bottoms aligned with the
   name plate. The artwork is the hero -- it rides above the card and breaks
   out of the chamfered box for dramatic effect (the card carries the
   clip-path, not the shared wrapper, so the art can overflow freely). */
.wolves-companion-plate {
  position: fixed;
  right: 5%;
  bottom: 10%;
  flex-shrink: 0;
  width: clamp(17rem, 14rem + 5vw, 24rem);
  text-align: center;
  animation: wolves-guardian-plate-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s backwards;
}

.wolves-companion-plate-art {
  position: relative;
  z-index: 1;
  display: block;
  width: 108%;
  max-width: none;
  margin: 0 -4% -3.4rem;
  /* Keep dinosaur artwork opaque while the cue clock polls; replaying the entry animation made it blink. */
  animation: none;
}

.wolves-companion-art-swap-enter-active,
.wolves-companion-art-swap-leave-active {
  transition: opacity 0.22s ease;
}

.wolves-companion-art-swap-enter-from,
.wolves-companion-art-swap-leave-to {
  opacity: 0;
}

/* Size each visible silhouette, not each source canvas. These corrections keep the
   bonded animals visually intentional despite their different transparent margins. */
.wolves-companion-plate-art--bob-torosaurus {
  width: 108%;
  margin-inline: -4%;
}

.wolves-companion-plate-art--karl {
  width: 118%;
  margin-inline: -9%;
}

.wolves-companion-plate-art--kentrosaurus {
  width: 104%;
  margin-inline: -2%;
}

.wolves-companion-plate-art--alamosaurus {
  width: 124.2%;
  margin: 0 -12.1% -3.9rem;
}

.wolves-companion-plate-card {
  position: relative;
  padding: 4.2rem 1.6rem 1.4rem;
  border: 1px solid rgb(147 197 253 / 45%);
  border-radius: 0.75rem;
  clip-path: polygon(16px 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0% 100%, 0% 16px);
  background: rgb(8 12 20 / 82%);
  color: #e2e8f0;
  text-shadow: 0 2px 10px rgb(0 0 0 / 80%);
}

.wolves-companion-plate-label {
  margin: 0;
  font-size: clamp(1.2rem, 1rem + 0.5vw, 1.5rem);
  letter-spacing: 0.35em;
  color: #93c5fd;
}

.wolves-companion-plate-name {
  margin: 0.3rem 0 0;
  font-size: clamp(2rem, 1.6rem + 1vw, 2.8rem);
  font-weight: 700;
  color: #f5f5f5;
  background: linear-gradient(to bottom, #fff 0%, #e2e8f0 60%, #a0aec0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.wolves-companion-plate-species {
  margin: 0.35rem 0 0;
  font-size: clamp(1.3rem, 1.1rem + 0.5vw, 1.6rem);
  font-style: italic;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

/* Gold treatment for the complete plate to signify leadership. Reserved for
   Christoph Blecker's "First Among Equals" cue; it takes precedence over trustee chrome. */
.wolves-guardian-plate.wolves-guardian-plate-leader {
  border-color: rgb(250 204 21 / 55%);
  box-shadow: 0 0 24px rgb(250 204 21 / 20%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-burst {
  background: radial-gradient(circle, #fff 0%, #facc15 45%, transparent 70%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-horizon {
  background: linear-gradient(to right, transparent, #facc15 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(250 204 21 / 55%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-horizon-right {
  background: linear-gradient(to left, transparent, #facc15 60%, #fff 100%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-crest {
  filter: drop-shadow(0 0 8px rgb(250 204 21 / 70%));
}

.wolves-guardian-plate-leader .wolves-guardian-plate-crest-outer,
.wolves-guardian-plate-leader .wolves-guardian-plate-crest-chevron {
  stroke: #facc15;
}

.wolves-guardian-plate-leader .wolves-guardian-plate-label {
  color: #facc15;
}

.wolves-guardian-plate-leader .wolves-guardian-plate-title {
  color: #fde68a;
  font-weight: 600;
}

/* Burnished silver treatment for Universal Blue trustees (Cortney Nickerson's cue; Jorge
   Castro's Ghosts In The Mist plate mirrors it in WolvesComicReader.vue). Distinct
   from the default blue plate. */
.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) {
  border-color: rgb(203 213 225 / 55%);
  box-shadow: 0 0 24px rgb(226 232 240 / 20%);
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-burst {
  background: radial-gradient(circle, #fff 0%, #d1d5db 45%, transparent 70%);
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-horizon {
  background: linear-gradient(to right, transparent, #d1d5db 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(226 232 240 / 55%);
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-horizon-right {
  background: linear-gradient(to left, transparent, #d1d5db 60%, #fff 100%);
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-crest {
  filter: drop-shadow(0 0 8px rgb(226 232 240 / 70%));
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-crest-outer,
.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-crest-chevron {
  stroke: #d1d5db;
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-label {
  color: #e5e7eb;
}

.wolves-guardian-plate-trustee:not(.wolves-guardian-plate-leader) .wolves-guardian-plate-title {
  color: #cbd5e1;
}

/* Radial ignition flash behind the crest at the moment the plate appears. */
.wolves-guardian-plate-burst {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #93c5fd 45%, transparent 70%);
  transform: translate(-50%, -50%) scale(0.1);
  animation: wolves-guardian-plate-ignite 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}

.wolves-guardian-plate-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.wolves-guardian-plate-horizon {
  flex: 1 1 auto;
  height: 2px;
  min-width: 2rem;
  background: linear-gradient(to right, transparent, #93c5fd 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(147 197 253 / 55%);
  transform: scaleX(0);
}

.wolves-guardian-plate-horizon-left {
  transform-origin: right center;
  animation: wolves-guardian-plate-line-sweep 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
}

.wolves-guardian-plate-horizon-right {
  transform-origin: left center;
  background: linear-gradient(to left, transparent, #93c5fd 60%, #fff 100%);
  animation: wolves-guardian-plate-line-sweep 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
}

.wolves-guardian-plate-crest {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  opacity: 0;
  animation: wolves-guardian-plate-crest-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.15) 0.05s forwards;
}

.wolves-guardian-plate-crest-outer {
  fill: none;
  stroke: #93c5fd;
  stroke-width: 2;
}

.wolves-guardian-plate-crest-inner {
  fill: rgb(8 12 20 / 95%);
  stroke: #f5f5f5;
  stroke-width: 1;
}

.wolves-guardian-plate-crest-chevron {
  fill: none;
  stroke: #93c5fd;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wolves-guardian-plate-label {
  margin: 0;
  font-size: clamp(1.4rem, 1.1rem + 0.6vw, 1.8rem);
  letter-spacing: 0.35em;
  color: #93c5fd;
}

.wolves-guardian-plate-class {
  margin: 0.35rem 0 0;
  font-size: clamp(1.6rem, 1.2rem + 0.9vw, 2.1rem);
  letter-spacing: 0.05em;
  color: #bfdbfe;
  text-transform: uppercase;
}

.wolves-guardian-plate-name {
  margin: 0.2rem 0 0;
  font-size: clamp(2.6rem, 1.9rem + 1.6vw, 3.6rem);
  font-weight: 700;
  color: #f5f5f5;
  background: linear-gradient(to bottom, #fff 0%, #e2e8f0 60%, #a0aec0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: wolves-guardian-plate-text-drift 1.4s cubic-bezier(0.1, 0.9, 0.2, 1) 0.15s backwards;
}

.wolves-guardian-plate-title {
  margin: 0.35rem 0 0;
  font-size: clamp(1.5rem, 1.2rem + 0.7vw, 1.9rem);
  color: #94a3b8;
}

/* Blue vertical rule dividing a multi-segment title (e.g. Christoph Blecker's four titles, or
   Natali Vlatko's two), replacing the authored ` — ` em-dash join with a UI separator instead of
   punctuation, per explicit user request. Uses the same blue accent as the rest of the plate
   chrome (crest, horizon lines, class label) so it reads as structure, not text. */
.wolves-guardian-plate-title-sep {
  display: inline-block;
  margin: 0 0.4em;
  color: #93c5fd;
  font-weight: 400;
  opacity: 0.85;
}

/* Distinctive blue "bling" treatment for a single called-out title segment (e.g. Christoph
   Blecker's "Platinum Member"), separate from the plain title text around it. A shimmer sweeps
   across the blue gradient text on a loop, with a soft pulsing glow, so it reads as a
   deliberately flashy inline award rather than a plain title word. */
.wolves-guardian-plate-bling {
  position: relative;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: linear-gradient(100deg, #1d4ed8 20%, #dbeafe 40%, #60a5fa 50%, #dbeafe 60%, #1d4ed8 80%);
  background-size: 250% 100%;
  background-position: 0% 0%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 6px rgb(96 165 250 / 55%));
  animation:
    wolves-guardian-plate-bling-shimmer 2.6s linear infinite,
    wolves-guardian-plate-bling-pulse 1.8s ease-in-out infinite;
}

@keyframes wolves-guardian-plate-ignite {
  0% {
    transform: translate(-50%, -50%) scale(0.1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

@keyframes wolves-guardian-plate-line-sweep {
  0% {
    transform: scaleX(0);
  }
  100% {
    transform: scaleX(1);
  }
}

@keyframes wolves-guardian-plate-crest-drop {
  0% {
    opacity: 0;
    transform: scale(2.2) rotate(12deg);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes wolves-guardian-plate-text-drift {
  0% {
    opacity: 0;
    letter-spacing: -0.05em;
    transform: translateY(0.2rem);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    letter-spacing: normal;
    transform: none;
  }
}

@keyframes wolves-guardian-plate-bling-shimmer {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: -250% 0%;
  }
}

@keyframes wolves-guardian-plate-bling-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgb(56 189 248 / 45%));
  }
  50% {
    filter: drop-shadow(0 0 10px rgb(56 189 248 / 85%));
  }
}

@keyframes wolves-guardian-plate-enter {
  0% {
    opacity: 0;
    transform: translateY(0.4rem) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
</style>
