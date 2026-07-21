<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { dinosaurSpecies } from '@/data/wolves-dinosaur-species'

withDefaults(defineProps<{
  /** Small secondary detail line (chapter / status). */
  detail: string
  /** Large primary label. */
  label: string
  /** Slowly fades label changes for the authored Track 0 communications. */
  slowFade?: boolean
  /** Split-second interference treatment while a glitch cue holds the label. */
  glitch?: boolean
}>(), {
  slowFade: false,
  glitch: false,
})

/**
 * Authored labels mark technical tokens with double quotes (e.g.
 * "humans/trying-their-best:v1"). Render those segments in monospace with the
 * quotes stripped instead of showing the literal quotation marks.
 */
function labelParts(label: string): readonly { text: string, mono: boolean }[] {
  return label
    .split(/"([^"]*)"/)
    .map((text, index) => ({ text, mono: index % 2 === 1 }))
    .filter(part => part.text)
}

/**
 * Bluefin-branded emblem on the left of the plate: the roster of dinosaur
 * avatars rotates slowly through the badge, always starting on the Bluefin
 * raptor so the brand reads first.
 */
const AVATAR_ROTATE_MS = 20_000
const avatarUrls = dinosaurSpecies.map(
  species => `${import.meta.env.BASE_URL}${species.artwork.slice(2)}`,
)
const avatarIndex = ref(0)
const activeAvatar = computed(() => dinosaurSpecies[avatarIndex.value])
let avatarTimer: number | undefined

/**
 * Pre-decode the full dinosaur roster so the emblem never blocks on first
 * paint while the user is watching the immersive theater. This mirrors the
 * guardian-companion prewarm in WolvesIntroOverlay.vue.
 */
function predecodeAvatarArtwork() {
  for (const url of avatarUrls) {
    const image = new Image()
    image.src = url
    void image.decode().catch(() => {
      // Browser doesn't support decode() or image failed; fall back to normal
      // lazy loading. Visuals stay unchanged.
    })
  }
}

onMounted(() => {
  predecodeAvatarArtwork()
  avatarTimer = window.setInterval(() => {
    avatarIndex.value = (avatarIndex.value + 1) % avatarUrls.length
  }, AVATAR_ROTATE_MS)
})
onBeforeUnmount(() => window.clearInterval(avatarTimer))
</script>

<template>
  <div
    class="wc-nameplate wc-plate wc-plate--sheen"
    :class="{
      'wc-nameplate--slow-fade': slowFade,
      'wc-nameplate--glitch': glitch,
      'wc-nameplate--blue-delivers': label === 'The Blue Delivers',
    }"
  >
    <span class="wc-nameplate-badge" aria-hidden="true">
      <Transition name="wc-nameplate-avatar">
        <img
          :key="activeAvatar.id"
          class="wc-nameplate-avatar"
          :class="`wc-nameplate-avatar--${activeAvatar.id}`"
          :src="avatarUrls[avatarIndex]"
          alt=""
        >
      </Transition>
    </span>
    <span class="wc-nameplate-text">
      <span class="wc-nameplate-detail wc-label">{{ detail }}</span>
      <Transition v-if="slowFade" name="wc-nameplate-label" mode="out-in">
        <span :key="label" class="wc-nameplate-label">
          <template v-for="(part, index) in labelParts(label)" :key="index">
            <span v-if="part.mono" class="wc-nameplate-label-mono">{{ part.text }}</span>
            <template v-else>{{ part.text }}</template>
          </template>
        </span>
      </Transition>
      <span v-else class="wc-nameplate-label">
        <template v-for="(part, index) in labelParts(label)" :key="index">
          <span v-if="part.mono" class="wc-nameplate-label-mono">{{ part.text }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.wc-nameplate {
  display: inline-flex;
  align-items: center;
  gap: 1.2rem;
  box-sizing: border-box;
  max-width: 100%;
  padding: 1.2rem 2.4rem 1.2rem 1.6rem;
  border-left: 2px solid var(--wc-gold);
}

.wc-nameplate-text {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

/* Bluefin emblem: a small, quiet roundel holding the rotating dino avatar. */
.wc-nameplate-badge {
  position: relative;
  flex: none;
  width: 4.4rem;
  height: 4.4rem;
  overflow: hidden;
  border-radius: 50%;
  border: 1px solid rgb(212 175 55 / 55%);
  background: rgb(10 14 22 / 78%);
  box-shadow: inset 0 0 0.8rem rgb(0 0 0 / 55%);
}

.wc-nameplate-avatar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.4rem;
  box-sizing: border-box;
  will-change: opacity, transform;
}

/* The roster art has intentionally different transparent margins. Normalize the
   visible silhouettes in the badge rather than forcing every source canvas into
   the same apparent size or letting the artwork drift off-center. */
.wc-nameplate-avatar--bob-torosaurus {
  transform: scale(1.08);
}

.wc-nameplate-avatar--karl {
  transform: scale(1.18) translateX(-2%);
}

.wc-nameplate-avatar--kentrosaurus {
  transform: scale(1.04) translateY(2%);
}

.wc-nameplate-avatar--alamosaurus {
  transform: scale(1.22) translateX(4%);
}

.wc-nameplate-avatar-enter-active,
.wc-nameplate-avatar-leave-active {
  transition:
    opacity 1.5s ease,
    transform 1.5s ease;
}

.wc-nameplate-avatar-enter-from,
.wc-nameplate-avatar-leave-to {
  opacity: 0;
}

.wc-nameplate-label {
  display: block;
  overflow: hidden;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wc-white);
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Quoted technical tokens in authored labels (e.g. humans/trying-their-best:v1)
   render in the terminal monospace instead of literal quotation marks. */
.wc-nameplate-label-mono {
  font-family: var(--wc-font-mono);
  font-weight: 600;
  text-transform: none;
}

.wc-nameplate--slow-fade .wc-nameplate-label {
  transition: opacity 0.2s ease;
}

.wc-nameplate--blue-delivers .wc-nameplate-label {
  color: #ffffff;
  font-size: clamp(2.5rem, 2.2rem + 1.2vw, 3.2rem);
  text-shadow: 0 0 10px rgb(255 255 255 / 35%);
}

/* Split-second glitch easter egg (the #nova4ever bursts): RGB-split shadows plus a
   stepped jitter so the label reads as signal interference while the cue holds. */
.wc-nameplate--glitch .wc-nameplate-label {
  animation: wc-nameplate-glitch 0.18s steps(2, jump-none) infinite;
}

@keyframes wc-nameplate-glitch {
  0% {
    transform: translateX(-2px) skewX(-4deg);
    text-shadow:
      2px 0 0 rgb(255 0 64 / 75%),
      -2px 0 0 rgb(0 220 255 / 75%);
    clip-path: polygon(0 0, 100% 0, 100% 42%, 0 42%, 0 58%, 100% 58%, 100% 100%, 0 100%);
  }

  50% {
    transform: translateX(2px) skewX(3deg);
    text-shadow:
      -3px 0 0 rgb(255 0 64 / 75%),
      3px 0 0 rgb(0 220 255 / 75%);
    clip-path: polygon(0 0, 100% 0, 100% 68%, 0 68%, 0 76%, 100% 76%, 100% 100%, 0 100%);
  }

  100% {
    transform: translateX(-1px);
    text-shadow:
      1px 0 0 rgb(255 0 64 / 75%),
      -1px 0 0 rgb(0 220 255 / 75%);
    clip-path: none;
  }
}

.wc-nameplate-label-enter-from,
.wc-nameplate-label-leave-to {
  opacity: 0;
}
</style>
