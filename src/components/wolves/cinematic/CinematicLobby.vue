<script setup lang="ts">
import type { ExperienceManifest } from '@/config/experience-manifest'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import WolvesQrCodes from '@/components/wolves/WolvesQrCodes.vue'

const emit = defineEmits<{ enter: [], launchExperience: [manifest: ExperienceManifest] }>()

const lobbyBackground = `${import.meta.env.BASE_URL}evening/03-bluefin-night.webp`
</script>

<template>
  <div class="wc-lobby" :style="{ '--wc-lobby-background': `url('${lobbyBackground}')` }">
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
        COMING IN 2027
      </p>

      <button
        class="wc-lobby-enter wc-plate"
        type="button"
        @click="emit('enter')"
      >
        MEET YOUR TEAMMATES
      </button>

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
  align-self: center;
  padding: 1.4rem 4.8rem;
  font-size: clamp(1.5rem, 1.45vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--wc-gold);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    background: var(--wc-gold);
    color: var(--wc-bg);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
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
}
</style>
