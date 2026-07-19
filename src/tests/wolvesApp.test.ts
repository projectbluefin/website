import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import WolvesApp from '@/WolvesApp.vue'

const CinematicLobbyStub = defineComponent({
  name: 'CinematicLobby',
  emits: ['enter'],
  template: '<button class="cinematic-lobby-stub" @click="$emit(\'enter\')" />',
})

const handoffCalls: string[] = []
let introMounts = 0
let introNexts = 0
let setCaptionsEnabled = vi.fn()
let startStage = async () => {
  handoffCalls.push('start')
}

const CinematicStageStub = defineComponent({
  name: 'CinematicStage',
  setup(_, { expose }) {
    expose({
      prepare: vi.fn(async () => handoffCalls.push('prepare')),
      start: () => startStage(),
      releaseHandoff: vi.fn(() => handoffCalls.push('release')),
      destroy: vi.fn(() => handoffCalls.push('destroy')),
      togglePlay: vi.fn(),
      seekTo: vi.fn(),
      seekToRatio: vi.fn(),
      skip: vi.fn(),
    })
    return {}
  },
  template: '<div class="cinematic-stage-stub" />',
})

const WolvesIntroOverlayStub = defineComponent({
  name: 'WolvesIntroOverlay',
  emits: ['status', 'complete'],
  props: {
    holdForHandoff: { type: Boolean, default: false },
    transparentHandoff: { type: Boolean, default: false },
  },
  updated() {
    if (this.transparentHandoff) {
      handoffCalls.push('transparent')
    }
  },
  mounted() {
    introMounts++
  },
  setup(_, { expose }) {
    expose({
      next() {
        introNexts++
      },
      previous: vi.fn(),
      toggle: vi.fn(),
      seekToRatio: vi.fn(),
      setVoiceOverEnabled: vi.fn(),
      setCaptionsEnabled,
    })
    return {}
  },
  template: '<div class="wolves-intro-overlay-stub" />',
})

const MediaWidgetStub = defineComponent({
  name: 'MediaWidget',
  emits: ['seek', 'skip', 'toggleCaptions'],
  props: {
    title: { type: String, default: '' },
    showVoiceOverToggle: { type: Boolean, default: false },
    voiceOverEnabled: { type: Boolean, default: false },
    voiceOverLabel: { type: String, default: '' },
    showCaptionToggle: { type: Boolean, default: false },
    captionsEnabled: { type: Boolean, default: false },
    captionLabel: { type: String, default: '' },
  },
  template: `
    <div class="media-widget-stub">
      {{ showVoiceOverToggle }}|{{ voiceOverEnabled }}|{{ voiceOverLabel }}|{{ showCaptionToggle }}|{{ captionsEnabled }}|{{ captionLabel }}
    </div>
  `,
})

const NameplateStub = defineComponent({
  name: 'Nameplate',
  props: {
    detail: { type: String, default: '' },
    label: { type: String, default: '' },
    glitch: { type: Boolean, default: false },
  },
  template: '<div class="nameplate-stub" :class="{ glitching: glitch }">{{ detail }}|{{ label }}</div>',
})

