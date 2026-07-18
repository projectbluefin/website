import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import qrMakeMeAComic from '@/assets/svg/qr-makemeacomic.svg'
import { resetYoutubeIframeApiCacheForTests } from '../composables/useYoutubeIframeApi'
import { wolvesComicHeroShots } from '../data/wolves-comic-hero-shots'

const { default: WolvesIntroOverlay } = await import('../components/wolves/WolvesIntroOverlay.vue')

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

interface MockPlayerRecord {
  config: any
  videoId: string
  getDuration: ReturnType<typeof vi.fn>
  getCurrentTime: ReturnType<typeof vi.fn>
  loadVideoById: ReturnType<typeof vi.fn>
  pauseVideo: ReturnType<typeof vi.fn>
  playVideo: ReturnType<typeof vi.fn>
  seekTo: ReturnType<typeof vi.fn>
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
    getDuration = vi.fn(() => 120)
    getCurrentTime = vi.fn(() => 0)
    loadVideoById = vi.fn((video: string | { videoId: string, startSeconds?: number }) => {
      const nextVideoId = typeof video === 'string' ? video : video.videoId
      const startSeconds = typeof video === 'string' ? 0 : (video.startSeconds ?? 0)
      this.videoId = nextVideoId
      this.getCurrentTime = vi.fn(() => startSeconds)
      this.config.events?.onStateChange?.({ data: (window as any).YT.PlayerState.PLAYING, target: this })
    })

    pauseVideo = vi.fn(() => {
      this.config.events?.onStateChange?.({ data: (window as any).YT.PlayerState.PAUSED, target: this })
    })

    playVideo = vi.fn(() => {
      this.config.events?.onStateChange?.({ data: (window as any).YT.PlayerState.PLAYING, target: this })
    })

