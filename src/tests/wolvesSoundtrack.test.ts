import type { WolvesSoundtrackManifest } from '../data/wolves-soundtrack'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loadWolvesSoundtrack } = vi.hoisted(() => ({
  loadWolvesSoundtrack: vi.fn<() => Promise<WolvesSoundtrackManifest>>(),
}))

vi.mock('../data/wolves-soundtrack', () => ({
  loadWolvesSoundtrack,
}))

const { default: WolvesSoundtrack } = await import('../components/wolves/WolvesSoundtrack.vue')

const soundtrackManifest: WolvesSoundtrackManifest = {
  source: {
    provider: 'youtube',
    playlistId: 'PLA78oiE-RGAE',
    playlistUrl: 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE',
    musicUrl: 'https://music.youtube.com/playlist?list=PLA78oiE-RGAE',
    spotifyUri: null,
  },
  tracks: [
    {
      id: 'LASru9j0oIc',
      title: '7 Days to the Wolves',
      artist: 'Nightwish',
      artwork: 'wolves-artwork/LASru9j0oIc.jpg',
      youtubeVideoId: 'LASru9j0oIc',
    },
    {
      id: 'amKIngGUvCk',
      title: 'Ghosts In The Mist',
      artist: 'Unleash The Archers',
      artwork: 'wolves-artwork/amKIngGUvCk.jpg',
      youtubeVideoId: 'amKIngGUvCk',
    },
  ],
}

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

interface MockPlayerRecord {
  config: any
  element: Element | string
  mountedNode: HTMLIFrameElement
  playlistIndex: number
  playVideo: ReturnType<typeof vi.fn>
  pauseVideo: ReturnType<typeof vi.fn>
  nextVideo: ReturnType<typeof vi.fn>
  previousVideo: ReturnType<typeof vi.fn>
  getPlaylistIndex: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  triggerReady: () => void
  triggerPlaylistItem: (index: number) => void
  triggerError: () => void
}

let players: MockPlayerRecord[] = []

