import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import WolvesApp from '@/WolvesApp.vue'

const WolvesIntroOverlayStub = defineComponent({
  name: 'WolvesIntroOverlay',
  emits: ['status', 'complete'],
  template: '<div class="wolves-intro-overlay-stub" />',
})

const MediaWidgetStub = defineComponent({
  name: 'MediaWidget',
  props: {
    showVoiceOverToggle: { type: Boolean, default: false },
    voiceOverEnabled: { type: Boolean, default: false },
    voiceOverLabel: { type: String, default: '' },
  },
  template: `
    <div class="media-widget-stub">
      {{ showVoiceOverToggle }}|{{ voiceOverEnabled }}|{{ voiceOverLabel }}
    </div>
  `,
})

const NameplateStub = defineComponent({
  name: 'Nameplate',
  props: {
    detail: { type: String, default: '' },
    label: { type: String, default: '' },
  },
  template: '<div class="nameplate-stub">{{ detail }}|{{ label }}</div>',
})

describe('wolvesApp intro status handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hides the prologue nameplate absent a cue-level title and shows it only for the authored override', async () => {
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

    // Ordinary wolves-prologue status (no cue-level nameplateTitle) must hide the
    // entire top-left nameplate rather than showing the default prologue plate.
    intro.vm.$emit('status', {
      currentTime: 10,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)

    intro.vm.$emit('status', {
      currentTime: 50,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
      nameplateTitle: 'From the Age of Dinosaurs to the Pinnacle of Humanity',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('PROLOGUE|From the Age of Dinosaurs to the Pinnacle of Humanity')

    intro.vm.$emit('status', {
      currentTime: 65,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)
  })

  it('shows the Ikora voice-over toggle only during the Destiny intro segment', async () => {
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
    const widget = () => wrapper.getComponent(MediaWidgetStub)

    intro.vm.$emit('status', {
      currentTime: 12,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
      showVoiceOverToggle: false,
      voiceOverEnabled: false,
    })
    await wrapper.vm.$nextTick()

    expect(widget().text()).toBe('false|false|Ikora voice over')

    intro.vm.$emit('status', {
      currentTime: 18,
      duration: 90,
      paused: true,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      showVoiceOverToggle: true,
      voiceOverEnabled: true,
    })
    await wrapper.vm.$nextTick()

    expect(widget().text()).toBe('true|true|Ikora voice over')
  })

  it('normalizes intro native time into canonical segment/sequence progress and preserves overall continuity on handoff', async () => {
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
      currentTime: 62,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(store.segmentIndex).toBe(3)
    expect(store.segmentElapsed).toBeCloseTo(60)
    expect(store.segmentDuration).toBeCloseTo(119.5)
    expect(store.nativeTime).toBe(62)
    expect(store.sequenceElapsed).toBeCloseTo(214)
    expect(store.overallElapsed).toBeCloseTo(214)

    intro.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(store.phase).toBe('cinematic')
    expect(store.overallElapsed).toBeCloseTo(273.5)
  })
})
