import type { IntroOverlayTextCue } from '../data/wolves-intro-sequence'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetYoutubeIframeApiCacheForTests } from '../composables/useYoutubeIframeApi'
import { wolvesComicHeroShots } from '../data/wolves-comic-hero-shots'
import {
  DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
  DIRECTORS_CUT_DESTINY_CONCEPTS,
} from '../data/wolves-directors-cut-artwork'
import {
  buildDirectorsCutPrologueSegment,
  buildDirectorsCutVideoSequence,
  DIRECTORS_CUT_DESTINY_SEGMENT_ID,
  DIRECTORS_CUT_HANDOFF_HOLD_MAX_MS,
  DIRECTORS_CUT_IKORA_PREWARM_SECOND,
  DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
  DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS,
  DIRECTORS_CUT_TEXT_FADE_SECONDS,
  IKORA_LAST_CONTENT_SECOND,
  IKORA_RATING_CARD_SECONDS,
  IKORA_SOURCE_VIDEO_ID,
  TRIBULATION_TRACK_SECONDS,
} from '../data/wolves-directors-cut-intro'
import {
  buildIntroVideoSequence,
  STANDARD_DESTINY_SEGMENT_ID,
  TEXT_SEGMENT_END_SLACK_SECONDS,
  TEXT_SEGMENT_STALL_GRACE_SECONDS,
} from '../data/wolves-intro-sequence'

const { default: WolvesIntroOverlay } = await import('../components/wolves/WolvesIntroOverlay.vue')

const iframeApiSrc = 'https://www.youtube.com/iframe_api'

interface IntroStatusSnapshot {
  segmentId: string
  currentTime: number
  showVoiceOverToggle?: boolean
  voiceOverEnabled?: boolean
  showCaptionToggle?: boolean
  captionsEnabled?: boolean
}

/** The overlay's most recent published status, which names the segment currently on stage. */
function latestStatus(wrapper: any): IntroStatusSnapshot {
  const events = wrapper.emitted('status') as Array<[IntroStatusSnapshot]>
  return events[events.length - 1][0]
}

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
  cueVideoById: MockPlayerMethod<(video: string | { videoId: string, startSeconds?: number }) => void>
  getVideoData: MockPlayerMethod<() => { video_id?: string } | undefined>
  mute: MockPlayerMethod<() => void>
  unMute: MockPlayerMethod<() => void>
  isMuted: MockPlayerMethod<() => boolean>
  /** The second this player was cued to and parked at, or null if it was never cued. */
  cuedAt: number | null
  /** The player's live mute latch, which volume alone does not answer. */
  muted: boolean
  /** Every mute/unmute actually pushed to the player, in order. */
  muteLog: boolean[]
  setVolume: MockPlayerMethod<(volume: number) => void>
  getVolume: MockPlayerMethod<() => number>
  destroy: MockPlayerMethod<() => void>
  /** Every volume level actually pushed to the player, in order. */
  volumeLog: number[]
  /** The player's live volume level (0–100). */
  volume: number
  /** The volume the player was sitting at when `destroy()` landed, or null if still alive. */
  destroyedAtVolume: number | null
  currentSeconds: number
  /** Every caption module name actually unloaded, in order. */
  unloadedModules: string[]
  unloadModule: MockPlayerMethod<(module: string) => void>
  setCurrentTime: (seconds: number) => void
  triggerReady: () => void
  /**
   * Fire `onApiChange`, which is how the caption module actually arrives: the
   * player reports it after the stream's caption track resolves, well after
   * `onReady`. A double without it cannot see a regression that only unloads
   * captions once.
   */
  triggerApiChange: () => void
  triggerEnded: () => void
  triggerError: () => void
}

let players: MockPlayerRecord[] = []