function installMockIframeApi() {
  class MockPlayer {
    config: any
    element: Element | string
    mountedNode: HTMLIFrameElement
    playlistIndex = 0
    playVideo = vi.fn(() => {
      this.config.events?.onStateChange?.({
        data: (window as any).YT.PlayerState.PLAYING,
        target: this,
      })
    })

    pauseVideo = vi.fn(() => {
      this.config.events?.onStateChange?.({
        data: (window as any).YT.PlayerState.PAUSED,
        target: this,
      })
    })

    nextVideo = vi.fn()
    previousVideo = vi.fn()
    getPlaylistIndex = vi.fn(() => this.playlistIndex)
    destroy = vi.fn()

    constructor(element: Element | string, config: any) {
      this.element = element
      this.config = config
      const mountNode = element as HTMLElement
      if (!mountNode.parentElement) {
        throw new Error('MockPlayer target must stay attached')
      }

      const replacementPlayer = document.createElement('iframe')
      replacementPlayer.title = 'Mock YouTube Player'
      replacementPlayer.setAttribute('data-mock-youtube-player', String(players.length))
      mountNode.replaceWith(replacementPlayer)
      this.mountedNode = replacementPlayer
      players.push(this as unknown as MockPlayerRecord)
    }

    triggerReady() {
      this.config.events?.onReady?.({ target: this })
    }

    triggerPlaylistItem(index: number) {
      this.playlistIndex = index
      this.config.events?.onPlaylistItem?.({ target: this })
    }

    triggerError() {
      this.config.events?.onError?.({ target: this })
    }
  }

  ;(window as any).YT = {
    Player: MockPlayer,
    PlayerState: {
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  }
}

function resolveIframeApi() {
  installMockIframeApi()
  ;(window as any).onYouTubeIframeAPIReady?.()
}

function mockIframeApiFailure() {
  const script = document.querySelector(`script[src="${iframeApiSrc}"]`)
  expect(script).not.toBeNull()
  script?.dispatchEvent(new Event('error'))
}

beforeEach(() => {
  loadWolvesSoundtrack.mockResolvedValue(soundtrackManifest)
  players = []
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
  document.body.className = ''
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
})

afterEach(() => {
  document.body.className = ''
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
  vi.clearAllMocks()
})

describe('wolves soundtrack', () => {
  it('labels the release soundtrack as music to hunt by', () => {
    const wrapper = mount(WolvesSoundtrack)

    expect(wrapper.get('.soundtrack-label').text()).toBe('MUSIC TO HUNT BY')
  })

  it('renders disabled skip controls before the player is ready', () => {
    const wrapper = mount(WolvesSoundtrack)

    expect(wrapper.findAll('button[aria-label="Previous track"]')).toHaveLength(1)
    expect(wrapper.findAll('button[aria-label="Next track"]')).toHaveLength(1)
    expect(wrapper.get('button[aria-label="Previous track"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Next track"]').attributes('disabled')).toBeDefined()
  })

  it('uses native playlist controls and disables their boundaries', async () => {
    const wrapper = mount(WolvesSoundtrack)

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    const previousButtons = wrapper.findAll('button[aria-label="Previous track"]')
    const nextButtons = wrapper.findAll('button[aria-label="Next track"]')
    expect(previousButtons).toHaveLength(2)
    expect(nextButtons).toHaveLength(2)
    expect(previousButtons.every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(nextButtons.every(button => button.attributes('disabled') === undefined)).toBe(true)

    await wrapper.get('.soundtrack-controls-group button[aria-label="Next track"]').trigger('click')
    expect(players[0].nextVideo).toHaveBeenCalledOnce()

    players[0].triggerPlaylistItem(1)
    await flushPromises()

    expect(wrapper.findAll('button[aria-label="Previous track"]').every(button => button.attributes('disabled') === undefined)).toBe(true)
    expect(wrapper.findAll('button[aria-label="Next track"]').every(button => button.attributes('disabled') !== undefined)).toBe(true)

    await wrapper.get('.soundtrack-controls-group button[aria-label="Previous track"]').trigger('click')
    expect(players[0].previousVideo).toHaveBeenCalledOnce()
  })

  it('does not request the IFrame API until Start Soundtrack is clicked', async () => {
    const wrapper = mount(WolvesSoundtrack)

    expect(loadWolvesSoundtrack).not.toHaveBeenCalled()
    expect(document.querySelector(`script[src="${iframeApiSrc}"]`)).toBeNull()

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    expect(loadWolvesSoundtrack).toHaveBeenCalledTimes(1)
    expect(document.querySelector(`script[src="${iframeApiSrc}"]`)).not.toBeNull()
  })

  it('keeps the existing primary play button operable after playback starts', async () => {
    const wrapper = mount(WolvesSoundtrack)
    const primaryButton = wrapper.get('button.soundtrack-action')

    expect(wrapper.findAll('button.soundtrack-action')).toHaveLength(1)
    await primaryButton.trigger('click')
    await flushPromises()

    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.findAll('button.soundtrack-action')).toHaveLength(1)
    expect(wrapper.get('button.soundtrack-action').attributes('aria-label')).toBe('Pause soundtrack')

    await wrapper.get('button.soundtrack-action').trigger('click')
    expect(players[0].pauseVideo).toHaveBeenCalledTimes(1)
  })

  it('shows the full maintainer CTA with concise source actions during playback', async () => {
    const wrapper = mount(WolvesSoundtrack)

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.get('.soundtrack-cta').text()).toBe('Open Source is about supporting maintainers. Prove it.')
    expect(wrapper.get('.soundtrack-cta').classes()).not.toContain('truncate')
    expect(wrapper.get('a[aria-label="Open soundtrack playlist on YouTube"]').text()).toBe('Playlist')
    expect(wrapper.get('a[aria-label="Open soundtrack in YouTube Music"]').text()).toBe('Music')
  })

  it('keeps the same player while unrelated reader events occur', async () => {
    const wrapper = mount(WolvesSoundtrack)
    const persistentHost = wrapper.get('[data-testid="wolves-player-host"]').element

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    await wrapper.setProps({})

    expect(wrapper.get('[data-testid="wolves-player-host"]').element).toBe(persistentHost)
    expect(players).toHaveLength(1)
  })

  it('keeps the YouTube player hidden and renders an official lyrics link for the active track', async () => {
    const wrapper = mount(WolvesSoundtrack, { attachTo: document.body })

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    const playerShell = wrapper.get('.wolves-player-host-shell').element as HTMLElement
    const playerHost = wrapper.get('[data-testid="wolves-player-host"]').element as HTMLElement
    const lyricsLink = wrapper.get('[data-testid="official-lyrics-link"]')

    expect(playerHost.contains(players[0].mountedNode)).toBe(true)
    expect(playerShell.getAttribute('aria-hidden')).toBe('true')
    expect(players[0].config.width).toBe(200)
    expect(players[0].config.height).toBe(200)
    expect(window.getComputedStyle(playerShell).overflow).toBe('hidden')
    expect(lyricsLink.attributes('href')).toBe('https://www.nightwish.com/songs/7-days-to-the-wolves')
    expect(lyricsLink.attributes('target')).toBe('_blank')
    expect(lyricsLink.attributes('rel')).toBe('noopener noreferrer')

    wrapper.unmount()
  })

  it('shows the unavailable state instead of guessing a lyrics source', async () => {
    const wrapper = mount(WolvesSoundtrack)

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()
    players[0].triggerPlaylistItem(1)
    await flushPromises()

    expect(wrapper.text()).toContain('Official lyrics unavailable')
    expect(wrapper.find('[data-testid="official-lyrics-link"]').exists()).toBe(false)
  })

  it('updates the displayed track from playlist events instead of chapter props', async () => {
    const wrapper = mount(WolvesSoundtrack)

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.text()).toContain('7 Days to the Wolves')
    expect(wrapper.text()).toContain('Nightwish')

    players[0].triggerPlaylistItem(1)
    await flushPromises()

    expect(wrapper.text()).toContain('Ghosts In The Mist')
    expect(wrapper.text()).toContain('Unleash The Archers')
  })

  it('shows the music link and Premium notice when playback cannot initialize', async () => {
    const wrapper = mount(WolvesSoundtrack)

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    mockIframeApiFailure()
    await flushPromises()

    expect(wrapper.text()).toContain('Ad-free playback requires YouTube Premium')
    expect(wrapper.get('a[aria-label="Open soundtrack in YouTube Music"]').attributes('href')).toContain('music.youtube.com')
  })

  it('retries inside the same outer host after YouTube replaces the inner mount', async () => {
    const wrapper = mount(WolvesSoundtrack)
    const persistentHost = wrapper.get('[data-testid="wolves-player-host"]').element as HTMLElement

    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    await flushPromises()

    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.get('[data-testid="wolves-player-host"]').element).toBe(persistentHost)
    expect(wrapper.element.contains(persistentHost)).toBe(true)
    expect(persistentHost.contains(players[0].mountedNode)).toBe(true)

    players[0].triggerError()
    await flushPromises()

    expect(wrapper.text()).toContain('Playback could not initialize here.')

    await wrapper.get('.soundtrack-action').trigger('click')
    await flushPromises()

    expect(players[0].destroy).toHaveBeenCalledTimes(1)
    expect(players).toHaveLength(2)
    expect(wrapper.get('[data-testid="wolves-player-host"]').element).toBe(persistentHost)
    expect(wrapper.element.contains(persistentHost)).toBe(true)
    expect(persistentHost.contains(players[0].mountedNode)).toBe(false)
    expect(persistentHost.contains(players[1].mountedNode)).toBe(true)

    players[1].triggerReady()
    await flushPromises()

    expect(players[1].playVideo).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Open Source is about supporting maintainers. Prove it.')
  })
})
