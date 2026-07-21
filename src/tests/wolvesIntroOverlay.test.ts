import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import qrMakeMeAComic from '@/assets/svg/qr-makemeacomic.svg'
import { resetYoutubeIframeApiCacheForTests } from '../composables/useYoutubeIframeApi'
import { wolvesComicHeroShots } from '../data/wolves-comic-hero-shots'

const { default: WolvesIntroOverlay } = await import('../components/wolves/WolvesIntroOverlay.vue')

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

function mountOverlay(component: any, options: Record<string, any> = {}) {
  return mount(component, {
    ...options,
    global: {
      ...options.global,
      stubs: {
        Teleport: {
          template: '<div><slot /></div>',
        },
        ...(options.global?.stubs ?? {}),
      },
    },
  }) as any
}

type MockPlayerMethod<T extends (...args: any[]) => any = (...args: any[]) => any> = ReturnType<typeof vi.fn> & T

interface MockPlayerRecord {
  config: any
  videoId: string
  getDuration: MockPlayerMethod<() => number>
  getCurrentTime: MockPlayerMethod<() => number>
  loadVideoById: MockPlayerMethod<(video: string | { videoId: string, startSeconds?: number }) => void>
  pauseVideo: MockPlayerMethod<() => void>
  playVideo: MockPlayerMethod<() => void>
  seekTo: MockPlayerMethod<(seconds: number) => void>
  destroy: MockPlayerMethod<() => void>
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
  it('fades the whole overlay during the cinematic handoff', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'), 'utf8')

    expect(source).toMatch(/\.wolves-intro-overlay \{[\s\S]*?transition: opacity 0\.4s ease/)
    expect(source).toMatch(/\.wolves-intro-overlay--transparent-handoff \{[\s\S]*?opacity: 0/)
  })

  it('embeds the real YouTube video id, not a local file', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(players).toHaveLength(1)
    expect(players[0].videoId).toBe('BV3BZKbpBns')
    expect(wrapper.find('video').exists()).toBe(false)
  })