    seekTo = vi.fn((seconds: number) => {
      this.getCurrentTime = vi.fn(() => seconds)
    })

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
    youtubeVideoId: 'BV3BZKbpBns',
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
    expect(players[0].videoId).toBe('BV3BZKbpBns')
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
          youtubeVideoId: 'BV3BZKbpBns',
          overlays: [{ text: 'Comic Hero Shots of YOU', start: 0, end: 5, comicHeroTitleCard: true }],
        }],
      },
    })

    expect(wrapper.text()).toContain('Comic Hero Shots of YOU')
    expect(wrapper.text()).toContain('Made by Paid Artists')
    expect(wrapper.get('[data-comic-hero-qr-dialogue]').text()).toBe('Immortalize a Maintainer')
    expect(wrapper.text()).toContain('makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-link]').attributes('href')).toBe('https://makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-link]').attributes('aria-label')).toBe('Open makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-link]').attributes('target')).toBe('_blank')
    expect(wrapper.get('[data-comic-hero-qr-link]').attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('[data-comic-hero-qr-link]').classes()).toContain('wolves-intro-overlay-title-card-qr')
    expect(wrapper.find('[data-comic-hero-qr-card]').exists()).toBe(true)
    expect(wrapper.get('[data-comic-hero-qr-image]').attributes('src')).toBe(qrMakeMeAComic)
    expect(wrapper.get('[data-comic-hero-qr-image]').attributes('alt')).toBe('QR code linking to makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-domain]').text()).toBe('makemeacomic.com')
  })

  it('cycles comic hero shots deterministically without repeating during the title-card cue', async () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          overlays: [{ text: 'Comic Hero Shots of YOU', start: 24, end: 38, comicHeroTitleCard: true }],
        }],
      },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    const cueStart = 24
    const cueDuration = 14
    const shotIds: string[] = []
    const shotSrcs: string[] = []
    const sampleCount = wolvesComicHeroShots.length
    const slotDuration = cueDuration / sampleCount

    for (let index = 0; index < sampleCount; index++) {
      players[0].getCurrentTime = vi.fn(() => cueStart + (index * slotDuration) + 0.01)
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()
      const shot = wrapper.get('[data-comic-hero-shot]')
      shotIds.push(shot.attributes('data-comic-hero-shot')!)
      shotSrcs.push(shot.attributes('src')!)
    }

    expect(shotIds).toEqual(wolvesComicHeroShots.map(s => s.id))
    expect(new Set(shotIds)).toHaveLength(sampleCount)
    expect(shotSrcs.every(src => src.includes('/characters/') && src.endsWith('.webp'))).toBe(true)
  })

  it('force-advances at maxDuration instead of waiting for the natural end', async () => {
    const cutoffSequence = [
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns', maxDuration: 1 },
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
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns', overlays: [{ text: 'Guardians', start: 0, end: 5 }] },
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
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns' },
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

  it('switches to the Ikora source with object-form loadVideoById while preserving native time', async () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          alternateYoutubeVideoId: 'BKm0TPqeOjY',
          alternateYoutubeVideoLabel: 'Ikora voice over',
          maxDuration: 95,
          alternateMaxDuration: 114,
        }],
      },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 37.25)
    await flushPromises()

    wrapper.vm.setVoiceOverEnabled(true)
    await flushPromises()

    expect(players[0].loadVideoById).toHaveBeenCalledWith({ videoId: 'BKm0TPqeOjY', startSeconds: 37.25 })
  })

  it('restores the paused state after switching sources and clamps to the target cutoff', async () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          alternateYoutubeVideoId: 'BKm0TPqeOjY',
          alternateYoutubeVideoLabel: 'Ikora voice over',
          maxDuration: 95,
          alternateMaxDuration: 70,
        }],
      },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    wrapper.vm.toggle()
    await flushPromises()
    players[0].pauseVideo.mockClear()
    players[0].playVideo.mockClear()
    players[0].getCurrentTime = vi.fn(() => 88)

    wrapper.vm.setVoiceOverEnabled(true)
    await flushPromises()

    expect(players[0].loadVideoById).toHaveBeenCalledWith({ videoId: 'BKm0TPqeOjY', startSeconds: 70 })
    expect(players[0].pauseVideo).toHaveBeenCalledOnce()
    expect(players[0].playVideo).not.toHaveBeenCalled()
  })

  it('keeps canonical captions visible during the comic title-card cue', async () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          burnedInCaptions: [
            { text: 'Comic Hero Shots of YOU', start: 0, end: 5, comicHeroTitleCard: true },
            { text: 'We built a city none of us dared', start: 0, end: 5 },
          ],
        }],
      },
    })

    expect(wrapper.find('.wolves-intro-overlay-title-card').exists()).toBe(true)
    expect(wrapper.findAll('.wolves-intro-overlay-burned-caption')).toHaveLength(1)
    expect(wrapper.text()).toContain('Comic Hero Shots of YOU')
    expect(wrapper.text()).toContain('We built a city none of us dared')
  })

  it('renders the makemeacomic QR only during the comic title-card cue', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.find('[data-comic-hero-qr-link]').exists()).toBe(false)

    const titleCardWrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          overlays: [{ text: 'Comic Hero Shots of YOU', start: 0, end: 5, comicHeroTitleCard: true }],
        }],
      },
    })

    expect(titleCardWrapper.find('[data-comic-hero-qr-link]').exists()).toBe(true)
  })

  it('renders the top-left mask and activates the pause veil only while paused', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-top-left-mask').exists()).toBe(true)
    expect(wrapper.get('.wolves-intro-overlay-pause-veil').classes()).not.toContain('wolves-intro-overlay-pause-veil-active')

    wrapper.vm.toggle()
    await flushPromises()

    expect(wrapper.get('.wolves-intro-overlay-pause-veil').classes()).toContain('wolves-intro-overlay-pause-veil-active')
  })

  it('completes immediately for an empty video list instead of hanging', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: [] } })
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})

