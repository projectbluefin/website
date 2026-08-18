<script setup lang="ts">
import type { ExperienceManifest } from '@/config/experience-manifest'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import WolvesCharacterGallery from '@/components/wolves/WolvesCharacterGallery.vue'
import WolvesQrCodes from '@/components/wolves/WolvesQrCodes.vue'

const emit = defineEmits<{ enter: [], enterDirectorsCut: [], launchExperience: [manifest: ExperienceManifest], watchGuardian: [name: string] }>()

const lobbyBackground = `${import.meta.env.BASE_URL}evening/03-bluefin-night.webp`

// Mission waypoint: once the hero enter button scrolls away, a thin HUD bar
// keeps the trip through Wolves one click away above the maintainer dispatch.
const enterButton = ref<HTMLElement | null>(null)
const waypointVisible = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!enterButton.value || typeof IntersectionObserver === 'undefined') {
    return
  }
  observer = new IntersectionObserver(([entry]) => {
    waypointVisible.value = !entry.isIntersecting
  })
  observer.observe(enterButton.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="wc-lobby" :style="{ '--wc-lobby-background': `url('${lobbyBackground}')` }">
    <Transition name="wc-waypoint">
      <div v-if="waypointVisible" class="wc-waypoint wc-plate">
        <span class="wc-waypoint-title">SEVEN DAYS TO THE WOLVES</span>
        <span class="wc-label wc-waypoint-status">2 NOVEMBER 2026</span>
        <div class="wc-waypoint-entry">
          <span class="wc-cta-instruction">Click to begin the Wolves Experience</span>
          <button class="wc-waypoint-enter wc-cta--primary" type="button" @click="emit('enter')">
            <span class="wc-cta-icon" aria-hidden="true">▶</span>
            Meet your Teammates
          </button>
        </div>
      </div>
    </Transition>
    <div class="wc-lobby-frame">
      <p class="wc-label wc-lobby-brand">
        PROJECT BLUEFIN PRESENTS
      </p>
      <h1 class="wc-lobby-title">
        SEVEN DAYS<br>TO THE WOLVES
      </h1>
      <div class="wc-hairline" />
      <p class="wc-lobby-sub">
        SEVEN PARTS · ONE COMMUNITY · ONE DESTINY
      </p>

      <p class="wc-lobby-status wc-label">
        2 NOVEMBER 2026
      </p>

      <div class="wc-lobby-entry">
        <p class="wc-cta-instruction">
          Click to begin the Wolves Experience
        </p>
        <button
          ref="enterButton"
          class="wc-lobby-enter wc-cta--primary wc-plate"
          type="button"
          @click="emit('enter')"
        >
          <span class="wc-cta-icon" aria-hidden="true">▶</span>
          Meet your Teammates
        </button>
      </div>

      <div class="wc-lobby-dispatch">
        <span class="wc-lobby-dispatch-dot" aria-hidden="true" />
        <span class="wc-label">PRIORITY DISPATCH // MAINTAINERS NEEDED</span>
      </div>

      <WolvesCharacterGallery @watch-guardian="name => emit('watchGuardian', name)" />

      <blockquote class="wc-lobby-quote wc-plate wc-plate--sheen">
        <p>
          I've watched AI change open source communities faster than
          anything so far, and it's getting faster. No one is talking, everyone is
          yelling past each other.
        </p>
        <p>
          So I did what any good open source maintainer would do -- I turned to my
          friends. And together, we turned to metal. This project is designed to
          prove the value of the human spirit of creation. It features OSS maintainers immortalized in comic artwork and an accompanying musical. Someday I hope to play this together!
        </p>
        <p>
          This is a collection of artwork involving Bluefin including co-creators Jacob Schnurr and Andy Frazer. We hope to fund the growth of paleoart and open source in general.
        </p>
        <div class="wc-lobby-quote-attribution">
          <span class="wc-lobby-quote-name">-- Jorge Castro //projectbluefin.io</span>
          <span class="wc-lobby-quote-detail">sabot-6 - Order of the Lost Saint - Die Vicesimo Primo mensis Iulii, Anno MMXXVI</span>
          <br><br>
          <p>If you don't like the metal then that's your problem.</p>
        </div>
      </blockquote>
      <div class="wc-lobby-directors-cut">
        <p class="wc-lobby-directors-cut-copy">
          Bluefin's universe is just beginning, and its future is bleaker than presented here. Enjoy the longer original vision as it comes together:
        </p>
        <button
          class="wc-lobby-directors-cut-btn wc-plate"
          type="button"
          @click="emit('enterDirectorsCut')"
        >
          SEVEN DAYS TO THE WOLVES: DIRECTOR'S CUT
        </button>
      </div>
      <WolvesQrCodes />
      <WolvesBackCatalogue @launch="manifest => emit('launchExperience', manifest)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wc-lobby {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 4rem 2rem;
  background:
    linear-gradient(rgb(8 9 12 / 82%), rgb(8 9 12 / 94%)),
    var(--wc-lobby-background) center / cover no-repeat;

  // Sparse angular line work; atmosphere over decoration.
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 22vw;
    height: 1px;
    background: var(--wc-line);
  }

  &::before {
    top: 12%;
    left: 6%;
    transform: rotate(-24deg);
  }

  &::after {
    bottom: 14%;
    right: 6%;
    transform: rotate(-24deg);
  }
}

