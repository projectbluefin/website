<script setup lang="ts">
const emit = defineEmits<{ enter: [] }>()

const lobbyBackground = `${import.meta.env.BASE_URL}evening/night-sky.webp`
</script>

<template>
  <div class="wc-lobby" :style="{ '--wc-lobby-background': `url('${lobbyBackground}')` }">
    <div class="wc-lobby-frame wc-lobby-frame--left">
      <p class="wc-label wc-lobby-brand">
        PROJECT BLUEFIN
      </p>
      <h1 class="wc-lobby-title">
        BLUEFIN
      </h1>
      <div class="wc-hairline" />
      <p class="wc-lobby-sub">
        SEVEN PARTS · ONE TRANSMISSION
      </p>

      <p class="wc-lobby-status wc-label">
        SIGNAL READY · NO ACCOUNT REQUIRED
      </p>

      <button
        class="wc-lobby-enter wc-plate"
        type="button"
        @click="emit('enter')"
      >
        BEGIN TRANSMISSION
      </button>

      <blockquote class="wc-lobby-quote wc-plate wc-plate--sheen">
        <p>
          I've watched AI empower and destroy open source communities faster than
          anything yet. And it's getting faster. No one is talking, everyone is
          yelling past each other. I'm just as guilty as anyone.
        </p>
        <p>
          So I did what any good open source maintainer would do -- I turned to my
          friends. And together, we turned to metal. This project is designed to
          prove the value of the human spirity of creation. This is a collection of
          artists involved in Bluefin, who have been compensated for their work
          thanks to your donations, we hope you enjoy the world they've created.
          (If you don't like the metal then that's your problem.)
        </p>
        <div class="wc-lobby-quote-attribution">
          <span class="wc-lobby-quote-name">-- Jorge Castro //projectbluefin.io</span>
          <span class="wc-lobby-quote-detail">sabot-6 - Order of the Lost Saint - Die Vicesimo Primo mensis Iulii, Anno MMXXVI</span>
        </div>
      </blockquote>
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

.wc-lobby-frame--left {
  text-align: left;
}

.wc-lobby-brand {
  font-size: clamp(1.8rem, 1.8vw, 2.8rem);
  letter-spacing: 0.44em;
}

.wc-lobby-title {
  font-size: clamp(3.8rem, 7.5vw, 7.6rem);
  font-weight: 800;
  letter-spacing: 0.22em;
  margin-right: -0.22em; // optically recenters tracked uppercase
  line-height: 1.02;
  color: var(--wc-white);
}

.wc-lobby-frame--left .wc-lobby-title {
  margin-right: 0;
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
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    letter-spacing: 0.34em;
  }

  .wc-lobby-title {
    font-size: clamp(3.4rem, 11vw, 4.8rem);
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