function installMockIframeApi() {
  class MockPlayer {
    config: any
    videoId: string
    currentSeconds = 0
    getDuration = vi.fn(() => 120)
    getCurrentTime = vi.fn(() => 0)
    loadVideoById = vi.fn((video: string | { videoId: string, startSeconds?: number }) => {
      const nextVideoId = typeof video === 'string' ? video : video.videoId
      const startSeconds = typeof video === 'string' ? 0 : (video.startSeconds ?? 0)
      this.videoId = nextVideoId
      this.currentSeconds = startSeconds
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
      this.currentSeconds = seconds
      this.getCurrentTime = vi.fn(() => seconds)
    })

    /**
     * A cue is not a load: the real embed stages the media and stays parked, publishing CUED
     * rather than PLAYING. A double that reported PLAYING here would make a prewarmed player
     * indistinguishable from a promoted one, which is the whole thing the prewarm tests check.
     */
    cueVideoById = vi.fn((video: string | { videoId: string, startSeconds?: number }) => {
      const nextVideoId = typeof video === 'string' ? video : video.videoId
      const startSeconds = typeof video === 'string' ? 0 : (video.startSeconds ?? 0)
      this.videoId = nextVideoId
      this.cuedAt = startSeconds
      this.currentSeconds = startSeconds
      this.getCurrentTime = vi.fn(() => startSeconds)
      this.config.events?.onStateChange?.({ data: (window as any).YT.PlayerState.CUED, target: this })
    })

    getVideoData = vi.fn(() => ({ video_id: this.videoId }))

    /**
     * Modules the overlay asked the player to tear out. The real embed exposes
     * `unloadModule` for this; a double without it would let a regression that
     * stops suppressing YouTube's captions pass silently.
     */
    unloadedModules: string[] = []

    unloadModule = vi.fn((module: string) => {
      this.unloadedModules.push(module)
    })

    cuedAt: number | null = null
    muted = false
    muteLog: boolean[] = []

    mute = vi.fn(() => {
      this.muted = true
      this.muteLog.push(true)
    })

    unMute = vi.fn(() => {
      this.muted = false
      this.muteLog.push(false)
    })

    isMuted = vi.fn(() => this.muted)

    volume = 100
    volumeLog: number[] = []
    destroyedAtVolume: number | null = null

    setVolume = vi.fn((level: number) => {
      this.volume = level
      this.volumeLog.push(level)
    })

    getVolume = vi.fn(() => this.volume)

    destroy = vi.fn(() => {
      this.destroyedAtVolume = this.volume
    })

    /**
     * Move the transport's own clock. A double whose clock never runs makes every timing
     * assertion vacuously true, so fade tests drive this together with the fake timers.
     */
    setCurrentTime(seconds: number) {
      this.currentSeconds = seconds
      this.getCurrentTime = vi.fn(() => seconds)
    }

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

    /**
     * The real player fires this when it loads or unloads a module — which is
     * how the caption module arrives, well after `onReady`, once the stream's
     * own caption track resolves.
     */
    triggerApiChange() {
      this.config.events?.onApiChange?.({ target: this })
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
  // Silent text cards measure real elapsed time via performance.now(), so it has to
  // advance with the fake clock (same config the dual-buffer suite uses).
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'performance'],
  })
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
    expect(players[0].config.playerVars.controls).toBe(0)
  })

  it('unloads the caption module, because cc_load_policy is only a default', async () => {
    mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    // A viewer whose YouTube account prefers captions gets them regardless of
    // `cc_load_policy`, and there is nobody in the theater to dismiss them.
    players[0].triggerReady()
    await flushPromises()

    expect(players[0].unloadedModules).toContain('captions')
    expect(players[0].unloadedModules).toContain('cc')

    // The module can arrive after `onReady`, when the stream's own caption
    // track resolves. `onApiChange` is the event for exactly that, so the
    // suppression has to be re-applied there or it only held for a player that
    // never had captions in the first place.
    players[0].unloadedModules.length = 0
    players[0].triggerApiChange()
    await flushPromises()

    expect(players[0].unloadedModules).toContain('captions')
    expect(players[0].unloadedModules).toContain('cc')
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

  it('advances when the video is stuck near its opening frame for too long', async () => {
    const stuckSequence = [
      { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns', maxDuration: 120 },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: stuckSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    // The mock player never reports a time change, simulating a blocked autoplay.
    expect(players[0].getCurrentTime()).toBe(0)

    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1_500)
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

  it('renders the MakeMeAComic QR and Amber Graner quote on the title card', async () => {
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
    expect(wrapper.get('[data-comic-hero-qr-link]').attributes('href')).toBe('https://makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-image]').attributes('alt')).toBe('QR code linking to makemeacomic.com')
    expect(wrapper.get('[data-comic-hero-qr-domain]').text()).toBe('makemeacomic.com')
    expect(wrapper.get('[data-amber-quote]').text()).toContain('You don\'t need permission to contribute to your own destiny.')
    expect(wrapper.get('[data-amber-quote]').text()).toContain('— Amber Graner')
    expect(wrapper.get('[data-amber-quote]').text()).toContain('Maintainer Guardian // The Iron Standard - Subclass [ REDACTED ]')
    expect(wrapper.find('[data-amber-quote] footer').exists()).toBe(false)
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
      'bluefin',
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
      'karl',
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
    players[0].triggerReady()
    players[0].setCurrentTime(2)

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

  it('still publishes both switches for the authored standard-cut trailer', async () => {
    // Regression guard for the Director's Cut's "no switches" rule: the alternate-source switch
    // is now offered by a segment carrying a second upload rather than by a hardcoded id, and
    // the conference cut must keep both of its affordances.
    const trailer = buildIntroVideoSequence().find(segment => segment.id === STANDARD_DESTINY_SEGMENT_ID)
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: [trailer] } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    const status = latestStatus(wrapper)
    expect(status.segmentId).toBe(STANDARD_DESTINY_SEGMENT_ID)
    expect(status.showVoiceOverToggle).toBe(true)
    expect(status.showCaptionToggle).toBe(true)

    wrapper.vm.setVoiceOverEnabled(true)
    await flushPromises()

    expect(players[0].loadVideoById).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'BKm0TPqeOjY' }),
    )
    expect(latestStatus(wrapper).voiceOverEnabled).toBe(true)
  })

  it('renders the QR and Amber quote only during the comic title-card cue', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: videoOnlySequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    await flushPromises()

    expect(wrapper.find('[data-amber-quote]').exists()).toBe(false)
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

    expect(titleCardWrapper.find('[data-amber-quote]').exists()).toBe(true)
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

/**
 * The intro→Track 0 junction. The trailer is a `video` segment on the main player, so the
 * authored `audioFadeOutSeconds` (text segments' `audioPlayer` only) never reached it and
 * `destroyPlayer()` severed its audio mid-air right as Track 0 came up at full volume.
 */
describe('wolvesIntroOverlay track 0 handoff fade', () => {
  const finalVideoSequence = [
    { id: 'wolves-intro', kind: 'video' as const, youtubeVideoId: 'BV3BZKbpBns', maxDuration: 10 },
  ]

  /** Runs the transport clock and the component's timers together, 200ms at a time. */
  async function runTransport(record: MockPlayerRecord, seconds: number) {
    const steps = Math.round((seconds * 1000) / 200)
    for (let step = 0; step < steps; step += 1) {
      record.setCurrentTime(Number((record.currentSeconds + 0.2).toFixed(3)))
      await vi.advanceTimersByTimeAsync(200)
    }
    await flushPromises()
  }

  it('ramps the trailer down across its own closing seconds instead of cutting it dead', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: { videos: finalVideoSequence, holdForHandoff: true },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const record = players[0]
    record.triggerReady()
    await flushPromises()

    // Well clear of the end: the trailer must play at full volume, never pre-ducked.
    await runTransport(record, 7)
    expect(record.currentSeconds).toBeCloseTo(7, 3)
    expect(record.volumeLog).toEqual([])
    expect(record.volume).toBe(100)

    // Inside the fade window but before the end: audibly down, not yet silent.
    await runTransport(record, 1.4)
    expect(record.currentSeconds).toBeCloseTo(8.4, 3)
    expect(record.volumeLog.length).toBeGreaterThan(0)
    expect(record.volume).toBeLessThan(100)
    expect(record.volume).toBeGreaterThan(0)
    expect(record.destroy).not.toHaveBeenCalled()
    expect(wrapper.emitted('complete')).toBeUndefined()

    // Through the cutoff: silent first, destroyed second.
    await runTransport(record, 2)
    expect(record.destroyedAtVolume).toBe(0)
    expect(record.volumeLog).toEqual([...record.volumeLog].sort((a, b) => b - a))
    expect(wrapper.emitted('complete')).toHaveLength(1)

    wrapper.unmount()
  })

  it('emits complete without waiting for the ramp so Track 0 loads in parallel', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: { videos: finalVideoSequence, holdForHandoff: true },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const record = players[0]
    record.triggerReady()
    await flushPromises()

    // An early natural end skips the lead fade entirely: the completion ramp has to cover it.
    record.triggerEnded()
    await flushPromises()

    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(record.destroy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(record.volume).toBeLessThan(100)
    expect(record.volume).toBeGreaterThan(0)
    expect(record.destroy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1200)
    expect(record.destroyedAtVolume).toBe(0)
    expect(record.volumeLog).toEqual([...record.volumeLog].sort((a, b) => b - a))

    wrapper.unmount()
  })

  it('stops the ramp when the overlay unmounts mid-fade rather than leaking a timer', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: { videos: finalVideoSequence, holdForHandoff: true },
    })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const record = players[0]
    record.triggerReady()
    await flushPromises()
    record.triggerEnded()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(500)
    wrapper.unmount()
    expect(record.destroy).toHaveBeenCalledTimes(1)

    const volumeCallsAtUnmount = record.setVolume.mock.calls.length
    await vi.advanceTimersByTimeAsync(3000)
    expect(record.setVolume.mock.calls).toHaveLength(volumeCallsAtUnmount)
  })
})

