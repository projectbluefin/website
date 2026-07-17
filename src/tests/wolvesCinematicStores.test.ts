import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { useAuthStore } from '@/stores/auth'
import { useCinematicStore } from '@/stores/cinematic'

describe('cinematic store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts in the lobby on segment zero', () => {
    const store = useCinematicStore()
    expect(store.phase).toBe('lobby')
    expect(store.segmentIndex).toBe(0)
    expect(store.segment).toBe(CINEMATIC_SEGMENTS[0])
  })

  it('tracks per-segment and total elapsed time across handoffs', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.updateTime(120, 300)
    expect(store.segmentProgress).toBeCloseTo(0.4)
    expect(store.totalElapsed).toBe(120)

    store.advanceSegment()
    expect(store.segmentIndex).toBe(1)
    expect(store.segmentElapsed).toBe(0)
    expect(store.completedElapsed).toBe(300)

    store.updateTime(10, 200)
    expect(store.totalElapsed).toBe(310)
  })

  it('never advances past the final segment', () => {
    const store = useCinematicStore()
    for (let i = 0; i < 20; i++) {
      store.advanceSegment()
    }
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
    expect(store.isLastSegment).toBe(true)
  })

  it('clears crossfade and playing on finish', () => {
    const store = useCinematicStore()
    store.setPlaying(true)
    store.beginCrossfade()
    store.finish()
    expect(store.phase).toBe('finished')
    expect(store.playing).toBe(false)
    expect(store.crossfading).toBe(false)
  })

  it('patches spotify state without clobbering other fields', () => {
    const store = useCinematicStore()
    store.setSpotifyState({ status: 'playing', trackTitle: 'A', trackArtist: 'B' })
    store.setSpotifyState({ status: 'paused' })
    expect(store.spotify.trackTitle).toBe('A')
    expect(store.spotify.status).toBe('paused')
  })
})

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('persists and restores a session within its lifetime', () => {
    const store = useAuthStore()
    store.setTokens('spotify', 'token-1', 3600, 'refresh-1')
    expect(store.isConnected).toBe(true)

    setActivePinia(createPinia())
    const restored = useAuthStore()
    restored.restoreSession()
    expect(restored.provider).toBe('spotify')
    expect(restored.accessToken).toBe('token-1')
    expect(restored.refreshToken).toBe('refresh-1')
    expect(restored.isConnected).toBe(true)
  })

  it('does not restore expired sessions', () => {
    const store = useAuthStore()
    store.setTokens('youtube', 'token-2', -10)

    setActivePinia(createPinia())
    const restored = useAuthStore()
    restored.restoreSession()
    expect(restored.isConnected).toBe(false)
  })

  it('clears everything on disconnect', () => {
    const store = useAuthStore()
    store.setTokens('youtube', 'token-3', 3600)
    store.disconnect()
    expect(store.isConnected).toBe(false)
    expect(sessionStorage.getItem('wolves-cinematic-auth')).toBeNull()
  })
})
