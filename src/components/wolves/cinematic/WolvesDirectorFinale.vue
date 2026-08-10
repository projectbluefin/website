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
 *    column when the finale opens — on its authored paging window, as a minor
 *    beat beside the main frame, and clears it before the companion reveal;
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
  getYoutubePlayerState,
  loadYoutubeIframeApi,
  suppressYoutubeCaptions,
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
  DIRECTORS_CUT_EXTINCTION_FADE_SECONDS,
  DIRECTORS_CUT_SAGAN_SOURCE,
  DIRECTORS_CUT_SURVIVAL_CLAUSE,
  DIRECTORS_CUT_TERMINAL_FADE_SECONDS,
  directorsCutBulletinVisible,
  directorsCutCollapseNightOpacity,
  directorsCutCompanionPlaying,
  directorsCutCompanionReadinessExpired,
  directorsCutCompanionVisible,
  directorsCutCoverOpacity,
  directorsCutExtinctionFading,
  directorsCutExtinctionVisible,
  directorsCutSurvivalVisible,
  directorsCutTerminalFadeEngaged,
} from '@/data/wolves-directors-cut-finale'
import {
  DIRECTORS_CUT_BULLETIN_ARTIFACT_ID,
  DIRECTORS_CUT_BULLETIN_END,
  DIRECTORS_CUT_BULLETIN_START,
} from '@/data/wolves-directors-cut-timeline'
import { useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()
const base = import.meta.env.BASE_URL

const time = computed(() => store.nativeTime)
const covering = computed(() => store.directorFinaleActive)

const collapseDayUrl = `url('${base}${DIRECTORS_CUT_COLLAPSE_DAY_IMAGE}')`
const collapseNightUrl = `url('${base}${DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE}')`
const collapseNightOpacity = computed(() => directorsCutCollapseNightOpacity(time.value))
/**
 * How far the finale has taken the frame. Drives both the Collapse plate and
 * the backdrop that hides the ordinary stage, so the two come up together
 * rather than the black arriving first and the picture after it.
 */
const coverOpacity = computed(() => directorsCutCoverOpacity(time.value))

const bulletinVisible = computed(() => covering.value && directorsCutBulletinVisible(time.value))
/**
 * The bulletin's *paging* window is the lore slot's, not the finale's display
 * window.
 *
 * `WolvesLoreColumn` paginates purely from `(duration, elapsed)`, and the
 * theater's own column has been showing this record on the slot's numbers since
 * `DIRECTORS_CUT_BULLETIN_START` — through the ten seconds before the cover
 * opens. Handing the finale's shorter display window to a second instance would
 * re-paginate the record at the handover and jump the page in front of the
 * room. The authored window itself ends on the companion play handoff, after
 * every page has been read, so the display can clear without re-timing it.
 */
const bulletinDuration = DIRECTORS_CUT_BULLETIN_END - DIRECTORS_CUT_BULLETIN_START
const bulletinElapsed = computed(() => Math.min(
  bulletinDuration,
  Math.max(0, time.value - DIRECTORS_CUT_BULLETIN_START),
))

const extinctionVisible = computed(() => covering.value && directorsCutExtinctionVisible(time.value))
const extinctionFading = computed(() => directorsCutExtinctionFading(time.value))
/**
 * The clause fade is authored as its window minus the reserve the removal beat
 * needs — see `DIRECTORS_CUT_CLAUSE_FADE_SAFETY_SECONDS`. Publishing it as a
 * custom property keeps the one number in the anchors module instead of a
 * hand-typed CSS time that drifts the next time a beat moves.
 */
const clauseFadeStyle = { '--wc-dcf-clause-fade': `${DIRECTORS_CUT_EXTINCTION_FADE_SECONDS}s` } as Record<string, string>

// The terminal fade is a latched CSS transition, not a per-tick opacity: the
// YouTube clock routinely plateaus near the end of an upload, and an opacity
// computed from `(time - start) / span` would freeze the show on a grey frame.
// Once this flips the compositor finishes the fade on its own.
const terminalFading = computed(() => covering.value && directorsCutTerminalFadeEngaged(time.value))
const terminalBlack = computed(() => store.directorTerminalBlack)
const terminalFadeStyle = { '--wc-dcf-terminal-fade': `${DIRECTORS_CUT_TERMINAL_FADE_SECONDS}s` } as Record<string, string>
const survivalVisible = computed(() => covering.value
  && !terminalBlack.value
  && directorsCutSurvivalVisible(time.value))

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
/**
 * Whether the player has reported playback since the last alignment seek.
 *
 * Not a convenience flag: it is the difference between a corner that cuts in on
 * a decoded frame and one that cuts in on a buffering spinner. A YouTube embed
 * rebuffers after *every* seek — the alignment seek at the start of the hidden
 * lead and every drift correction after it — so the corner is only on stage
 * between the embed saying `PLAYING` and the next seek that takes that back.
 */
const companionSynchronized = ref(false)
/**
 * The corner was asked to roll and never reported playback before the source's
 * own last cut, so it is given up on for this pass through the window.
 *
 * A fast-forward straight into the reveal — which is what any operator seek
 * looks like — skips the whole pre-arm lead, and a cold embed can take longer
 * to decode than the reveal window is worth. Without a bound the corner sits
 * transparent forever, and could light up on a black frame halfway through the
 * closing quote. This is a *clock* deadline, not a timer, so it unwinds on a
 * backward seek like everything else here: `parkCompanion()` clears it whenever
 * the companion's window is not open.
 */
const companionReadinessLost = ref(false)
/** Whether the corner has genuinely played in this pass; the deadline governs the first alignment only. */
const companionEverPlayed = ref(false)
/**
 * Whether the corner is in the DOM at all. A dead or given-up companion is
 * removed rather than left transparent: the corner is a lit frame, and an empty
 * one on a projector reads from the back row as a broken slide.
 */
const companionRendered = computed(() => !companionUnavailable.value && !companionReadinessLost.value)
const companionVisible = computed(() => covering.value
  && companionRendered.value
  && companionSynchronized.value
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

function companionVideoId(player: YoutubePlayer): string | null {
  try {
    return player.getVideoData?.()?.video_id ?? null
  }
  catch {
    return null
  }
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
  companionSynchronized.value = false
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

/** Give up on this pass without making a dead corner permanent. */
function loseCompanionReadiness(player: YoutubePlayer) {
  companionReadinessLost.value = true
  companionSynchronized.value = false
  companionEverPlayed.value = false
  companionRolling = false
  releaseCompanion(player)
  // The disposed instance was the resolved value of this memoised promise.
  // Clear it so a backward seek can build into the new host after the
  // readiness-lost corner is removed from the DOM.
  companionBuild = null
}

/** Reset all pass-local companion state after a backward transport seek. */
function resetCompanionPass() {
  companionReadinessLost.value = false
  companionSynchronized.value = false
  companionEverPlayed.value = false
  if (companionPlayer && companionRolling) {
    companionRolling = false
    silence(companionPlayer)
    companionPlayer.pauseVideo?.()
  }
  lastCorrectionAt = Number.NEGATIVE_INFINITY
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
        const handleStateChange = (event: { data: number, target?: YoutubePlayer }) => {
          // Only playback that follows an alignment seek is evidence the corner
          // can be cut to. A `PLAYING` while the finale has not asked this
          // player to roll — the API's own post-cue prewarm, a resumed embed —
          // says nothing about whether it is on the frame the edit needs.
          if (event.data !== getYoutubePlayerState().PLAYING || !companionRolling) {
            return
          }
          const player = event.target ?? companionPlayer
          if (!player) {
            return
          }
          const reportedVideoId = companionVideoId(player)
          if (reportedVideoId !== DIRECTORS_CUT_COMPANION_VIDEO_ID) {
            if (reportedVideoId) {
              markCompanionUnavailable()
              releaseCompanion(player)
            }
            return
          }
          const expected = companionSourceTimeAt(store.nativeTime)
          const actual = player.getCurrentTime?.()
          if (actual !== undefined && Math.abs(actual - expected) > DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S) {
            return
          }
          companionSynchronized.value = true
          companionEverPlayed.value = true
        }
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
          suppressYoutubeCaptions(player)
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
          events: {
            // The corner is a lit frame on a projector; YouTube's own caption
            // track landing in it would be as visible as the film. `instance`
            // rather than a captured local: `onApiChange` fires long after this
            // object literal is built.
            onApiChange: () => suppressYoutubeCaptions(instance),
            onReady: handleReady,
            onError: handleError,
            onStateChange: handleStateChange,
          },
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
  // Everything about this pass through the companion's window is released
  // here, including the readiness verdict: the window is closed, so a later
  // pass — a backward seek in rehearsal — starts from a clean slate rather
  // than inheriting a deadline that expired on the run before it.
  companionSynchronized.value = false
  companionReadinessLost.value = false
  companionEverPlayed.value = false
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
 *
 * Every seek issued here also takes the corner off stage until the player
 * reports playback again: the frames straight after a seek are the embed's
 * buffering state, not the film.
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
  // Given up on for this pass: stop driving it entirely. Without this the
  // released `companionRolling` flag reads as "not started yet" on the next
  // tick and the whole alignment fires again, once every poll.
  if (companionReadinessLost.value) {
    return
  }
  const reportedVideoId = companionVideoId(player)
  if (reportedVideoId !== DIRECTORS_CUT_COMPANION_VIDEO_ID) {
    if (reportedVideoId) {
      markCompanionUnavailable()
      releaseCompanion(player)
    }
    return
  }
  // A cold build can finish after the reveal window's measured readiness
  // deadline. Do not start it then: a late PLAYING event would otherwise light
  // the corner for only the tail of the edit, after the impact has passed.
  if (!companionEverPlayed.value && directorsCutCompanionReadinessExpired(now)) {
    loseCompanionReadiness(player)
    return
  }
  const expected = companionSourceTimeAt(now)
  if (!companionRolling) {
    companionRolling = true
    companionSynchronized.value = false
    silence(player)
    player.seekTo?.(expected, true)
    player.playVideo?.()
    lastCorrectionAt = now
    return
  }
  // A corner that was asked to roll and has still not reported playback by the
  // film's own last cut has nothing left to show. Give it up rather than hold a
  // transparent box that could light up on a black frame later in the window.
  if (!companionEverPlayed.value && directorsCutCompanionReadinessExpired(now)) {
    companionReadinessLost.value = true
    companionRolling = false
    companionSynchronized.value = false
    silence(player)
    player.pauseVideo?.()
    return
  }
  const actual = player.getCurrentTime?.() ?? expected
  if (Math.abs(actual - expected) <= DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S) {
    return
  }
  // Rate limit forward progress only. A backward transport seek moves `now`
  // behind the last correction, and a limiter written on the magnitude of the
  // gap reads that as "just corrected" and refuses — leaving the corner ahead
  // of the music, which is the one thing this beat cannot survive.
  if (now >= lastCorrectionAt && now - lastCorrectionAt < DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S) {
    return
  }
  lastCorrectionAt = now
  companionSynchronized.value = false
  player.seekTo?.(expected, true)
  player.playVideo?.()
}

watch(
  () => [store.directorFinalePrearmed, time.value] as const,
  async ([prearmed, now], previous) => {
    if (destroyed || companionUnavailable.value) {
      return
    }
    const previousTime = previous?.[1]
    if (previousTime !== undefined && now < previousTime) {
      resetCompanionPass()
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
  companionSynchronized.value = false
  companionRolling = false
  companionReadinessLost.value = false
  companionEverPlayed.value = false
  disposeCompanion(current)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    delete (window as any).__wolvesFinaleCompanion
  }
  // A build still in flight resolves after this hook. Its `onReady` disposes of
  // the player itself once `destroyed` is set; awaiting here covers the window
  // where it resolved between the two, and the identity guard covers the far
  // more common case where the pending build is the very player just disposed.
  const pending = companionBuild
  companionBuild = null
  disposeCompanion(await pending)
})

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Live companion evidence for `tests/wolves-directors-cut-finale.mjs`.
  //
  // The harness used to read the corner's source time out of its own mock's
  // call log, which is bookkeeping, not evidence: under `WOLVES_REAL_MEDIA=1`
  // there is no mock and the field was simply null, so the mode that exists to
  // prove real playback proved nothing about it. This publishes what the real
  // embed says about itself — its own clock, its mute state, its player state
  // — so both modes read the same live surface.
  ;(window as any).__wolvesFinaleCompanion = () => {
    const player = companionPlayer
    return {
      built: Boolean(player),
      rendered: companionRendered.value,
      visible: companionVisible.value,
      synchronized: companionSynchronized.value,
      everPlayed: companionEverPlayed.value,
      unavailable: companionUnavailable.value,
      readinessLost: companionReadinessLost.value,
      sourceTime: player?.getCurrentTime?.() ?? null,
      muted: player?.isMuted?.() ?? null,
      volume: player?.getVolume?.() ?? null,
      videoId: player?.getVideoData?.()?.video_id ?? null,
      duration: player?.getDuration?.() ?? null,
      expectedSourceTime: companionSourceTimeAt(store.nativeTime),
      soundtrackTime: store.nativeTime,
    }
  }
}
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
         animation on stage.
         The whole frame — its opaque backdrop included — dissolves up over
         `DIRECTORS_CUT_COVER_FADE_SECONDS` rather than cutting in. The backdrop
         lives on this element and not on `.wc-dcf--covering` precisely so it
         fades *with* the picture: a black that arrives first is a blackout, not
         a transition. -->
    <div
      v-show="covering"
      class="wc-dcf-frame"
      data-director-finale-frame
      :data-cover-opacity="coverOpacity.toFixed(3)"
      :style="{ opacity: coverOpacity }"
    >
      <div class="wc-dcf-plate" :style="{ backgroundImage: collapseDayUrl }" />
      <div
        class="wc-dcf-plate wc-dcf-plate--night"
        data-director-finale-night
        :data-night-opacity="collapseNightOpacity.toFixed(3)"
        :style="{ backgroundImage: collapseNightUrl, opacity: collapseNightOpacity }"
      />
    </div>

    <!-- The minor beat: the missing-scientist bulletin, carried in from the
         lore column on the same authored paging window so it never re-pages.
         It clears on the companion play handoff, before the corner reveals, so
         the two never share frame space. -->
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
         A companion that never became available — a dead embed, or one that
         never reported playback before the film's own last cut — is removed
         from the DOM entirely: the corner is a lit frame, and an empty one on a
         projector is indistinguishable from a broken slide.
         Kept out of the flow at every viewport: on a projector it sits in the
         corner, and below the theater's own 1024px breakpoint it becomes a
         centred band across the foot of the frame rather than being dropped. -->
    <section
      v-if="companionRendered"
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
        :style="clauseFadeStyle"
        :data-quote-source="DIRECTORS_CUT_SAGAN_SOURCE.citation"
      >
        {{ DIRECTORS_CUT_EXTINCTION_CLAUSE }}
      </p>
    </div>

    <div v-if="survivalVisible" class="wc-dcf-clause" data-director-finale-clause="survival">
      <p
        class="wc-dcf-clause-text"
        :style="clauseFadeStyle"
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
  // Nothing here. The opaque backdrop is on `.wc-dcf-frame` so it dissolves up
  // with the Collapse plate instead of cutting in a frame ahead of it. The
  // class is kept because `data-covering` and it are what the browser tests and
  // the slide harness read the finale's state from.
  background: transparent;
}

.wc-dcf-frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--wc-bg);
  will-change: opacity;
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
  /* The closing quote is the prologue's voice arriving at its conclusion, so it
     is set in the prologue's type: same Weyland-era family, same single weight,
     same uppercase, same letter spacing. It previously carried a heavy blue
     neon glow in sentence case, which read as a different show's caption
     dropped on the last beat.

     The *legibility* treatment is the intro's other one. `.wolves-intro-overlay-text`
     gets away with a soft drop shadow because it sits on a black card; this sits
     on the Collapse painting, where light grey on mid-grey is exactly the
     low-contrast defect a projector punishes. So it takes the hard black
     outline the intro uses for its own type over artwork
     (`.wolves-intro-overlay-title-card-line`): the letterform stays Michroma,
     and the frame behind it stops competing with it.

     Size differs from the prologue cue deliberately: that is a full sentence low
     in the frame, this is three words centred on the climax. Michroma is a very
     wide face, so the uppercase clause is verified in Chromium at 1600x900 and
     390x844 rather than assumed to fit. */
  font-family: var(--wc-font-weyland, 'Michroma', 'Arial Narrow', sans-serif);
  font-size: clamp(3.2rem, 5vw, 6.4rem);
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #f4f6f8;
  text-shadow:
    -3px -3px 0 #000,
    3px -3px 0 #000,
    -3px 3px 0 #000,
    3px 3px 0 #000,
    0 0 28px rgb(0 0 0 / 92%),
    0 0 64px rgb(0 0 0 / 70%);
  -webkit-text-stroke: 2.8px #000;
  paint-order: stroke fill;
  opacity: 1;
  transition: opacity var(--wc-dcf-clause-fade, 1.1s) linear;
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
  // does not mount below this breakpoint; the finale's beats are scored, so
  // they are re-placed rather than dropped. Both become centred bands stacked
  // up the frame, sized off one pair of custom properties so the geometry that
  // keeps them apart is stated once and cannot drift between the two rules.
  .wc-dcf {
    --wc-dcf-band-inset: 4vh;
    --wc-dcf-band-gap: 3vh;
    --wc-dcf-band-width: min(88vw, 56rem);
    --wc-dcf-band-height: calc(var(--wc-dcf-band-width) * 9 / 16);
  }

  .wc-dcf-bulletin {
    top: 7vh;
    left: 50%;
    right: auto;
    bottom: calc(var(--wc-dcf-band-inset) + var(--wc-dcf-band-height) + var(--wc-dcf-band-gap));
    width: var(--wc-dcf-band-width);
    transform: translateX(-50%);
  }

  .wc-dcf-companion {
    right: auto;
    left: 50%;
    bottom: var(--wc-dcf-band-inset);
    width: var(--wc-dcf-band-width);
    transform: translateX(-50%);
  }

  .wc-dcf-clause {
    align-items: flex-start;
    padding: 12vh 6vw 0;
  }

  .wc-dcf-clause-text {
    // Uppercase Michroma is far wider than the sentence-case treatment this
    // replaced, so the narrow band drops a step rather than inheriting a size
    // that wraps to four lines on a phone.
    font-size: clamp(2.4rem, 6.4vw, 4rem);
  }
}
</style>