describe('wolvesIntroOverlay text segments', () => {
  it('gives the Director prologue a short reveal followed by a real reading hold', () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, {
      props: {
        videos: [{
          id: 'wolves-prologue',
          kind: 'text' as const,
          duration: 10,
          overlays: [{ text: 'A complete thought.', start: 0, end: 10 }],
        }],
      },
    })

    expect(wrapper.get('.wolves-intro-overlay-text').attributes('style')).toContain('animation-duration: 1.6s')
  })

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

  it('publishes background figure metadata without painting a caption over the image', async () => {
    const europaConcept = DIRECTORS_CUT_DESTINY_CONCEPTS.find(record => record.referenceId === 'E1')
    if (!europaConcept) {
      throw new Error('Expected the E1 concept-art registry record to exist')
    }

    const textSequence = [
      {
        id: 'wolves-prologue',
        kind: 'text' as const,
        duration: 5,
        overlays: [{
          text: '',
          start: 0,
          end: 5,
          backgroundImage: europaConcept.localPath,
          backgroundFigure: europaConcept.backgroundFigure,
        }],
      },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    const scene = wrapper.get('.wolves-intro-overlay-scene')
    expect(scene.attributes('role')).toBe('figure')
    expect(scene.attributes('aria-label')).toBe(europaConcept.backgroundFigure.label)
    // `aria-description` has unreliable screen-reader support; the credit is
    // exposed through `aria-describedby` pointing at a visually hidden node
    // instead, which every tested screen reader honors.
    const describedById = scene.attributes('aria-describedby')
    expect(describedById).toBeTruthy()
    expect(scene.attributes('aria-description')).toBeUndefined()
    const creditNode = wrapper.get(`#${describedById}`)
    expect(creditNode.text()).toBe(DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT)
    expect(creditNode.classes()).toContain('wolves-intro-overlay-visually-hidden')
    expect(scene.find('.wolves-intro-overlay-burned-caption').exists()).toBe(false)
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

  it('falls back to wall-clock pacing when the scored audio embed is blocked at 0s', async () => {
    // The authored duration has to clear TEXT_SEGMENT_END_SLACK_SECONDS for this test to mean
    // anything. On a 1s card the whole card is inside the track-end window, so the stall
    // backstop completes it at the 3s grace and the wall-clock fallback never gets to run —
    // the test passes without exercising the thing it names.
    const textSequence = [
      { id: 'wolves-prologue', kind: 'text' as const, duration: 8, audioYoutubeVideoId: 'EB3IokHelRk' },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    // The mock player reports 0s forever, simulating a browser that blocked autoplay.
    expect(players[0].getCurrentTime()).toBe(0)

    // Still inside the blocked-audio grace: the card is waiting for music that may yet arrive,
    // and its own clock has not started, so nothing has advanced.
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()

    // Past the grace the clock is released and the card paces itself from that moment, so it
    // still gets its full authored 8s of reading time rather than being cut short.
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('holds a silent card for its full authored duration', async () => {
    const textSequence = [
      { id: 'wolves-title-card', kind: 'text' as const, duration: 59 },
    ]
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: textSequence } })
    await flushPromises()

    // Half way through the authored window the card must still be on screen. It used
    // not to be: a silent card advanced its own clock at double speed, so the 59s
    // presenter welcome slide left the screen at 29.5s and each paragraph got half
    // the reading time it was written for.
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(29_500)
    await flushPromises()
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  // The welcome card is spoken live, so the presenter needs to move a line on when they have
  // finished saying it. This is an operator affordance only: the card must still advance
  // itself on its own clock, because an unattended theater run has nobody to click it.
  describe('presenter can click the welcome card along', () => {
    const cardSequence = () => [{
      id: 'wolves-title-card',
      kind: 'text' as const,
      duration: 30,
      overlays: [
        { text: 'First line.', start: 0, end: 10 },
        { text: 'Second line.', start: 10, end: 20 },
        { text: 'Third line.', start: 20, end: 30 },
      ],
    }]

    function visibleText(wrapper: any) {
      return wrapper.find('.wolves-intro-overlay-text').text()
    }

    it('advances to the next authored cue instead of skipping the card', async () => {
      const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cardSequence() } })
      await flushPromises()
      expect(visibleText(wrapper)).toContain('First line')

      await wrapper.find('.wolves-intro-overlay').trigger('click')
      await flushPromises()

      expect(visibleText(wrapper)).toContain('Second line')
      expect(wrapper.emitted('complete')).toBeUndefined()
    })

    it('leaves the card once the last cue has been clicked past', async () => {
      const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cardSequence() } })
      await flushPromises()

      for (let click = 0; click < 3; click++) {
        await wrapper.find('.wolves-intro-overlay').trigger('click')
        await flushPromises()
      }

      expect(wrapper.emitted('complete')).toHaveLength(1)
    })

    it('ignores clicks on a scored card so the text cannot outrun its music bed', async () => {
      // The Director's Cut prologue is written against the Gayane Ballet Suite. Moving its
      // text by hand without moving the track would desync the segment for the rest of its
      // run, so a card with a music bed is left entirely to its own clock.
      const scored = cardSequence().map(segment => ({ ...segment, audioYoutubeVideoId: 'EB3IokHelRk' }))
      const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: scored } })
      await flushPromises()
      resolveIframeApi()
      await flushPromises()
      const before = visibleText(wrapper)

      await wrapper.find('.wolves-intro-overlay').trigger('click')
      await flushPromises()

      expect(visibleText(wrapper)).toBe(before)
      expect(wrapper.emitted('complete')).toBeUndefined()
    })

    it('still advances itself with no click at all', async () => {
      const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: cardSequence() } })
      await flushPromises()

      await vi.advanceTimersByTimeAsync(29_000)
      await flushPromises()
      expect(wrapper.emitted('complete')).toBeUndefined()

      await vi.advanceTimersByTimeAsync(1_500)
      await flushPromises()
      expect(wrapper.emitted('complete')).toHaveLength(1)
    })
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
        { text: 'Void Warlock — Cortney Nickerson — Reconciler of the Arcane', start: 5, end: 10 },
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

  it('renders Cortney Nickerson with the documented dinosaur companion plate', async () => {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: guardianPlateSequence } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    players[0].triggerReady()
    players[0].getCurrentTime = vi.fn(() => 6)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(wrapper.text()).toContain('Cortney Nickerson')
    expect(wrapper.find('.wolves-companion-plate').exists()).toBe(true)
    expect(wrapper.find('.wolves-companion-plate-art').attributes('src')).toContain('bob-torosaurus.webp')
    expect(wrapper.find('.wolves-companion-plate-label').text()).toBe('GUARDIAN BOND')
    expect(wrapper.find('.wolves-companion-plate-species').text()).toBe('Torosaurus latus')
    // No character sheet names Cortney's torosaurus, so the plate carries no name line.
    expect(wrapper.find('.wolves-companion-plate-name').exists()).toBe(false)
    // The pair share one anchored row so the plates sit side by side.
    expect(wrapper.find('.wolves-guardian-plate-row .wolves-guardian-plate').exists()).toBe(true)
    expect(wrapper.find('.wolves-guardian-plate-row .wolves-companion-plate').exists()).toBe(true)
    // Cortney's companion keeps the default bottom-right corner placement.
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
    expect(wrapper.find('.wolves-companion-plate-art').classes()).toContain('wolves-companion-plate-art--alamosaurus')
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

  it('gilds Christoph Blecker\'s leader plate gold while the other plates keep their chrome', () => {
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

    expect(leaderRule).toContain('border-color: rgb(250 204 21 / 55%)')
    expect(leaderRule).toContain('box-shadow: 0 0 24px rgb(250 204 21 / 20%)')
    for (const selector of leaderSelectors) {
      expect(overlay).toContain(`.wolves-guardian-plate-leader ${selector}`)
    }
    expect(overlay).toContain('stroke: #facc15')
    const leaderLabelRule = overlay.match(/\.wolves-guardian-plate-leader \.wolves-guardian-plate-label \{([\s\S]*?)\n\}/)?.[1]
    expect(leaderLabelRule).toContain('color: #facc15')
    expect(overlay).toContain('color: #93c5fd')
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

describe('wolvesIntroOverlay director\'s cut', () => {
  const directorsCut = buildDirectorsCutVideoSequence()

  async function mountDirectorsCut() {
    const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: directorsCut } })
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    return wrapper
  }

  /** Drive the scored prologue's own clock, which reads the background audio embed. */
  async function seekPrologue(seconds: number) {
    players[0].setCurrentTime(seconds)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
  }

  /** Run the prologue up to the warm-up mark and let the warmed player report ready. */
  async function warmIkoraPlayer() {
    await seekPrologue(DIRECTORS_CUT_IKORA_PREWARM_SECOND + 1)
    resolveIframeApi()
    await flushPromises()
    const warmed = players[players.length - 1]
    warmed.triggerReady()
    await flushPromises()
    return warmed
  }

  it('renders every montage painting whole, with its provenance, at its own source geometry', async () => {
    const wrapper = await mountDirectorsCut()
    const montage = buildDirectorsCutPrologueSegment().overlays!.filter(cue => cue.backgroundImage?.startsWith('wolves-intro/destiny-concepts/'))
    const firstAppearances = new Map<string, IntroOverlayTextCue>()
    for (const cue of montage) {
      if (!firstAppearances.has(cue.backgroundImage!)) {
        firstAppearances.set(cue.backgroundImage!, cue)
      }
    }
    expect(firstAppearances.size).toBe(DIRECTORS_CUT_DESTINY_CONCEPTS.length)

    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      const cue = firstAppearances.get(record.localPath)!
      // Sample inside the cue, past its dissolve, so the painting is fully on stage.
      await seekPrologue(cue.start + (cue.end - cue.start) / 2)

      const scene = wrapper.get('.wolves-intro-overlay-scene')
      const image = scene.get('img.wolves-intro-overlay-background')
      expect(image.attributes('src')).toContain(record.localPath)
      expect(scene.attributes('role')).toBe('figure')
      expect(scene.attributes('aria-label')).toBe(record.backgroundFigure.label)
      const describedById = scene.attributes('aria-describedby')
      expect(describedById, record.id).toBeTruthy()
      expect(wrapper.get(`#${describedById}`).text(), record.id).toBe(DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT)

      // A painting is the subject, not a backdrop: shown whole, and never blown up past
      // the pixels the artist actually delivered.
      const style = image.attributes('style') ?? ''
      expect(image.classes(), record.id).toContain('wolves-intro-overlay-background-framed')
      expect(style, record.id).toContain(`max-width: ${record.sourceWidth}px`)
      expect(style, record.id).toContain(`max-height: ${record.sourceHeight}px`)
      // The retired Ken Burns crop left no residue that could animate a painting.
      expect(image.classes()).not.toContain('wolves-intro-overlay-background-kenburns')
      expect(style).not.toContain('animation-duration')
    }
  })

  it('lights the paintings fully and buys legibility with a scrim rather than a global dim', async () => {
    const wrapper = await mountDirectorsCut()
    const painting = buildDirectorsCutPrologueSegment().overlays!.find(cue => cue.backgroundImage?.startsWith('wolves-intro/destiny-concepts/') && cue.text.trim().length > 0)!

    await seekPrologue(painting.start + 1)
    expect(wrapper.find('.wolves-intro-overlay-scrim').exists()).toBe(true)

    // The scrim belongs to framed paintings only. It used to be checked against
    // shot 0, on the assumption that the prologue opens on black - it no longer
    // does, so the check now finds a genuinely unframed cue instead of trusting
    // a position in the list.
    const unframed = buildDirectorsCutPrologueSegment().overlays!.find(cue => !cue.backgroundFraming)!

    await seekPrologue(unframed.start + 1)
    expect(wrapper.find('.wolves-intro-overlay-scrim').exists()).toBe(false)

    // And it exists only while a caption does: on a wordless shot the gradient
    // is haze over the painting with no text to buy contrast for. The montage
    // breathes through its wordless shots, so they must stand clean.
    const wordless = buildDirectorsCutPrologueSegment().overlays!.find(cue => cue.backgroundFraming && !cue.text.trim())!

    await seekPrologue(wordless.start + 1)
    expect(wrapper.find('.wolves-intro-overlay-scrim').exists()).toBe(false)
  })

  it('clears a thought once it has been read, while its shot keeps running', async () => {
    const wrapper = await mountDirectorsCut()
    // On the 134.65s Tribulation recut every authored thought costs at least its
    // whole shot to read, so `textHoldSeconds` is pinned to the window and no cue
    // clears early any more - the montage breathes through its six deliberately
    // wordless shots instead. The hold plumbing still has to be right, so what is
    // asserted here is the rule rather than a sample: a hold never outruns its
    // shot, and never undercuts the reading cost.
    const held = buildDirectorsCutPrologueSegment().overlays!.filter(cue => cue.textHoldSeconds != null)

    expect(held.length).toBeGreaterThan(0)
    for (const cue of held) {
      // Holds are published rounded to a hundredth of a second, so the bound is
      // checked to that resolution: a mark difference like 43.26 - 33.02 is not
      // exactly 10.24 in binary floating point, and an exact comparison fails by
      // about 2e-15 rather than by anything an audience could see.
      expect(cue.textHoldSeconds!, cue.text).toBeLessThanOrEqual(cue.end - cue.start + 0.005)
    }

    const sample = held[0]

    await seekPrologue(sample.start + sample.textHoldSeconds! - 0.5)
    expect(wrapper.get('.wolves-intro-overlay-text').text().length).toBeGreaterThan(0)

    // Past this shot's hold the recut has already cut to the next one, because
    // hold and window are now the same number. What must survive the boundary is
    // the imagery: the montage plays on rather than dropping to black between
    // thoughts, which is the whole point of the recut.
    await seekPrologue(sample.start + sample.textHoldSeconds! + 1)
    expect(wrapper.find('.wolves-intro-overlay-scene').exists()).toBe(true)
  })

  it('dissolves scenes at its own reveal tempo, not the standard prologue\'s', async () => {
    const wrapper = await mountDirectorsCut()
    // Derived, not typed in: this used to seek to a literal 140s, which was a
    // montage shot under the 325.6s Gayane track and is past the end of the
    // 134.65s recut. Ask the segment for a shot that carries a painting.
    const framed = buildDirectorsCutPrologueSegment().overlays!.find(cue => cue.backgroundFraming)!

    await seekPrologue(framed.start + 1)

    const scene = wrapper.get('.wolves-intro-overlay-scene')
    expect(scene.attributes('style')).toContain(`transition-duration: ${DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS}s`)
    expect(DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS).toBe(DIRECTORS_CUT_TEXT_FADE_SECONDS)
  })

  it('marks its projected text so a narrow viewport can rescale it instead of blanking it', async () => {
    const wrapper = await mountDirectorsCut()
    await seekPrologue(10)

    expect(wrapper.get('.wolves-intro-overlay-text').classes()).toContain('wolves-intro-overlay-text-director')
  })

  it('warms the Ikora player during the prologue, parked silent on its opening frame', async () => {
    const wrapper = await mountDirectorsCut()
    expect(players).toHaveLength(1)

    const ikora = await warmIkoraPlayer()

    expect(players).toHaveLength(2)
    expect(ikora.cueVideoById).toHaveBeenCalled()
    expect(ikora.videoId).toBe(IKORA_SOURCE_VIDEO_ID)
    expect(ikora.cuedAt).toBe(IKORA_RATING_CARD_SECONDS)
    // Parked, not playing: a warm player that plays is a trailer starting under the music.
    expect(ikora.muted).toBe(true)
    expect(ikora.playVideo).not.toHaveBeenCalled()
    // The prologue is still what the room sees.
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(wrapper.get('.wolves-intro-overlay-player').classes()).toContain('wolves-intro-overlay-player-hidden')
  })

  it('promotes the warmed player instead of rebuilding it, with no second seek and no overlap', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]
    const ikora = await warmIkoraPlayer()
    ikora.seekTo.mockClear()

    wrapper.vm.next()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    // The warmed iframe *is* the show player. Rebuilding it here throws away the warm-up.
    expect(players).toHaveLength(2)
    expect(players[players.length - 1]).toBe(ikora)
    // A cued player is already parked on its opening frame; loading and seeking it again
    // is the visible stutter this prewarm exists to remove.
    expect(ikora.loadVideoById).not.toHaveBeenCalled()
    expect(ikora.seekTo).not.toHaveBeenCalled()
    // The music is gone before the trailer's audio arrives — never both at once.
    expect(audio.destroy).toHaveBeenCalled()
    expect(ikora.destroyedAtVolume).toBeNull()
    expect(ikora.unMute).toHaveBeenCalled()
    expect(ikora.playVideo).toHaveBeenCalled()
  })

  it('holds the last painting until the trailer is really playing, and never longer than the bound', async () => {
    const wrapper = await mountDirectorsCut()
    const ikora = await warmIkoraPlayer()
    // A promoted player that has not started yet: playVideo is a request, not a frame.
    ikora.playVideo = vi.fn(() => {}) as typeof ikora.playVideo

    wrapper.vm.next()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    // No black frame in front of a live room while the trailer spins up.
    expect(wrapper.find('.wolves-intro-overlay-scene').exists()).toBe(true)
    expect(wrapper.get('.wolves-intro-overlay-player').classes()).toContain('wolves-intro-overlay-player-hidden')

    // A player that never starts must not freeze the show: the hold is bounded.
    await vi.advanceTimersByTimeAsync(DIRECTORS_CUT_HANDOFF_HOLD_MAX_MS + 400)
    await flushPromises()
    expect(wrapper.find('.wolves-intro-overlay-scene').exists()).toBe(false)
    expect(wrapper.get('.wolves-intro-overlay-player').classes()).not.toContain('wolves-intro-overlay-player-hidden')
  })

  it('opens dark on the silent lead-in and closes on the authored title', async () => {
    const wrapper = await mountDirectorsCut()

    await seekPrologue(1)
    expect(wrapper.find('.wolves-intro-overlay-text').exists()).toBe(false)
    expect(wrapper.find('img.wolves-intro-overlay-background').exists()).toBe(false)

    await seekPrologue(TRIBULATION_TRACK_SECONDS - 1)
    expect(wrapper.get('.wolves-intro-overlay-text').text()).toContain('seven days to the wolves')
  })

  it('plays the Ikora source at its measured cutoff with no voice-over toggle offered', async () => {
    const wrapper = await mountDirectorsCut()

    wrapper.vm.next()
    await flushPromises()
    resolveIframeApi()
    await flushPromises()

    const destiny = players[players.length - 1]
    expect(destiny.videoId).toBe(IKORA_SOURCE_VIDEO_ID)
    expect(destiny.config.playerVars.start).toBe(IKORA_RATING_CARD_SECONDS)

    const latest = latestStatus(wrapper)
    expect(latest.segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(latest.showVoiceOverToggle).toBe(false)

    destiny.triggerReady()
    destiny.setCurrentTime(IKORA_LAST_CONTENT_SECOND - 0.2)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(wrapper.emitted('complete')).toBeUndefined()

    destiny.setCurrentTime(IKORA_LAST_CONTENT_SECOND)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('offers the theater no source or caption switch, and refuses one if anything asks', async () => {
    const wrapper = await mountDirectorsCut()

    wrapper.vm.next()
    await flushPromises()
    resolveIframeApi()
    await flushPromises()
    const destiny = players[players.length - 1]
    destiny.triggerReady()
    await flushPromises()

    const onStage = latestStatus(wrapper)
    expect(onStage.segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(onStage.showVoiceOverToggle).toBe(false)
    expect(onStage.voiceOverEnabled).toBe(false)
    expect(onStage.showCaptionToggle).toBe(false)
    expect(onStage.captionsEnabled).toBe(false)

    // Ikora's is the Director's Cut's primary source, so there is no stale alternate to expose:
    // nothing here can switch the show back to the unvoiced re-upload the standard cut toggles.
    destiny.loadVideoById.mockClear()
    wrapper.vm.setVoiceOverEnabled(true)
    wrapper.vm.setCaptionsEnabled(true)
    await flushPromises()

    expect(destiny.loadVideoById).not.toHaveBeenCalled()
    expect(destiny.videoId).toBe(IKORA_SOURCE_VIDEO_ID)
    const afterAsking = latestStatus(wrapper)
    expect(afterAsking.showVoiceOverToggle).toBe(false)
    expect(afterAsking.voiceOverEnabled).toBe(false)
    expect(afterAsking.showCaptionToggle).toBe(false)
    expect(afterAsking.captionsEnabled).toBe(false)
  })

  it('refuses a mid-piece ENDED and plays the act out on its own clock, advancing exactly once', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]

    // A clock frozen in the body of the piece is a mid-roll ad or buffering, not the end of the
    // track: the scored card must wait for the music rather than run a clock of its own.
    audio.setCurrentTime(TRIBULATION_TRACK_SECONDS - 5)
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(latestStatus(wrapper).currentTime).toBeCloseTo(TRIBULATION_TRACK_SECONDS - 5)
    // The trailer's player exists by now — it is deliberately warmed at the montage's
    // penultimate mark — but it is parked. Nothing has taken the stage from the scored card.
    for (const warmed of players.slice(1)) {
      expect(warmed.playVideo).not.toHaveBeenCalled()
    }

    // An ENDED from outside the measured silent tail is an ad break, not the music ending.
    // Believing it would cut a 325.6s scored act short in front of a live room.
    audio.triggerEnded()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    // The card took its own clock over from where the music stopped rather than freezing,
    // and did not restart it from zero.
    expect(latestStatus(wrapper).currentTime).toBeGreaterThan(TRIBULATION_TRACK_SECONDS - 5)
    expect(latestStatus(wrapper).currentTime).toBeLessThan(TRIBULATION_TRACK_SECONDS - 3.5)

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(players[players.length - 1].videoId).toBe(IKORA_SOURCE_VIDEO_ID)
    // Exactly once: a second advance would run off the end of this two-segment cut and
    // complete the intro, dropping the audience straight into Track 0.
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('snaps back to the music when the audio clock starts moving again after an ad', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]

    audio.setCurrentTime(100)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    // Ad break: the embed publishes ENDED with the track's clock frozen mid-piece.
    audio.triggerEnded()
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(latestStatus(wrapper).currentTime).toBeGreaterThan(101)

    // The ad finishes and the music resumes. The card must go straight back to the player's
    // clock — the only thing it is allowed to synchronise with — not keep its own.
    audio.setCurrentTime(100.4)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(latestStatus(wrapper).currentTime).toBeCloseTo(100.4)
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('does not let a stale ad-break ENDED complete the card early once its own clock reaches the end window', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]

    // Mid-piece, far from the end window: an ad break, not the music ending.
    // Derived from the track rather than typed in - a literal 200s was mid-piece
    // under Gayane and is past the end of the 134.65s recut, which made this
    // assertion fail on the segment having already handed off.
    audio.setCurrentTime(TRIBULATION_TRACK_SECONDS / 2)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    audio.triggerEnded()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)

    // Let the card's own free-running clock advance up to the end window's edge but stop
    // short of it. A stale `ended` flag left over from the ad break's out-of-window ENDED
    // must not survive the release: if it did, the card would complete the instant its own
    // clock crossed into the window — up to a full second before the authored duration —
    // even though nothing about the music actually ended there.
    const windowStart = TRIBULATION_TRACK_SECONDS - TEXT_SEGMENT_END_SLACK_SECONDS
    const beforeWindow = latestStatus(wrapper).currentTime
    await vi.advanceTimersByTimeAsync(Math.round((windowStart - beforeWindow - 0.2) * 1000))
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(latestStatus(wrapper).currentTime).toBeLessThan(windowStart)

    // Cross into the window without reaching the authored duration.
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(latestStatus(wrapper).currentTime).toBeGreaterThanOrEqual(windowStart)
    expect(latestStatus(wrapper).currentTime).toBeLessThan(TRIBULATION_TRACK_SECONDS)
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)

    // It still ends, exactly once, on the authored duration rather than hanging.
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('completes the closing title when the audio clock plateaus short of the authored end and no ENDED arrives', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]

    // The exact hang the authored 325.6s end invites: the decoded stream is 325.602s, so a real
    // player that stops a few hundredths short never satisfies `elapsed >= duration`.
    audio.setCurrentTime(TRIBULATION_TRACK_SECONDS - 0.02)
    await vi.advanceTimersByTimeAsync(TEXT_SEGMENT_STALL_GRACE_SECONDS * 1000 - 500)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(wrapper.emitted('complete')).toBeUndefined()

    // A late ENDED from the abandoned audio embed must not advance a second time, even once the
    // Destiny player is up and running with a clock of its own.
    const destiny = players[players.length - 1]
    destiny.triggerReady()
    destiny.setCurrentTime(30)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    audio.triggerEnded()
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(latestStatus(wrapper).currentTime).toBeCloseTo(30)
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('plays the scored prologue out on its own clock when the audio embed dies, and still advances once', async () => {
    const wrapper = await mountDirectorsCut()
    const audio = players[0]

    await seekPrologue(TRIBULATION_TRACK_SECONDS - 10)
    expect(latestStatus(wrapper).currentTime).toBeCloseTo(TRIBULATION_TRACK_SECONDS - 10)

    audio.triggerError()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    // The music is gone, but the act still reaches the audience: the card picks up its own
    // clock from where the music died instead of freezing on whichever cue was up.
    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
    expect(latestStatus(wrapper).currentTime).toBeCloseTo(TRIBULATION_TRACK_SECONDS - 9, 1)

    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_DESTINY_SEGMENT_ID)
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  /**
   * The montage cuts on measured section marks from 133.58 s, and its later
   * holds are under ten seconds. A cue that opens on an undecoded painting
   * spends its whole hold on an empty scene layer, and the cut cannot be
   * replayed in front of the room. The narrated opening is the only place in
   * the show with spare network and decode budget, so every painting is warmed
   * there — and the standard intro, which ships none of them, must not pay for
   * a single one.
   */
  describe('concept-art predecode', () => {
    class RecordingImage {
      static requested: string[] = []
      decoding = ''
      #src = ''
      get src(): string {
        return this.#src
      }

      set src(value: string) {
        this.#src = value
        RecordingImage.requested.push(value)
      }

      decode() {
        return Promise.resolve()
      }
    }

    async function recordPredecodedUrls(videos: readonly any[]): Promise<string[]> {
      RecordingImage.requested = []
      const realImage = window.Image
      const realGlobalImage = globalThis.Image
      ;(window as any).Image = RecordingImage
      ;(globalThis as any).Image = RecordingImage
      try {
        mountOverlay(WolvesIntroOverlay, { props: { videos } })
        await flushPromises()
      }
      finally {
        ;(window as any).Image = realImage
        ;(globalThis as any).Image = realGlobalImage
      }
      return [...RecordingImage.requested]
    }

    const conceptPaths = DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.localPath)

    it('warms all ten paintings exactly once when the prologue takes the stage', async () => {
      const requested = await recordPredecodedUrls(directorsCut)
      const concepts = requested.filter(url => url.includes('wolves-intro/destiny-concepts/'))

      expect(concepts).toHaveLength(DIRECTORS_CUT_DESTINY_CONCEPTS.length)
      expect(new Set(concepts).size).toBe(concepts.length)
      for (const path of conceptPaths) {
        expect(concepts.filter(url => url.endsWith(path))).toHaveLength(1)
      }
    })

    /**
     * The paintings are the largest assets in the show. Ten parallel fetches
     * saturate the same connection pool the Track 0 slide preloader and the
     * scored audio embed use — measured in the browser, a ten-wide burst left
     * the previous slide on stage at the 35.666 s Director cut. Exactly one may
     * be in flight, and the order must be the montage order so the chain stays
     * ahead of the cue that needs each painting.
     */
    function gatedImageClass(pending: Array<{ url: string, resolve: () => void }>) {
      return class GatedImage extends RecordingImage {
        override decode() {
          return new Promise<void>((resolve) => {
            pending.push({ url: this.src, resolve: () => resolve() })
          })
        }
      }
    }

    /** Release the next warm still waiting on a concept painting's decode. */
    function releaseNextConceptDecode(pending: Array<{ url: string, resolve: () => void }>) {
      const index = pending.findIndex(entry => entry.url.includes('destiny-concepts/'))
      if (index === -1) {
        throw new Error('Expected a concept painting to be warming')
      }
      pending.splice(index, 1)[0].resolve()
    }

    async function withGatedImages(run: (pending: Array<{ url: string, resolve: () => void }>) => Promise<void>) {
      const pending: Array<{ url: string, resolve: () => void }> = []
      RecordingImage.requested = []
      const realImage = window.Image
      const realGlobalImage = globalThis.Image
      ;(window as any).Image = gatedImageClass(pending)
      ;(globalThis as any).Image = gatedImageClass(pending)
      try {
        await run(pending)
      }
      finally {
        ;(window as any).Image = realImage
        ;(globalThis as any).Image = realGlobalImage
      }
    }

    const conceptsSoFar = () => RecordingImage.requested.filter(url => url.includes('destiny-concepts/'))

    it('warms them one at a time, in montage order', async () => {
      await withGatedImages(async (pending) => {
        mountOverlay(WolvesIntroOverlay, { props: { videos: directorsCut } })
        await flushPromises()

        // Only the first painting may be in flight: the other nine are still
        // queued behind its decode.
        expect(conceptsSoFar()).toHaveLength(1)
        expect(conceptsSoFar()[0]).toContain(conceptPaths[0])

        for (let index = 1; index < DIRECTORS_CUT_DESTINY_CONCEPTS.length; index += 1) {
          releaseNextConceptDecode(pending)
          await flushPromises()
          expect(conceptsSoFar()).toHaveLength(index + 1)
          expect(conceptsSoFar()[index]).toContain(conceptPaths[index])
        }
      })
    })

    it('abandons the warm chain when the intro is left', async () => {
      await withGatedImages(async (pending) => {
        const wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: directorsCut } })
        await flushPromises()
        expect(conceptsSoFar()).toHaveLength(1)

        // Skipped to Track 0: the show that replaced the intro must not have to
        // share its bandwidth with paintings nobody will see.
        wrapper.unmount()
        releaseNextConceptDecode(pending)
        await flushPromises()

        expect(conceptsSoFar()).toHaveLength(1)
      })
    })

    it('never asks the standard intro to load a Destiny painting', async () => {
      const requested = await recordPredecodedUrls(buildIntroVideoSequence())

      // The standard intro warms its own guardian companion artwork, so a
      // non-empty list is what proves this recorded anything at all.
      expect(requested.length).toBeGreaterThan(0)
      expect(requested.some(url => url.includes('wolves-intro/destiny-concepts/'))).toBe(false)
      for (const path of conceptPaths) {
        expect(requested.some(url => url.endsWith(path))).toBe(false)
      }
    })

    it('keeps the scored prologue running when a painting cannot be predecoded', async () => {
      class FailingImage extends RecordingImage {
        override decode() {
          return Promise.reject(new Error('decode unavailable'))
        }
      }
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      RecordingImage.requested = []
      const realImage = window.Image
      const realGlobalImage = globalThis.Image
      ;(window as any).Image = FailingImage
      ;(globalThis as any).Image = FailingImage
      let wrapper: any
      try {
        wrapper = mountOverlay(WolvesIntroOverlay, { props: { videos: directorsCut } })
        await flushPromises()
        resolveIframeApi()
        await flushPromises()
      }
      finally {
        ;(window as any).Image = realImage
        ;(globalThis as any).Image = realGlobalImage
      }

      // A rejected decode is a warning, never a thrown error inside the intro:
      // the music is already playing and nothing may stop it.
      expect(RecordingImage.requested.filter(url => url.includes('destiny-concepts/')))
        .toHaveLength(DIRECTORS_CUT_DESTINY_CONCEPTS.length)
      await seekPrologue(TRIBULATION_TRACK_SECONDS - 1)
      expect(latestStatus(wrapper).segmentId).toBe(DIRECTORS_CUT_PROLOGUE_SEGMENT_ID)
      expect(wrapper.get('.wolves-intro-overlay-text').text()).toContain('seven days to the wolves')
      warn.mockRestore()
    })
  })
})
