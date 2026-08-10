<script setup lang="ts">
/**
 * The Director's Cut finale.
 *
 * A focused subscriber to the soundtrack player's published time. It owns no
 * clock of its own: every beat below is a pure function of `store.nativeTime`
 * evaluated against the measured anchors in `wolves-directors-cut-finale.ts`,
 * which is what makes seeking backward out of the finale restore the show
 * without any state to unwind.
 *
 * It performs four things over its window:
 *
 * 1. covers the ordinary Track 0 slide schedule for good, with the Collapse
 *    plate turning from day to night across the barrage;
 * 2. carries the missing-scientist bulletin — already running in the lore
 *    column when the finale opens — on its own authored window, as a minor
 *    beat beside the main frame, and clears it on the Become Legend cue;
 * 3. drives the second authored Track 0 companion video (`PjryN2F6fF0`) in the
 *    corner, muted, cued and parked long before the audience sees it, revealed
 *    exactly as the source's measured asteroid-impact frame lands, and parked
 *    again after it;
 * 4. shows the two verified Sagan clauses, one at a time, and takes the frame
 *    to black.
 *
 * The companion player is created through the shared YouTube IFrame API loader
 * — there is no second loader and no second advancing clock; the companion is
 * seek-corrected against the soundtrack clock and never consulted for time.
 */
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WolvesLoreColumn from '@/components/wolves/WolvesLoreColumn.vue'
import {
  getChromeFreeYoutubePlayerVars,
  getYoutubePlayerConstructor,
  loadYoutubeIframeApi,
} from '@/composables/useYoutubeIframeApi'
import {
  COMPANION_SOURCE_PARK_SECONDS,
  companionSourceTimeAt,
  DIRECTORS_CUT_COLLAPSE_DAY_IMAGE,
  DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE,
  DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S,
  DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S,
  DIRECTORS_CUT_COMPANION_VIDEO_ID,
  DIRECTORS_CUT_EXTINCTION_CLAUSE,
  DIRECTORS_CUT_FINALE_ANCHORS,
  DIRECTORS_CUT_SAGAN_SOURCE,
  DIRECTORS_CUT_SURVIVAL_CLAUSE,
  DIRECTORS_CUT_TERMINAL_FADE_SECONDS,
  directorsCutBulletinVisible,
  directorsCutCollapseNightOpacity,
  directorsCutCompanionPlaying,
  directorsCutCompanionVisible,
  directorsCutExtinctionFading,
  directorsCutExtinctionVisible,
  directorsCutSurvivalVisible,
  directorsCutTerminalFadeEngaged,
} from '@/data/wolves-directors-cut-finale'
import { DIRECTORS_CUT_BULLETIN_ARTIFACT_ID } from '@/data/wolves-directors-cut-timeline'
import { useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()
const base = import.meta.env.BASE_URL

const time = computed(() => store.nativeTime)
const covering = computed(() => store.directorFinaleActive)

const collapseDayUrl = `url('${base}${DIRECTORS_CUT_COLLAPSE_DAY_IMAGE}')`
const collapseNightUrl = `url('${base}${DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE}')`
const collapseNightOpacity = computed(() => directorsCutCollapseNightOpacity(time.value))

const bulletinVisible = computed(() => covering.value && directorsCutBulletinVisible(time.value))
const bulletinDuration = DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd - DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart
const bulletinElapsed = computed(() => Math.min(
  bulletinDuration,
  Math.max(0, time.value - DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart),
))

const extinctionVisible = computed(() => covering.value && directorsCutExtinctionVisible(time.value))
const extinctionFading = computed(() => directorsCutExtinctionFading(time.value))
const survivalVisible = computed(() => covering.value && directorsCutSurvivalVisible(time.value))

// The terminal fade is a latched CSS transition, not a per-tick opacity: the
// YouTube clock routinely plateaus near the end of an upload, and an opacity
// computed from `(time - start) / span` would freeze the show on a grey frame.
// Once this flips the compositor finishes the fade on its own.
const terminalFading = computed(() => covering.value && directorsCutTerminalFadeEngaged(time.value))
const terminalBlack = computed(() => store.directorTerminalBlack)
const terminalFadeStyle = { '--wc-dcf-terminal-fade': `${DIRECTORS_CUT_TERMINAL_FADE_SECONDS}s` } as Record<string, string>

/**
 * Whether the companion is known to be dead — a failed API load, a missing
 * constructor, or an embed that reported a fatal error.
 *
 * Reactive, and ANDed into visibility, because the corner is a lit frame: an
 * opaque black fill, a blue ring and a drop shadow. A dead companion that still
 * takes the stage paints an empty box on the projector for the whole reveal
 * window, which from the back row is indistinguishable from a broken slide.
 * Nothing must paint if nothing can play.
 */
const companionUnavailable = ref(false)
const companionVisible = computed(() => covering.value
  && !companionUnavailable.value
  && directorsCutCompanionVisible(time.value))
const companionHost = ref<HTMLElement | null>(null)
let companionPlayer: YoutubePlayer | null = null
let companionBuild: Promise<YoutubePlayer | null> | null = null
let companionRolling = false
let lastCorrectionAt = Number.NEGATIVE_INFINITY
let destroyed = false
/**
 * Players already torn down. `YT.Player.destroy()` is not idempotent — the
 * second call throws inside the API's own teardown — and the current player and
 * a memoised build result are routinely the same instance, so disposal is
 * identity-guarded rather than counted.
 */
const disposedPlayers = new WeakSet<YoutubePlayer>()

/**
 * Warm both Collapse plates while the finale is still invisible.
 *
 * The frame is `v-show`n, and a browser does not fetch a `background-image`
 * inside a `display: none` subtree. Without this the day plate — used nowhere
 * else in the app — would start loading at the exact instant the finale paints
 * its opaque background over the show, and the room would watch an empty black
 * frame for the length of a cold fetch and decode. The pre-arm window exists
 * for precisely this.
 */
for (const image of [DIRECTORS_CUT_COLLAPSE_DAY_IMAGE, DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE]) {
  if (typeof window !== 'undefined') {
    const warm = new window.Image()
    warm.decoding = 'async'
    warm.src = `${base}${image}`
  }
}

function silence(player: YoutubePlayer) {
  player.mute?.()
  player.setVolume?.(0)
}

/** Tear a player down at most once, whichever path gets there first. */
function disposeCompanion(player: YoutubePlayer | null | undefined) {
  if (!player || disposedPlayers.has(player)) {
    return
  }
  disposedPlayers.add(player)
  player.pauseVideo?.()
  player.destroy?.()
}

/** The corner is dead: hide it and stop driving it, but keep the finale running. */
function markCompanionUnavailable() {
  companionUnavailable.value = true
  companionRolling = false
}

/** Drop a player the finale is holding, and dispose of it. */
function releaseCompanion(player: YoutubePlayer) {
  if (companionPlayer === player) {
    companionPlayer = null
    companionRolling = false
  }
  disposeCompanion(player)
}

/**
 * Build the companion player once, muted, and park it on the measured lead
 * frame. Called at the pre-arm anchor, tens of seconds before the corner is
 * revealed, so the reveal never opens on a cold black iframe.
 */
function buildCompanion(): Promise<YoutubePlayer | null> {
  if (companionBuild) {
    return companionBuild
  }
  companionBuild = (async () => {
    try {
      await loadYoutubeIframeApi()
      const PlayerCtor = getYoutubePlayerConstructor()
      const host = companionHost.value
      if (destroyed) {
        return null
      }
      if (!PlayerCtor || !host) {
        markCompanionUnavailable()
        return null
      }

      // `onError` can arrive from inside `new PlayerCtor(...)`, before the
      // expression returns and before anything can hold the instance — but the
      // instance is already real, with an iframe, a window message listener and
      // a media element behind it. `failed`/`disposeFailed` exist so the
      // constructor's own return can finish the teardown the handler could not.
      let instance: YoutubePlayer | null = null
      let failed = false
      const disposeFailed = () => {
        if (!failed || !instance) {
          return
        }
        const target = instance
        instance = null
        releaseCompanion(target)
      }
      const built = await new Promise<YoutubePlayer | null>((resolve) => {
        const handleReady = (event?: { target?: YoutubePlayer }) => {
          const player = event?.target ?? instance
          if (!player) {
            resolve(null)
            return
          }
          // The build takes seconds; a backward seek across the pre-arm anchor
          // in that window unmounts this component while the player is still on
          // its way. Without this check the player arrives after the teardown
          // that was supposed to dispose of it, is assigned to a component
          // nobody is rendering, and leaks once per seek across the anchor.
          if (destroyed) {
            disposeCompanion(player)
            resolve(null)
            return
          }
          silence(player)
          player.cueVideoById?.({
            videoId: DIRECTORS_CUT_COMPANION_VIDEO_ID,
            startSeconds: COMPANION_SOURCE_PARK_SECONDS,
          })
          player.seekTo?.(COMPANION_SOURCE_PARK_SECONDS, true)
          player.pauseVideo?.()
          resolve(player)
        }
        // A dead companion must never take the finale down with it: the
        // Collapse frame, the bulletin and the closing quote are the show.
        const handleError = () => {
          failed = true
          markCompanionUnavailable()
          disposeFailed()
          resolve(null)
        }
        instance = new PlayerCtor(host, {
          width: '100%',
          height: '100%',
          videoId: DIRECTORS_CUT_COMPANION_VIDEO_ID,
          playerVars: getChromeFreeYoutubePlayerVars({
            autoplay: 0,
            mute: 1,
            loop: 0,
            start: Math.floor(COMPANION_SOURCE_PARK_SECONDS),
          }),
          events: { onReady: handleReady, onError: handleError },
        })
        disposeFailed()
      })
      if (failed) {
        // The embed reported the error between `onReady` and here: the player
        // resolved, but it is already disposed of and must not be handed over.
        disposeCompanion(built)
        return null
      }
      if (!built && !destroyed) {
        markCompanionUnavailable()
      }
      return built
    }
    catch {
      // `loadYoutubeIframeApi()` rejects on a failed script load and the
      // constructor can throw. The memoised promise must still RESOLVE, or
      // every clock tick for the rest of the finale re-awaits a rejected
      // promise and throws through Vue's async watcher handler.
      markCompanionUnavailable()
      return null
    }
  })()
  return companionBuild
}

/** Put the companion back on its measured lead frame, paused and silent. */
function parkCompanion() {
  if (!companionPlayer || !companionRolling) {
    return
  }
  companionRolling = false
  silence(companionPlayer)
  companionPlayer.pauseVideo?.()
  companionPlayer.seekTo?.(COMPANION_SOURCE_PARK_SECONDS, true)
}

/**
 * Hold the companion against the soundtrack clock.
 *
 * The companion is never asked what time it is for the show's sake — the
 * soundtrack player is the only clock. Its own time is read solely to detect
 * material drift, and a correction costs a rebuffer, so small drift is left
 * alone and corrections are rate limited. Without the interval guard a player
 * reporting a stale time while buffering is "corrected" on every poll, which
 * turns the corner into a stutter loop.
 */
function syncCompanion(now: number) {
  const player = companionPlayer
  if (!player) {
    return
  }
  if (!directorsCutCompanionPlaying(now)) {
    parkCompanion()
    return
  }
  const expected = companionSourceTimeAt(now)
  if (!companionRolling) {
    companionRolling = true
    silence(player)
    player.seekTo?.(expected, true)
    player.playVideo?.()
    lastCorrectionAt = now
    return
  }
  const actual = player.getCurrentTime?.() ?? expected
  if (Math.abs(actual - expected) <= DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S) {
    return
  }
  if (Math.abs(now - lastCorrectionAt) < DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S) {
    return
  }
  lastCorrectionAt = now
  player.seekTo?.(expected, true)
  player.playVideo?.()
}

watch(
  () => [store.directorFinalePrearmed, time.value] as const,
  async ([prearmed, now]) => {
    if (destroyed || companionUnavailable.value) {
      return
    }
    if (!prearmed) {
      parkCompanion()
      return
    }
    if (!companionPlayer) {
      const built = await buildCompanion()
      if (destroyed) {
        return
      }
      if (!built || companionUnavailable.value) {
        // The API never produced a usable player, or the one it produced died
        // before it could be handed over. Stop asking on every clock tick and
        // play the rest of the finale without a corner video.
        companionPlayer = null
        markCompanionUnavailable()
        return
      }
      companionPlayer = built
    }
    syncCompanion(store.nativeTime ?? now)
  },
  { immediate: true },
)

onBeforeUnmount(async () => {
  destroyed = true
  const current = companionPlayer
  companionPlayer = null
  companionRolling = false
  disposeCompanion(current)
  // A build still in flight resolves after this hook. Its `onReady` disposes of
  // the player itself once `destroyed` is set; awaiting here covers the window
  // where it resolved between the two, and the identity guard covers the far
  // more common case where the pending build is the very player just disposed.
  const pending = companionBuild
  companionBuild = null
  disposeCompanion(await pending)
})
</script>

<template>
  <div
    v-if="store.directorFinalePrearmed"
    class="wc-dcf"
    :class="{ 'wc-dcf--covering': covering }"
    data-director-finale
    :data-covering="covering ? 'true' : 'false'"
  >
    <!-- The Collapse plate takes the main frame: day on the finale beat, night
         on the Become Legend cue. Clock-derived rather than animated, so a
         backward seek restores the day plate instead of stranding a finished
         animation on stage. -->
    <div v-show="covering" class="wc-dcf-frame" data-director-finale-frame>
      <div class="wc-dcf-plate" :style="{ backgroundImage: collapseDayUrl }" />
      <div
        class="wc-dcf-plate wc-dcf-plate--night"
        data-director-finale-night
        :data-night-opacity="collapseNightOpacity.toFixed(3)"
        :style="{ backgroundImage: collapseNightUrl, opacity: collapseNightOpacity }"
      />
    </div>

    <!-- The minor beat: the missing-scientist bulletin, carried in from the
         lore column on the same authored window so it never re-pages. It sits
         opposite the corner video so the two never share frame space. -->
    <aside v-if="bulletinVisible" class="wc-dcf-bulletin" data-director-finale-bulletin>
      <WolvesLoreColumn
        :artifact-id="DIRECTORS_CUT_BULLETIN_ARTIFACT_ID"
        :duration="bulletinDuration"
        :elapsed="bulletinElapsed"
      />
    </aside>

    <!-- The companion video. The host is mounted from the pre-arm anchor so the
         player can load, cue and park behind the frame, and it now stays
         *rendered* through the hidden play lead: `display: none` gives a
         browser licence to skip layout, paint and compositing for the whole
         subtree, and the lead is 0.395 s — far too short to gamble a scored
         beat on a first paint. It is made invisible instead (zero opacity, no
         hit testing, out of the accessibility tree) and revealed on exactly the
         same authored beat as before, as a hard cut.
         A companion that never became available is removed from the DOM
         entirely: the corner is a lit frame, and an empty one on a projector is
         indistinguishable from a broken slide.
         Kept out of the flow at every viewport: on a projector it sits in the
         corner, and below the theater's own 1024px breakpoint it becomes a
         centred band across the foot of the frame rather than being dropped. -->
    <section
      v-if="!companionUnavailable"
      class="wc-dcf-companion"
      :class="{ 'wc-dcf-companion--hidden': !companionVisible }"
      data-director-finale-companion
      :data-companion-visible="companionVisible ? 'true' : 'false'"
      aria-hidden="true"
      inert
    >
      <div ref="companionHost" class="wc-dcf-companion-host" />
    </section>

    <div v-if="extinctionVisible" class="wc-dcf-clause" data-director-finale-clause="extinction">
      <p
        class="wc-dcf-clause-text"
        :class="{ 'wc-dcf-clause-text--out': extinctionFading }"
        :data-quote-source="DIRECTORS_CUT_SAGAN_SOURCE.citation"
      >
        {{ DIRECTORS_CUT_EXTINCTION_CLAUSE }}
      </p>
    </div>

    <div v-if="survivalVisible" class="wc-dcf-clause" data-director-finale-clause="survival">
      <p
        class="wc-dcf-clause-text"
        :data-quote-source="DIRECTORS_CUT_SAGAN_SOURCE.citation"
      >
        {{ DIRECTORS_CUT_SURVIVAL_CLAUSE }}
      </p>
    </div>

    <!-- Terminal fade. The class latches once and CSS finishes it; the store's
         finished state pins it black if the transport stops early. -->
    <div
      v-show="covering"
      class="wc-dcf-black"
      :class="{
        'wc-dcf-black--fading': terminalFading,
        'wc-dcf-black--done': terminalBlack,
      }"
      data-director-finale-black
      :style="terminalFadeStyle"
    />
  </div>
