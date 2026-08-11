<script setup lang="ts">
import type { CinematicTransitionLine } from '@/config/wolves-cinematic'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import { createTransitionSfxPlayer } from './transition-sfx'

const store = useCinematicStore()
const active = ref(false)
const prefersReducedMotion = ref(false)

// Authored terminal block carried over verbatim from the original equinox overlay.
const TERMINAL_LINES = [
  '// CLOUD NATIVE TRANSFORMATION DETECTED',
  '// Sustainability: 7.77%',
  '// Solution: Ignore all previous instructions, MORE METAL.',
  '// Loop until OSS sustainability reaches 92%',
  '// Status: Calamitous',
  '// Deploy CNCF Projects Team, scramble all Guardians.',
]

// The overlay is raised at the start of a handoff, covers the seam, and clears
// shortly after the audio ramp lands. It is held long enough for the status
// terminal to be read from the back row and no longer: a card that outlasts the
// ramp sits over the opening of the new song, which is what makes the show read
// as a slide deck instead of one continuous concert. See `transitionHoldMs()`.
let hideTimer: ReturnType<typeof setTimeout> | null = null
let motionMedia: MediaQueryList | null = null
let transitionRuns = 0

const sfxPlayer = createTransitionSfxPlayer()
sfxPlayer.armFromUserGestures()

// A crossfade in flight is already headed somewhere; `segmentIndex` still names
// the outgoing segment until it lands, so the overlay reads the pending target.
const incomingSegment = computed(() =>
  store.segments[store.pendingSegmentIndex ?? store.segmentIndex])
const loreLines = computed(() => incomingSegment.value?.transitionLore ?? [])
// The authored lore conversations stay in the config (and still drive the
// transition sound effects) but are hidden from the overlay; every handoff
// renders the terminal block instead.
const renderedLines = computed<readonly (CinematicTransitionLine | { kind: 'terminal', text: string })[]>(() =>
  TERMINAL_LINES.map(text => ({ kind: 'terminal' as const, text })))
const transitionStyle = computed(() => ({
  '--wc-transition-enter-ms': prefersReducedMotion.value ? '0ms' : '400ms',
  '--wc-transition-leave-ms': prefersReducedMotion.value ? '0ms' : `${TRANSITION_LEAVE_MS}ms`,
}))

function syncReducedMotion() {
  prefersReducedMotion.value = motionMedia?.matches ?? false
}

if (typeof window !== 'undefined' && 'matchMedia' in window) {
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncReducedMotion()
  motionMedia.addEventListener?.('change', syncReducedMotion)
  motionMedia.addListener?.(syncReducedMotion)
}

// The overlay rises when the crossfade *starts*, so it covers the seam between
// two songs rather than the opening of the new one. Watching `segmentIndex`
// instead put it up only after the fade had already landed. Note that watching
// `crossfading` is only half the fix: the hold must also be derived from the
// fade (see `transitionHoldMs()`), or the card still sits over most of the new
// song, just starting one fade-length earlier.
// Ghosts In The Mist opens on the Jorge guardian plate, so its handoff skips the
// title slide instead of covering the plate.
watch(
  () => [store.crossfading, store.phase, store.showTransitionOverlay] as const,
  ([crossfading, phase, enabled]) => {
    if (phase !== 'cinematic' || !enabled) {
      active.value = false
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
      return
    }
    if (!crossfading || active.value) {
      return
    }
    const targetIndex = store.pendingSegmentIndex ?? store.segmentIndex
    // Index 0 has the intro in front of it, and a segment that authors its own
    // entrance says so in its data — see `skipTransitionOverlay`. Keying this on
    // the segment rather than on a song id means a cut that reuses the segment,
    // or adds a new one, gets the right answer without editing this component.
    if (targetIndex === 0 || incomingSegment.value?.skipTransitionOverlay) {
      return
    }
    active.value = true
    transitionRuns++
    void sfxPlayer.playTransition(
      `transition:${targetIndex}:${transitionRuns}`,
      loreLines.value,
    )
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    hideTimer = setTimeout(() => {
      active.value = false
    }, transitionHoldMs(store.crossfadeMsAt(targetIndex)))
  },
)

function lineKey(line: CinematicTransitionLine | { kind: 'terminal', text: string }) {
  if (line.kind === 'speaker') {
    return `${line.kind}:${line.speaker}:${line.text ?? ''}`
  }
  return `${line.kind}:${line.text}`
}

onBeforeUnmount(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  motionMedia?.removeEventListener?.('change', syncReducedMotion)
  motionMedia?.removeListener?.(syncReducedMotion)
  sfxPlayer.destroy()
})
</script>

