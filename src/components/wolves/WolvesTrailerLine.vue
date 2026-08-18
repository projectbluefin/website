<script setup lang="ts">
import type { TrailerToken } from '@/data/wolves-trailer-plates'
import { computed } from 'vue'
import { tokenizeTrailerLine } from '@/data/wolves-trailer-plates'

/**
 * One authored line of Trailer 1, drawn the way the delivered cut draws it.
 *
 * The copy is never edited here. Three things change only how glyphs are
 * PAINTED, each of them an owner instruction recorded in destiny-vids:
 *
 *   accent   every B and every F is the Bluefin wordmark blue (or, on the end
 *            card's call to action, every `.` instead)
 *   sear     a spaced ` | ` is drawn as a vertical glow rather than set as the
 *            typeface's pipe glyph
 *   mark     the single `o` of one named word becomes the Kubernetes helm,
 *            keeping the letter it replaces as its alt text
 */
const props = withDefaults(defineProps<{
  text: string
  /**
   * Off for other people's trademarks — the end card title is a Linux
   *  Foundation mark and is deliberately not recoloured.
   */
  blue?: boolean
  /** Replace the single `o` of this word with the helm. */
  markWord?: string
  /** Accent every `.` instead of every B/F. */
  accentDots?: boolean
}>(), {
  blue: true,
  markWord: undefined,
  accentDots: false,
})

const markSrc = `${import.meta.env.BASE_URL}brands/kubernetes-icon-white.svg`

const tokens = computed<TrailerToken[]>(() => tokenizeTrailerLine(props.text, {
  blue: props.blue,
  markWord: props.markWord,
  accentDots: props.accentDots,
}))
</script>

<template>
  <span class="wt-line">
    <template v-for="(token, index) in tokens" :key="index">
      <!-- The pipe is still a character of the authored string, so it stays
           readable as one to anything that is not a camera. -->
      <span
        v-if="token.kind === 'sear'"
        class="wt-sear"
        role="separator"
        aria-label="|"
      />
      <img
        v-else-if="token.kind === 'mark'"
        class="wt-k8s-o"
        :src="markSrc"
        :alt="token.value"
      >
      <span v-else-if="token.kind === 'accent'" class="wt-accent">{{ token.value }}</span>
      <template v-else>{{ token.value }}</template>
    </template>
  </span>
</template>

<style scoped lang="scss">
.wt-line {
  // Sized and coloured by the plate that hosts it; this component only decides
  // how the three special tokens are drawn.
  display: inline;
}

/* The one coloured letterform. #4285f4 is the published fill of the fin
   ligature in Project Bluefin's own wordmark — NOT --wc-gold (#60a5fa), which
   is a UI token and not the brand. */
.wt-accent {
  color: #4285f4;
}

/* THE SEAR — the vertical glow on the `|`.

   A glyph's bar is sized by the typeface; this one has to span the caps it
   divides, so the character is drawn as a rule of controlled height instead.

   It is BLUE, and it is not a new treatment: these are the three values
   destiny-vids' tools/credits.py already uses for the film's sear —
   flare rgb(196 226 255), mid rgb(147 197 253), halo rgb(37 99 235). Warm is
   the obvious reading of the word and the wrong one here.

   It is glow, not a panel: a tight near-opaque core with wider soft falloffs,
   travelling with the mark and owning no edge. */
.wt-sear {
  display: inline-block;
  width: 0.156cqw;
  min-width: 1px;
  height: 1.55em;

  // NOT equal margins. The credit row tracks at 0.24em and that air lands
  // unevenly around an inline-block rule; these are the measured values.
  margin: 0 0.72em 0 0.62em;
  vertical-align: -0.38em;
  border-radius: 2px;
  background: linear-gradient(
    to bottom,
    rgb(147 197 253 / 0%) 0%,
    rgb(147 197 253 / 90%) 12%,
    rgb(232 244 255) 50%,
    rgb(147 197 253 / 90%) 88%,
    rgb(147 197 253 / 0%) 100%
  );
  box-shadow:
    0 0 4px 0 rgb(196 226 255 / 95%),
    0 0 12px 1px rgb(147 197 253 / 90%),
    0 0 30px 2px rgb(147 197 253 / 55%),
    0 0 64px 6px rgb(37 99 235 / 55%);
}

/* THE O IN WOLVES IS THE KUBERNETES HELM (and the O in "Extinction").

   CNCF's published white icon, reproduced unmodified — already fill:#fff, so
   nothing here recolours anybody's trademark. Owner: "not the blue one though,
   just the white symbolic one".

   Sized against the cap rather than the em so it sits on the same optical line
   as the O it stands in for. 0.62em was measured: matching the cap height made
   the solid hexagon too heavy beside the outline-like letter O. It inherits
   the lockup's halo through drop-shadow, because text-shadow does not apply to
   an image and this would otherwise be the one unprotected element. */
.wt-k8s-o {
  // Tailwind's preflight sets `img { display: block }`, which turns the mark
  // into a block box: it takes its own line and ignores the centring, so the
  // title breaks around it. It is a replaced INLINE element here, seated on
  // the text baseline like the letter it stands in for.
  display: inline;
  height: 0.62em;
  width: auto;
  vertical-align: 0.042em;
  margin: 0 0.041em 0 -0.005em;
  filter: drop-shadow(0 0 4px rgb(0 0 0 / 95%)) drop-shadow(0 2px 10px rgb(0 0 0 / 90%))
    drop-shadow(0 0 28px rgb(0 0 0 / 75%));
}
</style>
