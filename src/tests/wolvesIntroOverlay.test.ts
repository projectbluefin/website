import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetYoutubeIframeApiCacheForTests } from '../composables/useYoutubeIframeApi'

const { default: WolvesIntroOverlay } = await import('../components/wolves/WolvesIntroOverlay.vue')

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

interface MockPlayerRecord {
  config: any
  videoId: string
  getCurrentTime: ReturnType<typeof vi.fn>
  pauseVideo: ReturnType<typeof vi.fn>
  playVideo: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  triggerReady: () => void
  triggerEnded: () => void
  triggerError: () => void
}

let players: MockPlayerRecord[] = []

function installMockIframeApi() {
  class MockPlayer {
    config: any
    videoId: string
    getCurrentTime = vi.fn(() => 0)
    pauseVideo = vi.fn()
    playVideo = vi.fn()
    destroy = vi.fn()

    constructor(element: Element, config: any) {
      this.config = config
      this.videoId = config.videoId
      const mountNode = element as HTMLElement
      if (!mountNode.parentElement) {
        throw new Error('MockPlayer target must stay attached')
      }
      players.push(this as unknown as MockPlayerRecord)
    }

    triggerReady() {
      this.config.events?.onReady?.({ target: this })
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

beforeEach(() => {
  players = []
  vi.useFakeTimers()
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
  resetYoutubeIframeApiCacheForTests()
})

afterEach(() => {
  vi.useRealTimers()
  document.head.querySelectorAll(`script[src="${iframeApiSrc}"]`).forEach(script => script.remove())
  delete (window as any).YT
  delete (window as any).onYouTubeIframeAPIReady
  resetYoutubeIframeApiCacheForTests()
  vi.clearAllMocks()
})

const videoOnlySequence = [
  {
    id: 'wolves-intro',
    kind: 'video' as const,
    youtubeVideoId: 'BKm0TPqeOjY',
    overlays: [{ text: 'Guardians', start: 0, end: 5 }],
  },
]

describe('wolvesIntroOverlay video segments', () => {
  it('embeds the real YouTube video id, not a local file', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(players).toHaveLength(1)
    expect(players[0].videoId).toBe('BKm0TPqeOjY')
    expect(wrapper.find('video').exists()).toBe(false)
  })

  it('disables YouTube captions so the burned-in subtitles stay the only captions', async () => {
    mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(players[0].config.playerVars.cc_load_policy).toBe(0)
  })

  it('advances to done and emits complete when the video ends', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    players[0].triggerEnded()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(wrapper.find('.wolves-intro-overlay').exists()).toBe(false)
  })

  it('never blocks the live experience when the embed errors', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    players[0].triggerError()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('shows the active overlay text cue synced to playback time', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.text()).toContain('Guardians')
  })

  it('renders a comic-book placeholder card for an active title-card cue', async () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BKm0TPqeOjY',
          overlays: [{ text: 'Comic Hero Shots of YOU', start: 0, end: 5, comicHeroTitleCard: true }],
        }],
      },
    })

    expect(wrapper.text()).toContain('Comic Hero Shots of YOU')
    expect(wrapper.text()).toContain('Made by Paid Artists')
  })

  it('force-advances at maxDuration instead of waiting for the natural end', async () => {
    const cutoffSequence = [
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BKm0TPqeOjY', maxDuration: 1 },
      { id: 'wolves-epilogue', kind: 'text' as const, duration: 5 },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].getCurrentTime = vi.fn(() => 2)
    players[0].triggerReady()

    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(players[0].destroy).toHaveBeenCalled()
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('next advances one segment at a time instead of jumping straight to complete', async () => {
    const cutoffSequence = [
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BKm0TPqeOjY', overlays: [{ text: 'Guardians', start: 0, end: 5 }] },
      { id: 'wolves-epilogue', kind: 'text' as const, duration: 5 },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
    await flushPromises()

    // Transport is exposed to the app-level hero widget instead of an in-overlay bar.
    wrapper.vm.next()
    await flushPromises()

    expect(wrapper.emitted('complete')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Guardians')
  })

  it('next completes when there is no following segment', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })

    wrapper.vm.next()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('previous gating is published through status and previous steps back a segment', async () => {
    const cutoffSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 5 },
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BKm0TPqeOjY' },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
    await flushPromises()

    // Gating is published through the status emit for the hero widget.
    const lastStatus = () => {
      const events = wrapper.emitted('status') as Array<[{ canGoPrevious: boolean }]>
      return events[events.length - 1][0]
    }
    expect(lastStatus().canGoPrevious).toBe(false)

    wrapper.vm.next()
    await flushPromises()

    expect(lastStatus().canGoPrevious).toBe(true)

    wrapper.vm.previous()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-player').exists()).toBe(false)
  })

  it('pauses and resumes the Destiny segment through the exposed transport', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    wrapper.vm.toggle()
    await flushPromises()
    expect(players[0].pauseVideo).toHaveBeenCalledOnce()

    wrapper.vm.toggle()
    await flushPromises()
    expect(players[0].playVideo).toHaveBeenCalledOnce()
  })

  it('completes immediately for an empty video list instead of hanging', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: [] } })
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})

describe('wolvesIntroOverlay text segments', () => {
  it('pauses and resumes the prologue through the exposed transport', async () => {
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 1 },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(200)
    wrapper.vm.toggle()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(wrapper.emitted('complete')).toBeUndefined()

    wrapper.vm.toggle()
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('renders a black screen with no YouTube player for a video-less text segment', async () => {
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 5, overlays: [{ text: 'Prologue', start: 0, end: 5 }] },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-blackscreen').exists()).toBe(true)
    expect(wrapper.text()).toContain('Prologue')
  })

  it('keeps a bottom-right text cue out of the top placement', async () => {
    const textSequence = [
      {
        id: 'wolves-prologue',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: 'One to spread life, and one to cull the dross to shape the garden',
          start: 0,
          end: 5,
          backgroundCrossfade: [{ day: 'day.webp', night: 'night.webp' }],
          textPosition: 'bottom-right' as const,
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const text = wrapper.get('.wolves-intro-overlay-text')
    expect(text.classes()).toContain('wolves-intro-overlay-text-bottom-right')
    expect(text.classes()).not.toContain('wolves-intro-overlay-text-top')
  })

  it('auto-advances once the authored duration elapses', async () => {
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 1 },
      { id: 'wolves-epilogue', kind: 'text' as const, duration: 1 },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('mounts a background-only audio embed when audioYoutubeVideoId is set', async () => {
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 45, audioYoutubeVideoId: 'EB3IokHelRk' },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(players).toHaveLength(1)
    expect(players[0].videoId).toBe('EB3IokHelRk')
    expect(wrapper.find('video').exists()).toBe(false)
  })
})

describe('wolvesIntroOverlay guardian plate', () => {
  const guardianPlateSequence = [
    {
      id: 'wolves-intro',
      kind: 'video' as const,
      youtubeVideoId: 'BKm0TPqeOjY',
      overlays: [
        { text: 'Harbinger Titan — Kat Cosgrove — Defender Queen of the Lost', start: 0, end: 5 },
        { text: 'Void Warlock — Robert Killen — Reconciler of the Arcane', start: 5, end: 10 },
      ],
    },
  ]

  it('reads MAINTAINER // GUARDIAN, matching the lore-column dossier label', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.text()).toContain('MAINTAINER // GUARDIAN')
    expect(wrapper.text()).not.toContain('GUARDIAN // MAINTAINER')
  })
})