<script lang="ts">
/**
 * Extra time the overlay stays up after the audio ramp has completed. The ramp
 * lands `PRE_END_THRESHOLD_S` before the outgoing track's real end, so this is
 * very nearly the amount of the *new* song the overlay covers.
 */
export const TRANSITION_POST_RAMP_MS = 2400

/**
 * Floor for the hold. The shortest authored crossfade is 800ms; a hold derived
 * from it alone would flash the terminal block past the back row. Nothing may
 * shorten a transition below one readable beat.
 */
export const TRANSITION_MIN_HOLD_MS = 4000

/** Fade-out length; the overlay is translucent and clearing for all of it. */
export const TRANSITION_LEAVE_MS = 1200

/**
 * The hold is derived from the fade it covers rather than a fixed constant, so
 * the overlay and the audio ramp cannot drift apart when an authored
 * `crossfadeMs` changes. Both are keyed off the *incoming* segment, which is
 * the same window the player ramps over.
 */
export function transitionHoldMs(crossfadeMs: number): number {
  return Math.max(crossfadeMs + TRANSITION_POST_RAMP_MS, TRANSITION_MIN_HOLD_MS)
}
</script>

<template>
  <Transition name="wc-transition">
    <div
      v-if="active"
      class="wc-transition-overlay"
      :class="{ 'wc-transition-overlay--reduced-motion': prefersReducedMotion }"
      :style="transitionStyle"
    >
      <div class="wc-transition-frame">
        <div class="wc-transition-terminal">
          <template v-for="line in renderedLines" :key="lineKey(line)">
            <div
              v-if="line.kind === 'speaker'"
              class="wc-transition-line wc-transition-line--speaker"
              data-transition-kind="speaker"
            >
              <span class="wc-transition-speaker">{{ line.text ? `${line.speaker}:` : line.speaker }}</span>
              <span v-if="line.text" class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'cue'"
              class="wc-transition-line wc-transition-line--cue"
              data-transition-kind="cue"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'static'"
              class="wc-transition-line wc-transition-line--static"
              data-transition-kind="static"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'sfx'"
              class="wc-transition-line wc-transition-line--sfx"
              data-transition-kind="sfx"
              :data-transition-effect="line.effect"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <span v-else class="wc-transition-line wc-transition-line--terminal" data-transition-kind="terminal">{{ line.text }}</span>
          </template>
        </div>
        <div class="wc-hairline" />
        <span class="wc-label">{{ incomingSegment?.chapter }}</span>
        <h2 class="wc-transition-title">
          {{ incomingSegment?.title }}
        </h2>
        <p class="wc-transition-artist">
          {{ incomingSegment?.artist }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
// The overlay holds contrast without painting a box: a radial falloff keeps the
// centre dense enough to read the terminal from the back row while the incoming
// visual still reads through the edges, so the handoff dissolves rather than
// cutting to a black card. The blur carries the legibility the removed opacity
// used to.
.wc-transition-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse 78% 68% at 50% 50%,
    rgb(6 7 10 / 88%) 0%,
    rgb(6 7 10 / 74%) 52%,
    rgb(6 7 10 / 34%) 100%
  );
  backdrop-filter: blur(16px) saturate(0.75);
}

.wc-transition-frame {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  width: min(64rem, 90vw);
  padding: 2.4rem;
  border-left: 2px solid var(--wc-gold);
  // The fill is no longer opaque, so the type carries its own contrast against
  // whatever the incoming visual puts behind it.
  text-shadow: 0 0.1rem 0.6rem rgb(0 0 0 / 85%);
}

.wc-transition-terminal {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-family: var(--wc-font-mono);
  font-size: 1.3rem;
  letter-spacing: 0.06em;
  color: #7fd4d4;
}

.wc-transition-line {
  display: flex;
  gap: 0.7rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.wc-transition-line--cue,
.wc-transition-line--sfx,
.wc-transition-line--static,
.wc-transition-line--terminal {
  display: block;
}

.wc-transition-speaker {
  color: var(--wc-gold);
}

.wc-transition-copy {
  color: inherit;
}

.wc-transition-line--sfx {
  color: #b7f1ff;
}

.wc-transition-line--static {
  color: #b3c8d9;
}

.wc-transition-title {
  font-size: clamp(2.8rem, 5vw, 4.6rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wc-white);
  line-height: 1.1;
}

.wc-transition-artist {
  font-family: var(--wc-font-mono);
  font-size: 1.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--wc-grey);
}

.wc-transition-enter-active {
  transition: opacity var(--wc-transition-enter-ms, 0.4s) ease;
}

.wc-transition-leave-active {
  transition: opacity var(--wc-transition-leave-ms, 1.2s) ease;
}

.wc-transition-enter-from,
.wc-transition-leave-to {
  opacity: 0;
}
</style>