  it('resets a revisited video to its authored opening offset after YouTube is ready', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: {
        videos: [{
          ...videoOnlySequence[0],
          startOffset: 2,
        }],
      },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()

    expect(players[0].seekTo).toHaveBeenCalledWith(2, true)
    await wrapper.unmount()
  })

  it('pre-decodes companion artwork before its guardian cue appears', async () => {
    const images: Array<{ src: string, decode: ReturnType<typeof vi.fn> }> = []

    class PreloadedImage {
      src = ''
      decode = vi.fn(() => Promise.resolve())

      constructor() {
        images.push(this)
      }
    }

    vi.stubGlobal('Image', PreloadedImage)
    mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()

    expect(images.map(image => image.src)).toEqual([
      '/characters/karl.webp',
      '/characters/alamosaurus.webp',
      '/characters/bob-torosaurus.webp',
      '/characters/header/katharina.webp',
    ])
    expect(images.every(image => image.decode.mock.calls.length === 1)).toBe(true)
  })

  it('leaves the video unobscured when the player is paused', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-top-left-mask').exists()).toBe(false)
    expect(wrapper.find('.wolves-intro-overlay-pause-veil').exists()).toBe(false)

    players[0].pauseVideo()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-pause-veil').exists()).toBe(false)
    expect(wrapper.find('.wolves-intro-overlay').exists()).toBe(true)
  })

  it('disables YouTube captions so the burned-in subtitles stay the only captions', async () => {
    mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(players[0].config.playerVars.cc_load_policy).toBe(0)
    expect(players[0].config.playerVars.autohide).toBe(1)
  })

  it('advances to done and emits complete when the video ends', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    players[0].triggerEnded()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(wrapper.find('.wolves-intro-overlay').exists()).toBe(false)
  })

  it('never blocks the live experience when the embed errors', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    players[0].triggerError()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('shows the active overlay text cue synced to playback time', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.text()).toContain('Guardians')
  })

  it('renders a comic-book placeholder card for an active title-card cue', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
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
    const wrapper = mountOverlay(WolvesIntroOverlay, {
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

  it('spreads the comic hero shot rotation so no character repeats back-to-back', () => {
    const ids = wolvesComicHeroShots.map(shot => shot.id)

    expect(new Set(ids)).toEqual(new Set([
      'youre-holding-it-wrong-post1',
      'chonky-achillibator-pose1-post',
      'bluefin-original',
      'chonky-dakosaurus-bluefinskin',
      'jorge-custom-chonks-kentrosaurus-post1',
      'chonky-dromaeosaurus-bluefin',
      'dolly',
      'custom-chonk-jorge-concavenator-post1',
      'chonky-utahraptor-bluefinskin',
      'chonky-achillibator-pose2-post',
      'deinonychus-antirrhopus-and-achillobator-giganticus',
      'achillobator',
      'angry',
      'dakota',
      'devs',
      'intrigued',
      'leaping',
      'nest',
      'pride',
      'roaring',
      'utah',
      'jorge-custom-chonks-pivotraptor-post1',
      'youre-holding-it-wrong2-post2',
    ]))

    expect(ids).not.toEqual(expect.arrayContaining([
      'bob-torosaurus',
      'kentrosaurus',
      'karl',
      'chonky-alamo-blue',
      'chonky-alamo-vector',
      'alamosaurus',
      'torosaurus',
    ]))

    // The Jorge hero shots bookend the rotation.
    expect(ids[0]).toBe('youre-holding-it-wrong-post1')
    expect(ids[ids.length - 1]).toBe('youre-holding-it-wrong2-post2')

    // Same-character art must never sit adjacent, or the fast title-card
    // cycle reads as one dinosaur jumping between poses.
    const characterKey = (id: string) => id
      .replace(/-pose\d.*$/, '')
      .replace(/-post\d*$/, '')
      .replace(/-(blue|vector|bluefinskin|bluefin)$/, '')
      .replace(/^(bob|kaslin)-/, '')
      .replace(/^(bluefin)-.*$/, '$1')
    for (let index = 1; index < ids.length; index++) {
      expect(characterKey(ids[index]), `adjacent shots ${ids[index - 1]} / ${ids[index]}`)
        .not
        .toBe(characterKey(ids[index - 1]))
    }
  })

  it('sizes every QR hero shot from its measured visible artwork bounds', () => {
    for (const shot of wolvesComicHeroShots) {
      expect(shot.contentFrame).toEqual(expect.objectContaining({
        width: expect.any(Number),
        left: expect.any(Number),
        top: expect.any(Number),
      }))
      expect(shot.contentFrame.width).toBeGreaterThan(75)
      expect(shot.contentFrame.width).toBeLessThan(120)
    }
  })

  it('force-advances at maxDuration instead of waiting for the natural end', async () => {
    const cutoffSequence = [
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns', maxDuration: 1 },
      { id: 'wolves-epilogue', kind: 'text' as const, duration: 5 },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
    await flushPromises()

    // Transport is exposed to the app-level hero widget instead of an in-overlay bar.
    wrapper.vm.next()
    await flushPromises()

    expect(wrapper.emitted('complete')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Guardians')
  })

  it('next completes when there is no following segment', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })

    wrapper.vm.next()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('previous gating is published through status and previous steps back a segment', async () => {
    const cutoffSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 5 },
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns' },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cutoffSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, {
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
    const wrapper = mountOverlay(WolvesIntroOverlay, {
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

  it('keeps the Comic Hero card visible while the CC switch gates regular captions', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-intro',
          kind: 'video' as const,
          youtubeVideoId: 'BV3BZKbpBns',
          burnedInCaptions: [
            { text: 'Comic Hero Shots of YOU', start: 0, end: 5, comicHeroTitleCard: true },
            { text: 'We built a city none of us dared', start: 0, end: 5, requiresCaptionToggle: true },
          ],
        }],
      },
    })

    expect(wrapper.find('.wolves-intro-overlay-title-card').exists()).toBe(true)
    expect(wrapper.findAll('.wolves-intro-overlay-burned-caption')).toHaveLength(0)
    expect(wrapper.text()).toContain('Comic Hero Shots of YOU')
    expect(wrapper.text()).not.toContain('We built a city none of us dared')

    wrapper.vm.setCaptionsEnabled(true)
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-title-card').exists()).toBe(true)
    expect(wrapper.findAll('.wolves-intro-overlay-burned-caption')).toHaveLength(1)
    expect(wrapper.text()).toContain('We built a city none of us dared')
  })

  it('renders the makemeacomic QR only during the comic title-card cue', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.find('[data-comic-hero-qr-link]').exists()).toBe(false)

    const titleCardWrapper = mountOverlay(WolvesIntroOverlay, {
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

  it('renders the video layer without the old top-left mask or pause veil', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-top-left-mask').exists()).toBe(false)
    expect(wrapper.find('.wolves-intro-overlay-pause-veil').exists()).toBe(false)

    wrapper.vm.toggle()
    await flushPromises()

    expect(wrapper.find('.wolves-intro-overlay-pause-veil').exists()).toBe(false)
  })

  it('completes immediately for an empty video list instead of hanging', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: [] } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const highlightedText = wrapper.findAll('.wolves-intro-letter-highlight').map((node: { text: () => string }) => node.text()).join('')
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const text = wrapper.get('.wolves-intro-overlay-text').text()
    expect(text).toContain('Potential. Unlimited. Solution. Imagination.')
    expect(text).toContain('Probability?')
    expect(text).toContain('success. Respond')
  })

  it('renders Universal Blue Briefing cues as a Unix status display', () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    expect(wrapper.get('.wolves-intro-overlay-text').text()).toBe(`Now what's left of a proud order fights for survival
surrounded by predators`)
  })

  it('auto-advances once the authored duration elapses', async () => {
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 1 },
      { id: 'wolves-epilogue', kind: 'text' as const, duration: 1 },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
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
        { text: 'Behemoth Titan — Natali Vlatko — Shipwright of Kubernetes', start: 20, end: 25, position: 'right' as const, raised: true },
      ],
    },
  ]

  it('reads MAINTAINER // GUARDIAN, matching the lore-column dossier label', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.text()).toContain('MAINTAINER // GUARDIAN')
    expect(wrapper.text()).not.toContain('GUARDIAN // MAINTAINER')
  })

  it('renders Bob Killen with the documented dinosaur companion plate', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 6)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Bob Killen')
    expect(wrapper.find('.wolves-companion-plate').exists()).toBe(true)
    expect(wrapper.find('.wolves-companion-plate-art').attributes('src')).toContain('bob-torosaurus.webp')
    expect(wrapper.find('.wolves-companion-plate-label').text()).toBe('GUARDIAN BOND')
    expect(wrapper.find('.wolves-companion-plate-species').text()).toBe('Torosaurus latus')
    // No character sheet names Bob's torosaurus, so the plate carries no name line.
    expect(wrapper.find('.wolves-companion-plate-name').exists()).toBe(false)
    // The pair share one anchored row so the plates sit side by side.
    expect(wrapper.find('.wolves-guardian-plate-row .wolves-guardian-plate').exists()).toBe(true)
    expect(wrapper.find('.wolves-guardian-plate-row .wolves-companion-plate').exists()).toBe(true)
    // Bob's companion keeps the default bottom-right corner placement.
    expect(wrapper.find('.wolves-guardian-plate-row').classes()).not.toContain('wolves-guardian-plate-row-companion-below')
  })

  it('renders Alamo as an independently anchored companion card', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 21)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Natali Vlatko')
    expect(wrapper.find('.wolves-companion-plate-name').text()).toBe('Alamo')
    expect(wrapper.find('.wolves-companion-plate-art').attributes('src')).toContain('alamosaurus.webp')
    expect(wrapper.find('.wolves-companion-plate-art').classes()).toContain('wolves-companion-plate-art-alamo')
    expect(wrapper.find('.wolves-guardian-plate-row').classes()).not.toContain('wolves-guardian-plate-row-companion-below')
  })

  it('anchors every companion card independently to the lower-right screen edge', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'), 'utf8')
    const companionRules = [...overlay.matchAll(/\.wolves-companion-plate \{([\s\S]*?)\n\}/g)].map(match => match[1])

    expect(companionRules.some(rule =>
      rule.includes('position: fixed')
      && rule.includes('right: 5%')
      && rule.includes('bottom: 10%'),
    )).toBe(true)
    expect(overlay).not.toContain('wolves-companion-plate-art-lower-right')
  })

  it('splits the dinosaur out of the guardian plate into its own companion card', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'), 'utf8')
    const nameRule = overlay.match(/\.wolves-guardian-plate-name \{([\s\S]*?)\n\}/)?.[1]

    if (!nameRule) {
      throw new Error('Expected the Guardian name CSS template')
    }

    expect(nameRule).toContain('font-size: clamp(2.6rem, 1.9rem + 1.6vw, 3.6rem)')
    expect(nameRule).not.toContain('font-family:')
    // The compact in-name icon is fully replaced by the companion plate.
    expect(overlay).not.toContain('wolves-guardian-plate-dinosaur-icon')
  })

  it('locks Christoph Blecker\'s leader label to gold while the plate chrome stays blue', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'), 'utf8')
    const leaderRule = overlay.match(/\.wolves-guardian-plate\.wolves-guardian-plate-leader \{([\s\S]*?)\n\}/)?.[1]
    const leaderSelectors = [
      '.wolves-guardian-plate-burst',
      '.wolves-guardian-plate-horizon',
      '.wolves-guardian-plate-crest',
      '.wolves-guardian-plate-crest-outer',
      '.wolves-guardian-plate-crest-chevron',
      '.wolves-guardian-plate-label',
      '.wolves-guardian-plate-title',
    ]

    expect(leaderRule).toContain('border-color: rgb(56 189 248 / 55%)')
    expect(leaderRule).toContain('box-shadow: 0 0 24px rgb(56 189 248 / 20%)')
    for (const selector of leaderSelectors) {
      expect(overlay).toContain(`.wolves-guardian-plate-leader ${selector}`)
    }
    expect(overlay).toContain('stroke: #38bdf8')
    const leaderLabelRule = overlay.match(/\.wolves-guardian-plate-leader \.wolves-guardian-plate-label \{([\s\S]*?)\n\}/)?.[1]
    expect(leaderLabelRule).toContain('color: #facc15')
    expect(overlay).toContain('color: #bae6fd')
    expect(overlay).not.toContain('wolves-guardian-plate-name-gold')
    expect(overlay).toContain('wolves-companion-plate-art')
    // The artwork breaks out of the chamfered card: the card carries the
    // clip-path while the art rides above it with a negative overlap.
    const artRules = [...overlay.matchAll(/\.wolves-companion-plate-art \{([^}]*)\}/g)].map(m => m[1])
    const cardRules = [...overlay.matchAll(/\.wolves-companion-plate-card \{([^}]*)\}/g)].map(m => m[1])
    expect(artRules.some(rule => rule.includes('z-index: 1'))).toBe(true)
    expect(artRules.some(rule => rule.includes('-3.4rem'))).toBe(true)
    expect(cardRules.some(rule => rule.includes('clip-path'))).toBe(true)
  })

  it('names Kat Cosgrove\'s companion Karl with its authored species', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 2)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Kat Cosgrove')
    expect(wrapper.find('.wolves-companion-plate-name').text()).toBe('Karl')
    expect(wrapper.find('.wolves-companion-plate-species').text()).toBe('Amargasaurus cazaui')
    expect(wrapper.find('.wolves-companion-plate-art').attributes('src')).toContain('karl.webp')
  })

  it('switches to Kaslin\'s bonded companion during her authored window', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 11)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Kaslin Fields')
    expect(wrapper.find('.wolves-companion-plate-name').text()).toBe('Katerina')
    expect(wrapper.find('.wolves-companion-plate-species').text()).toBe('Kentrosaurus aethiopicus')
    expect(wrapper.find('.wolves-companion-plate-art').attributes('src')).toContain('header/katharina.webp')
  })

  it('renders no companion plate for a guardian with no documented dinosaur bond', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 16)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Laura Santamaria')
    expect(wrapper.find('.wolves-companion-plate').exists()).toBe(false)
  })
})