.wc-lobby-frame {
  display: flex;
  flex-direction: column;
  gap: clamp(1.6rem, 2.4vh, 2.6rem);
  width: min(78rem, 100%);
  text-align: center;
}

// Tactical HUD bar pinned once the hero enter button scrolls away.
.wc-waypoint {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  width: min(78rem, calc(100% - 2rem));
  margin-top: 0.6rem;
  padding: 0.7rem 1.6rem;
}

.wc-waypoint-title {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--wc-white);
  white-space: nowrap;
}

.wc-waypoint-entry,
.wc-lobby-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.wc-lobby-entry {
  align-self: center;
}

.wc-cta-instruction {
  margin: 0;
  font-family: var(--wc-font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: var(--wc-grey);
}

.wc-waypoint-status {
  font-size: 1rem;
}

.wc-waypoint-enter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 0.5rem 1.6rem;
  border: 1px solid var(--wc-gold);
  background: var(--wc-gold);
  font-family: var(--wc-font-mono);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--wc-bg);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover,
  &:focus-visible {
    background: var(--wc-bg);
    color: var(--wc-gold);
  }
}

.wc-waypoint-enter-active,
.wc-waypoint-leave-active {
  transition: opacity 0.2s ease;
}

.wc-waypoint-enter-from,
.wc-waypoint-leave-to {
  opacity: 0;
}

// Dispatch strip: hands the reader from the trip to the maintainer call.
.wc-lobby-dispatch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.2rem;
}

.wc-lobby-dispatch-dot {
  width: 0.8rem;
  height: 0.8rem;
  background: var(--wc-gold);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  animation: wc-dispatch-pulse 1.6s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes wc-dispatch-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.25;
  }
}

.wc-lobby-brand {
  font-size: clamp(1rem, 0.9vw, 1.35rem);
  letter-spacing: 0.44em;
  margin-bottom: -1.2rem;
}

.wc-lobby-title {
  font-size: clamp(3.6rem, 6vw, 6.4rem);
  font-weight: 800;
  letter-spacing: 0.22em;
  margin-right: -0.22em; // optically recenters tracked uppercase
  line-height: 1.02;
  color: var(--wc-white);
}

.wc-lobby-sub {
  font-family: var(--wc-font-mono);
  font-size: clamp(1.2rem, 1.35vw, 1.6rem);
  letter-spacing: 0.34em;
  color: var(--wc-grey);
}

.wc-lobby-status {
  min-height: 1.6rem;
  font-size: clamp(1.05rem, 1.05vw, 1.25rem);
}

