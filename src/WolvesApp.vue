<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { refreshGoogleToken } from '@/auth/googleOauth'
import { completeSpotifyLogin, refreshSpotifyToken } from '@/auth/spotifyOauth'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import Nameplate from '@/components/wolves/cinematic/Nameplate.vue'
import { useSpotifyPlayback } from '@/composables/useSpotifyPlayback'
import { useAuthStore } from '@/stores/auth'
import { useCinematicStore } from '@/stores/cinematic'

const auth = useAuthStore()
const store = useCinematicStore()
const spotify = useSpotifyPlayback()

const stage = ref<InstanceType<typeof CinematicStage> | null>(null)
const audioEnabled = computed(() => auth.provider !== 'spotify')

let refreshTimer: ReturnType<typeof setInterval> | null = null

// Renew whichever provider token is active well before it expires. Spotify uses
// its refresh grant; Google (public SPA, no refresh token) silently re-requests
// against the live session and only surfaces an error if interaction is needed.
async function maybeRefreshToken() {
  if (!auth.isConnected || auth.expiresAt - Date.now() > 5 * 60 * 1000) {
    return
  }
  try {
    if (auth.provider === 'spotify' && auth.refreshToken) {
      const tokens = await refreshSpotifyToken(auth.refreshToken)
      auth.setTokens('spotify', tokens.accessToken, tokens.expiresIn, tokens.refreshToken)
    }
    else if (auth.provider === 'youtube') {
      const tokens = await refreshGoogleToken()
      auth.setTokens('youtube', tokens.accessToken, tokens.expiresIn)
    }
  }
  catch {
    auth.fail('Session expired — reconnect to continue')
  }
}

onMounted(async () => {
  auth.restoreSession()
  try {
    const tokens = await completeSpotifyLogin()
    if (tokens) {
      auth.setTokens('spotify', tokens.accessToken, tokens.expiresIn, tokens.refreshToken)
    }
  }
  catch (error) {
    auth.fail(error instanceof Error ? error.message : 'Spotify authorization failed')
  }
  refreshTimer = setInterval(maybeRefreshToken, 60 * 1000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

async function enterCinematic() {
  store.enterCinematic()
  await nextTick() // stage mounts with the new phase before players are created
  await stage.value?.start()
  if (auth.provider === 'spotify') {
    await spotify.start()
  }
  if (import.meta.env.DEV) {
    // Dev-only hook so browser-based boundary verification can drive the real player.
    ;(window as any).__wolvesCinematic = { seekTo: (s: number) => stage.value?.seekTo(s) }
  }
}

function restart() {
  window.location.reload()
}
</script>

<template>
  <div class="wolves-cinematic">
    <CinematicLobby v-if="store.phase === 'lobby'" @enter="enterCinematic" />

    <div v-else-if="store.phase === 'cinematic'" class="wc-runtime">
      <CinematicStage ref="stage" :audio-enabled="audioEnabled" />
      <MediaWidget @toggle-play="stage?.togglePlay()" />
    </div>

    <div v-else class="wc-finished">
      <Nameplate detail="END OF LINE" label="TRANSMISSION COMPLETE" />
      <button class="wc-control wc-finished-replay" type="button" aria-label="Replay" @click="restart">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wc-runtime {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}

.wc-finished {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  min-height: 100vh;
  min-height: 100dvh;
}

.wc-finished-replay {
  width: 5.6rem;
  height: 5.6rem;
}
</style>