</template>

<style scoped lang="scss">
.wc-dcf {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  // Before the cover opens the finale is only a parked, hidden player.
  background: transparent;
}

.wc-dcf--covering {
  background: var(--wc-bg);
}

.wc-dcf-frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.wc-dcf-plate {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.wc-dcf-plate--night {
  will-change: opacity;
}

.wc-dcf-bulletin {
  position: absolute;
  top: 11rem;
  left: 2.4rem;
  bottom: 10.5rem;
  width: clamp(30rem, 30vw, 46rem);
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.wc-dcf-bulletin :deep(.wolves-lore-column) {
  flex: 1;
  min-height: 0;
}

.wc-dcf-companion {
  position: absolute;
  right: 2.4rem;
  bottom: 2.4rem;
  width: clamp(28rem, 26vw, 40rem);
  aspect-ratio: 16 / 9;
  border-radius: 1rem;
  overflow: hidden;
  background: #000;
  box-shadow:
    0 0 0 1px rgb(147 197 253 / 35%),
    0 1.6rem 4rem rgb(0 0 0 / 55%);
  // The corner is rendered from the pre-arm anchor and only made invisible, so
  // promote its layer up front: the reveal is a hard cut on a measured beat and
  // must not wait on a first composite.
  will-change: opacity;
}

// Invisible, not unrendered. Everything below the compositor stays live — the
// embed keeps decoding and the layer keeps its raster — while nothing reaches
// the audience, the pointer or assistive technology.
.wc-dcf-companion--hidden {
  opacity: 0;
  pointer-events: none;
}

.wc-dcf-companion-host,
.wc-dcf-companion-host :deep(iframe) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
}

.wc-dcf-clause {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8vw;
  text-align: center;
}

.wc-dcf-clause-text {
  margin: 0;
  font-family: var(--wc-font-weyland);
  font-size: clamp(4.4rem, 7vw, 9rem);
  font-weight: 400;
  line-height: 1.12;
  letter-spacing: 0.1em;
  color: #dbeafe;
  text-shadow:
    0 0 14px rgb(125 211 252 / 100%),
    0 0 38px rgb(59 130 246 / 92%),
    0 0 82px rgb(37 99 235 / 68%),
    0 0 24px rgb(8 9 12 / 90%);
  opacity: 1;
  transition: opacity 1.1s linear;
}

.wc-dcf-clause-text--out {
  opacity: 0;
}

.wc-dcf-black {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  transition: opacity var(--wc-dcf-terminal-fade, 2.4s) linear;
}

.wc-dcf-black--fading {
  opacity: 1;
}

.wc-dcf-black--done {
  opacity: 1;
  transition: none;
}

@media (max-width: 1023px) {
  // Explicit narrow-viewport treatment. The standard Track 0 sidecar simply
  // does not mount below this breakpoint; the finale's companion is a scored
  // beat, so it is re-placed rather than dropped — a centred band across the
  // foot of the frame. The bulletin follows the theater's own rule and stands
  // down, because a 30vw dossier and a 16:9 band cannot share a phone frame.
  .wc-dcf-bulletin {
    display: none;
  }

  .wc-dcf-companion {
    right: auto;
    left: 50%;
    bottom: 4vh;
    width: min(88vw, 56rem);
    transform: translateX(-50%);
  }

  .wc-dcf-clause {
    align-items: flex-start;
    padding: 12vh 6vw 0;
  }

  .wc-dcf-clause-text {
    font-size: clamp(3.2rem, 9vw, 5.6rem);
  }
}
</style>
