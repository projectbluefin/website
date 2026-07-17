<script setup lang="ts">
import type { AuthProvider } from '@/stores/auth'
import { computed } from 'vue'
import { beginGoogleLogin } from '@/auth/googleOauth'
import { beginSpotifyLogin } from '@/auth/spotifyOauth'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ enter: [] }>()

const auth = useAuthStore()

const statusLine = computed(() => {
  if (auth.status === 'error') {
    return auth.error || 'CONNECTION FAILED'
  }
  if (auth.status === 'connecting') {
    return 'ESTABLISHING LINK'
  }
  if (auth.isConnected) {
    return `LINK ESTABLISHED · ${auth.provider === 'spotify' ? 'SPOTIFY' : 'YOUTUBE'}`
  }
  return 'AWAITING AUTHORIZATION'
})

async function connect(provider: AuthProvider) {
  if (auth.status === 'connecting') {
    return
  }
  auth.beginConnecting(provider)
  try {
    if (provider === 'spotify') {
      // Full-page redirect; completeSpotifyLogin() picks the flow back up on return.
      await beginSpotifyLogin()
      return
    }
    const tokens = await beginGoogleLogin()
    auth.setTokens('youtube', tokens.accessToken, tokens.expiresIn)
  }
  catch (error) {
    auth.fail(error instanceof Error ? error.message : 'Authorization failed')
  }
}
</script>

<template>
  <div class="wc-lobby">
    <div class="wc-lobby-frame">
      <p class="wc-label">
        PROJECT BLUEFIN
      </p>
      <h1 class="wc-lobby-title">
        WOLVES
      </h1>
      <div class="wc-hairline" />
      <p class="wc-lobby-sub">
        SEVEN PARTS · ONE TRANSMISSION
      </p>

      <div class="wc-lobby-choices">
        <button
          class="wc-lobby-choice wc-plate wc-plate--sheen"
          type="button"
          :class="{ 'wc-lobby-choice--active': auth.provider === 'youtube' && auth.isConnected }"
          :disabled="auth.status === 'connecting'"
          @click="connect('youtube')"
        >
          <span class="wc-label">AUDIO LINK</span>
          <span class="wc-lobby-choice-name">YOUTUBE</span>
          <span class="wc-lobby-choice-hint">Soundtrack carried by the transmission itself</span>
        </button>
        <button
          class="wc-lobby-choice wc-plate wc-plate--sheen"
          type="button"
          :class="{ 'wc-lobby-choice--active': auth.provider === 'spotify' && auth.isConnected }"
          :disabled="auth.status === 'connecting'"
          @click="connect('spotify')"
        >
          <span class="wc-label">AUDIO LINK</span>
          <span class="wc-lobby-choice-name">SPOTIFY</span>
          <span class="wc-lobby-choice-hint">Soundtrack streamed in-browser (Premium required)</span>
        </button>
      </div>

      <p class="wc-lobby-status wc-label" :class="{ 'wc-lobby-status--error': auth.status === 'error' }">
        {{ statusLine }}
      </p>

      <button
        class="wc-lobby-enter wc-plate"
        type="button"
        :disabled="!auth.isConnected"
        @click="emit('enter')"
      >
        BEGIN TRANSMISSION
      </button>
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
    url('/evening/night-sky.webp') center / cover no-repeat;

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
  gap: 2rem;
  width: min(56rem, 100%);
  text-align: center;
}

.wc-lobby-title {
  font-size: clamp(4.8rem, 10vw, 8rem);
  font-weight: 800;
  letter-spacing: 0.28em;
  margin-right: -0.28em; // optically recenters tracked uppercase
  line-height: 1;
  color: var(--wc-white);
}

.wc-lobby-sub {
  font-family: var(--wc-font-mono);
  font-size: 1.2rem;
  letter-spacing: 0.4em;
  color: var(--wc-grey);
}

.wc-lobby-choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.6rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.wc-lobby-choice {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.8rem 1.6rem;
  text-align: left;
  cursor: pointer;
  color: var(--wc-white);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    border-color: var(--wc-gold);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.wc-lobby-choice--active {
  border-color: var(--wc-gold);
  background: rgb(200 180 137 / 10%);
}

.wc-lobby-choice-name {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.wc-lobby-choice-hint {
  font-size: 1.3rem;
  color: var(--wc-grey);
  line-height: 1.4;
}

.wc-lobby-status {
  min-height: 1.6rem;
}

.wc-lobby-status--error {
  color: #c96a5a;
}

.wc-lobby-enter {
  align-self: center;
  padding: 1.4rem 4.8rem;
  font-size: 1.5rem;
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
</style>
