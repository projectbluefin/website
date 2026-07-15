import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { resetYoutubeIframeApiCacheForTests } from '../composables/useYoutubeIframeApi'
import { wolvesCreatorShortsCassidyWilliams, wolvesCreatorShortsLindsayNikole } from '../data/wolves-creator-shorts'

const { default: WolvesCreatorShortsInterstitial } = await import('../components/wolves/WolvesCreatorShortsInterstitial.vue')

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

interface MockPlayerRecord {
  config: any
  videoId: string
  autoplay: boolean
  loadVideoById: ReturnType<typeof vi.fn>
  cueVideoById: ReturnType<typeof vi.fn>
  playVideo: ReturnType<typeof vi.fn>
  pauseVideo: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  triggerEnded: () => void
  triggerError: () => void
}

let players: MockPlayerRecord[] = []

function installMockIframeApi() {
  class MockPlayer {
    config: any
    videoId: string
    autoplay: boolean
    loadVideoById = vi.fn((id: string) => { this.videoId = id })
    cueVideoById = vi.fn((id: string) => { this.videoId = id })
    playVideo = vi.fn()
    pauseVideo = vi.fn()
    destroy = vi.fn()

    constructor(element: Element, config: any) {
      this.config = config
      this.videoId = config.videoId
      this.autoplay = config.playerVars?.autoplay === 1
      const mountNode = element as HTMLElement
      if (!mountNode.parentElement) {
        throw new Error('MockPlayer target must stay attached')
      }
      players.push(this as unknown as MockPlayerRecord)
    }

    triggerEnded() {
      this.config.events?.onStateChange?.({ data: (window as any).YT.PlayerState.ENDED, target: this })
    }

    triggerError() {
      this.config.events?.onError?.({ target: this })
    }
  }

  ;(window as any).YT = {
    Player: MockPlayer,
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  }
}

function resolveIframeApi() {
  installMockIframeApi()
  ;(window as any).onYouTubeIframeAPIReady?.()
}

function interstitialVisible() {
  // Teleported to document.body — see docs/skills/wolves-fullscreen-overlays.md.
  return document.body.querySelector('.wolves-creator-shorts-interstitial') !== null
}

function captionText(side: 'left' | 'right') {
  const slots = document.body.querySelectorAll('.wolves-creator-shorts-slot')
  const slot = side === 'left' ? slots[0] : slots[1]
  return slot?.querySelector('.wolves-creator-shorts-caption')?.textContent ?? ''
}

beforeEach(() => {
  players = []
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
  resetYoutubeIframeApiCacheForTests()
})

afterEach(() => {
  document.body.querySelectorAll('.wolves-creator-shorts-interstitial').forEach(node => node.remove())
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
  resetYoutubeIframeApiCacheForTests()
  vi.clearAllMocks()
})

describe('wolvesCreatorShortsInterstitial', () => {
  it('teleports to body, creates exactly two persistent players, and starts with Lindsay Nikole active', async () => {
    mount(WolvesCreatorShortsInterstitial)
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(interstitialVisible()).toBe(true)
    expect(players).toHaveLength(2)

    const [left, right] = players
    expect(left.videoId).toBe(wolvesCreatorShortsLindsayNikole[0].videoId)
    expect(left.autoplay).toBe(true)
    expect(right.videoId).toBe(wolvesCreatorShortsCassidyWilliams[0].videoId)
    expect(right.autoplay).toBe(false)

    expect(captionText('left')).toContain(wolvesCreatorShortsLindsayNikole[0].title)
    expect(captionText('right')).toContain(wolvesCreatorShortsCassidyWilliams[0].title)
  })

  it('ping-pongs to the already-cued other side when the active side ends, and preloads the finished side', async () => {
    mount(WolvesCreatorShortsInterstitial)
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const [left, right] = players

    left.triggerEnded()
    await flushPromises()
    await nextTick()

    // Still only two players -- no new player instances are created for a swap.
    expect(players).toHaveLength(2)
    expect(right.playVideo).toHaveBeenCalledTimes(1)
    expect(left.cueVideoById).toHaveBeenCalledWith(wolvesCreatorShortsLindsayNikole[1].videoId)
    expect(captionText('left')).toContain(wolvesCreatorShortsLindsayNikole[1].title)
    expect(captionText('right')).toContain(wolvesCreatorShortsCassidyWilliams[0].title)

    right.triggerEnded()
    await flushPromises()
    await nextTick()

    expect(left.playVideo).toHaveBeenCalledTimes(1)
    expect(right.cueVideoById).toHaveBeenCalledWith(wolvesCreatorShortsCassidyWilliams[1].videoId)
    expect(captionText('right')).toContain(wolvesCreatorShortsCassidyWilliams[1].title)
  })

  it('lets the longer list continue solo once the shorter one runs out, then emits complete once both are done', async () => {
    const wrapper = mount(WolvesCreatorShortsInterstitial)
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const [left, right] = players

    function getActiveSide(): 'left' | 'right' {
      const slots = document.body.querySelectorAll('.wolves-creator-shorts-slot')
      return slots[0]?.classList.contains('is-active') ? 'left' : 'right'
    }

    // Lindsay has 8 entries, Cassidy has 6 -- Cassidy's list must run out first, and Lindsay
    // must keep playing solo (via loadVideoById) for her last two entries before completing.
    const totalTurns = wolvesCreatorShortsLindsayNikole.length + wolvesCreatorShortsCassidyWilliams.length
    for (let turn = 0; turn < totalTurns; turn++) {
      expect(wrapper.emitted('complete')).toBeUndefined()
      const side = getActiveSide()
      ;(side === 'left' ? left : right).triggerEnded()
      await flushPromises()
      await nextTick()
    }

    // No third player was ever created -- the solo phase reuses the same two persistent players.
    expect(players).toHaveLength(2)
    expect(left.loadVideoById).toHaveBeenCalledWith(wolvesCreatorShortsLindsayNikole[7].videoId)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('never blocks the ping-pong when a side errors', async () => {
    mount(WolvesCreatorShortsInterstitial)
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const [left, right] = players
    left.triggerError()
    await flushPromises()
    await nextTick()

    expect(players).toHaveLength(2)
    expect(right.playVideo).toHaveBeenCalledTimes(1)
  })

  it('does not swap the active side when the still-inactive, preloaded side errors', async () => {
    mount(WolvesCreatorShortsInterstitial)
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const [left, right] = players

    // Cassidy (right) is inactive/preloaded at this point -- an error on her cued video must
    // only skip that one broken entry, never hand control to her or restart Lindsay's turn.
    right.triggerError()
    await flushPromises()
    await nextTick()

    expect(right.cueVideoById).toHaveBeenCalledWith(wolvesCreatorShortsCassidyWilliams[1].videoId)
    expect(right.playVideo).not.toHaveBeenCalled()
    expect(left.loadVideoById).not.toHaveBeenCalled()
    expect(captionText('left')).toContain(wolvesCreatorShortsLindsayNikole[0].title)
  })

  it('emits complete without ever mounting a player when the IFrame API fails to load entirely', async () => {
    document.head.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach(script => script.remove())
    delete (window as any).YT
    delete (window as any).onYouTubeIframeAPIReady

    const wrapper = mount(WolvesCreatorShortsInterstitial)
    await flushPromises()

    const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    expect(script).not.toBeNull()
    script?.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(players).toHaveLength(0)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