.wc-lobby-enter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.4rem 4.8rem;
  font-size: clamp(1.5rem, 1.45vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.3em;
  background: var(--wc-gold);
  color: var(--wc-bg);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    background: var(--wc-bg);
    color: var(--wc-gold);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.wc-cta-icon {
  display: inline-grid;
  flex: 0 0 auto;
  width: 1.55em;
  aspect-ratio: 1;
  place-items: center;
  background: var(--wc-bg);
  color: var(--wc-gold);
  font-size: 0.8em;
  line-height: 1;
}

.wc-cta--primary:hover:not(:disabled) .wc-cta-icon,
.wc-cta--primary:focus-visible .wc-cta-icon {
  background: var(--wc-gold);
  color: var(--wc-bg);
}

.wc-lobby-quote {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-top: 1.2rem;
  padding: 2rem 2.4rem;
  border-left: 2px solid var(--wc-gold);
  text-align: left;

  p {
    font-size: 1.4rem;
    font-style: italic;
    line-height: 1.6;
    color: var(--wc-white);
  }
}

.wc-lobby-quote-attribution {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 1rem;
  border-top: 1px solid var(--wc-line);
}

.wc-lobby-quote-name {
  font-family: var(--wc-font-mono);
  font-size: 1.2rem;
  letter-spacing: 0.14em;
  color: var(--wc-gold);
}

.wc-lobby-quote-detail {
  font-family: var(--wc-font-mono);
  font-size: 1.05rem;
  letter-spacing: 0.1em;
  color: var(--wc-grey);
}

.wc-lobby-directors-cut {
  display: flex;
  flex-direction: column;
  align-self: center;
  gap: 1.4rem;
  width: min(100%, 58rem);
  margin-top: 1.2rem;
  padding: 2rem 2.4rem;
  border-left: 2px solid var(--wc-gold);
  text-align: left;
}

.wc-lobby-directors-cut-copy {
  margin: 0;
  font-size: clamp(1.25rem, 1.25vw, 1.45rem);
  line-height: 1.58;
  color: var(--wc-white);
  text-wrap: balance;
}

.wc-lobby-directors-cut-btn {
  align-self: center;
  padding: 1.2rem 3rem;
  font-family: var(--wc-font-mono);
  font-size: clamp(1.2rem, 1.2vw, 1.5rem);
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--wc-gold);
  background: transparent;
  border: 1px solid var(--wc-gold);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    background: var(--wc-gold);
    color: var(--wc-bg);
  }
}

@media (max-width: 640px) {
  .wc-lobby {
    padding: 3rem 1.4rem;
  }

  .wc-lobby-frame {
    gap: 1.5rem;
  }

  .wc-lobby-brand {
    font-size: clamp(1rem, 2.5vw, 1.3rem);
    letter-spacing: 0.34em;
    margin-bottom: -0.9rem;
  }

  .wc-lobby-title {
    font-size: clamp(3.2rem, 11vw, 4.8rem);
    letter-spacing: 0.18em;
    margin-right: -0.18em;
  }

  .wc-lobby-sub {
    letter-spacing: 0.24em;
  }

  .wc-lobby-enter {
    width: 100%;
    max-width: 34rem;
    padding-inline: 1.8rem;
  }

  .wc-lobby-quote {
    padding: 1.8rem;
  }

  .wc-lobby-directors-cut {
    gap: 1.1rem;
    margin-top: 1rem;
    padding: 1.8rem;
  }

  .wc-lobby-directors-cut-copy {
    font-size: 1.1rem;
    line-height: 1.6;
  }

  .wc-lobby-directors-cut-btn {
    width: 100%;
    max-width: 34rem;
    padding-inline: 1.8rem;
  }

  .wc-waypoint {
    gap: 0.8rem;
    padding: 0.6rem 1rem;
  }

  .wc-waypoint-title {
    font-size: 1rem;
    letter-spacing: 0.14em;
  }

  .wc-waypoint-status {
    display: none;
  }
}
</style>