describe('wolvesIntroOverlay text segments', () => {
  it('emits a cue-level nameplate title through status and restores the segment title outside that cue', async () => {
    const textSequence = [
      {
        id: 'wolves-prologue',
        kind: 'text' as const,
        duration: 2,
        overlays: [{
          text: 'In the space of a few days',
          start: 0,
          end: 1,
          nameplateTitle: 'From the Age of Dinosaurs to the Pinnacle of Humanity',
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const lastStatus = () => {
      const events = wrapper.emitted('status') as Array<[{
        nameplateTitle?: string
      }]>
      return events[events.length - 1][0]
    }

    expect(lastStatus().nameplateTitle).toBe('From the Age of Dinosaurs to the Pinnacle of Humanity')

    await vi.advanceTimersByTimeAsync(1200)
    await flushPromises()

    expect(lastStatus().nameplateTitle).toBeUndefined()
  })

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

  it('highlights only LIFE, DROSS, and GARDEN when a cue requests multiple exact words', async () => {
    const textSequence = [
      {
        id: 'wolves-prologue',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: `One to spread life,
and one to cull the dross
to shape the Garden of Earth.`,
          start: 0,
          end: 5,
          highlightSubstrings: ['life', 'dross', 'Garden'],
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const highlightedText = wrapper.findAll('.wolves-intro-letter-highlight').map(node => node.text()).join('')
    expect(highlightedText).toBe('lifedrossGarden')
  })

  it('preserves authored briefing punctuation when a cue opts in', async () => {
    const textSequence = [
      {
        id: 'universal-blue-briefing',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: `$ Investigate all possible avenues of open source success. Respond with most capable agent.
AN4-ChK-12: Potential. Unlimited. Solution. Imagination. Probability? Most certainly 100%. All other options exhausted.`,
          start: 0,
          end: 5,
          preservePunctuation: true,
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const text = wrapper.get('.wolves-intro-overlay-text').text()
    expect(text).toContain('Potential. Unlimited. Solution. Imagination.')
    expect(text).toContain('Probability?')
    expect(text).toContain('success. Respond')
  })

  it('renders Universal Blue Briefing cues as a Unix status display', () => {
    const wrapper = mount(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'universal-blue-briefing',
          kind: 'text' as const,
          duration: 5,
          overlays: [{
            text: 'Sustainability Probabilities: Declining',
            start: 0,
            end: 5,
            presentation: 'terminal' as const,
          }],
        }],
      },
    })

    expect(wrapper.get('.wolves-intro-overlay-text').classes()).toContain('wolves-intro-overlay-text-terminal')
    expect(wrapper.get('.wolves-intro-overlay-text').classes()).not.toContain('wolves-intro-overlay-text-dominant')
  })

  it('preserves authored punctuation when a cue opts in', async () => {
    const textSequence = [
      {
        id: 'bluefin-briefing',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: 'and this one. The Blue Delivers. Buckle up, nerds —',
          start: 0,
          end: 5,
          preservePunctuation: true,
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    expect(wrapper.get('.wolves-intro-overlay-text').text()).toBe('and this one. The Blue Delivers. Buckle up, nerds —')
  })
  it('still strips periods and commas for normal Gayane cues', async () => {
    const textSequence = [
      {
        id: 'wolves-prologue',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: `Now, what's left of a proud order fights for survival,
surrounded by predators.`,
          start: 0,
          end: 5,
        }],
      },
    ]
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    expect(wrapper.get('.wolves-intro-overlay-text').text()).toBe(`Now what's left of a proud order fights for survival
surrounded by predators`)
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
      youtubeVideoId: 'BV3BZKbpBns',
      overlays: [
        { text: 'Harbinger Titan — Kat Cosgrove — Defender Queen of the Lost', start: 0, end: 5 },
        { text: 'Void Warlock — Bob Killen — Reconciler of the Arcane', start: 5, end: 10 },
        { text: 'Arc Warlock — Kaslin Fields — Rage of the Paradox', start: 10, end: 15 },
        { text: 'Solar Hunter — Laura Santamaria — Paragon to the Order of 7', start: 15, end: 20 },
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

  it('renders Bob Killen with a paired Torosaurus panel instead of the old inline icon', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 6)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Bob Killen')
    expect(wrapper.text()).toContain('TOROSAURUS')
    expect(wrapper.text()).toContain('Torosaurus latus')
    expect(wrapper.find('.wolves-guardian-plate-dinosaur').exists()).toBe(true)
    expect(wrapper.find('.wolves-guardian-plate-dinosaur img').attributes('src')).toContain('bob-torosaurus.webp')
    expect(wrapper.find('.wolves-guardian-plate-dinosaur-icon').exists()).toBe(false)
  })

  it('keeps the recovered Weyland lower third and detailed mount treatment', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'), 'utf8')

    expect(overlay).toContain('font-family: var(--wc-font-weyland, \'Michroma\', sans-serif)')
    expect(overlay).toContain('font-family: var(--wc-font-weyland-mono, \'Share Tech Mono\', monospace)')
    expect(overlay).toContain('grid-template-columns: minmax(0, 1fr) minmax(13rem, 16rem)')
    expect(overlay).toContain('width: clamp(6.8rem, 5rem + 4vw, 10rem)')
    expect(overlay).toContain('height: clamp(6.8rem, 5rem + 4vw, 10rem)')
  })

  it('switches to Kaslin\'s flipped Torosaurus artwork during her authored window', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 11)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Kaslin Fields')
    expect(wrapper.text()).toContain('TOROSAURUS')
    expect(wrapper.text()).toContain('Torosaurus latus')
    expect(wrapper.find('.wolves-guardian-plate-dinosaur img').attributes('src')).toContain('kaslin-torosaurus.webp')
  })

  it('renders no dinosaur panel for a guardian with no documented dinosaur bond', async () => {
    const wrapper = mount(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 16)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Laura Santamaria')
    expect(wrapper.find('.wolves-guardian-plate-dinosaur').exists()).toBe(false)
  })
})