describe('wolvesApp intro status handling', () => {
  it('gives the one-line intro status plate the full available viewport width', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/WolvesApp.vue'), 'utf8')

    expect(source).toMatch(/\.wc-intro-nameplate \{[\s\S]*?width: calc\(100vw - 6rem\)/)
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    handoffCalls.length = 0
    introMounts = 0
    introNexts = 0
    setCaptionsEnabled = vi.fn()
    startStage = async () => {
      handoffCalls.push('start')
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function stubs() {
    return {
      CinematicLobby: CinematicLobbyStub,
      CinematicStage: CinematicStageStub,
      MediaWidget: MediaWidgetStub,
      WolvesIntroOverlay: WolvesIntroOverlayStub,
      Nameplate: NameplateStub,
    }
  }

  it('preloads the cinematic stage during the intro and dissolves the overlay at the handoff', async () => {
    vi.useFakeTimers()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    await wrapper.get('.cinematic-lobby-stub').trigger('click')
    await nextTick()
    expect(handoffCalls).toEqual(['prepare'])

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    // The overlay stays mounted, transparent, while the dissolve plays out.
    expect(handoffCalls).toEqual(['prepare', 'start', 'transparent'])
    expect(useCinematicStore().phase).toBe('cinematic')
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1400)
    await nextTick()
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(false)
  })

  it('keeps the overlay mounted until the dissolve completes', async () => {
    vi.useFakeTimers()
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(handoffCalls).toEqual(['start', 'transparent'])
    expect(store.phase).toBe('cinematic')
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1399)
    await nextTick()
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(false)
  })

  it('destroys the cinematic stage before seeking back into the intro', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(MediaWidgetStub).vm.$emit('seek', 0)
    await flushPromises()
    await nextTick()

    expect(handoffCalls).toEqual(['destroy', 'prepare'])
    expect(store.phase).toBe('intro')
  })

  it('cancels a delayed handoff before remounting the intro for a seek', async () => {
    let resolveStart: (() => void) | undefined
    startStage = () => {
      handoffCalls.push('start')
      return new Promise<void>((resolve) => {
        resolveStart = resolve
      })
    }
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    expect(store.phase).toBe('cinematic')

    wrapper.getComponent(MediaWidgetStub).vm.$emit('seek', 0)
    await flushPromises()
    await nextTick()

    expect(store.phase).toBe('intro')
    expect(introMounts).toBe(2)

    resolveStart?.()
    await flushPromises()

    expect(handoffCalls).toEqual(['start', 'destroy', 'prepare'])
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(true)
  })

  it('cancels a delayed handoff before using a fresh intro overlay for a skip', async () => {
    let resolveStart: (() => void) | undefined
    startStage = () => {
      handoffCalls.push('start')
      return new Promise<void>((resolve) => {
        resolveStart = resolve
      })
    }
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    wrapper.getComponent(MediaWidgetStub).vm.$emit('skip', 1)
    await flushPromises()
    await nextTick()

    expect(store.phase).toBe('intro')
    expect(introMounts).toBe(2)
    expect(introNexts).toBe(1)

    resolveStart?.()
    await flushPromises()

    expect(handoffCalls).toEqual(['start', 'destroy', 'prepare'])
  })

  it('shows the Destiny CC switch off by default and forwards its state to the intro overlay', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: stubs(),
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    const widget = () => wrapper.getComponent(MediaWidgetStub)

    intro.vm.$emit('status', {
      currentTime: 18,
      duration: 90,
      paused: true,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      showVoiceOverToggle: true,
      voiceOverEnabled: true,
      showCaptionToggle: true,
      captionsEnabled: false,
    })
    await wrapper.vm.$nextTick()

    expect(widget().text()).toBe('true|true|Ikora voice over|true|false|CC')

    widget().vm.$emit('toggleCaptions', true)

    expect(setCaptionsEnabled).toHaveBeenCalledWith(true)
  })

  it('keeps the Nova tag in the top status while preserving the Destiny music-widget title', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: {
          CinematicLobby: true,
          CinematicStage: true,
          MediaWidget: MediaWidgetStub,
          WolvesIntroOverlay: WolvesIntroOverlayStub,
          Nameplate: NameplateStub,
        },
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    intro.vm.$emit('status', {
      currentTime: 5,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Meet your Fireteam|fighting for something greater than themselves')
    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('The Wolves are Coming')

    intro.vm.$emit('status', {
      currentTime: 52.2,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      nameplateTitle: '#nova4ever',
      nameplateGlitch: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Meet your Fireteam|#nova4ever')
    expect(wrapper.get('.nameplate-stub').classes()).toContain('glitching')
    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('The Wolves are Coming')

    intro.vm.$emit('status', {
      currentTime: 70.5,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Meet your Fireteam|fighting for something greater than themselves')
    expect(wrapper.get('.nameplate-stub').classes()).not.toContain('glitching')
    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('The Wolves are Coming')
  })

  it('uses a final Destiny cue to replace both top-status fields', async () => {
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('status', {
      currentTime: 106.5,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      nameplateDetail: 'Legends Sought',
      nameplateTitle: 'Follow the path, we\'ve got your back',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Legends Sought|Follow the path, we\'ve got your back')
  })

  it('normalizes intro native time into canonical segment/sequence progress and preserves overall continuity on handoff', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: stubs(),
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    intro.vm.$emit('status', {
      currentTime: 62,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(store.segmentIndex).toBe(0)
    expect(store.segmentElapsed).toBeCloseTo(60)
    expect(store.segmentDuration).toBeCloseTo(119.5)
    expect(store.nativeTime).toBe(62)
    expect(store.sequenceElapsed).toBeCloseTo(60)
    expect(store.overallElapsed).toBeCloseTo(60)

    intro.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(store.phase).toBe('cinematic')
    expect(store.overallElapsed).toBeCloseTo(119.5)
  })
})
