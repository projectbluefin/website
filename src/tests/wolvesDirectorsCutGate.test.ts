import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import { useCinematicStore } from '@/stores/cinematic'
import WolvesApp from '@/WolvesApp.vue'

// The wall itself. Everything below asserts what a deployed build does, so the gate is forced
// off for the whole file rather than per test.
vi.mock('@/config/wolves-directors-cut-gate', () => ({ DIRECTORS_CUT_ENABLED: false }))

function lobbyStubs() {
  return {
    WolvesBackCatalogue: { template: '<section class="wolves-back-catalogue-stub" />' },
    WolvesCharacterGallery: { template: '<div class="wolves-character-gallery-stub" />' },
    WolvesQrCodes: { template: '<section class="wolves-qr-codes-stub" />' },
  }
}

function appStubs() {
  return {
    CinematicLobby: defineComponent({
      name: 'CinematicLobby',
      emits: ['enter', 'enter-directors-cut', 'launchExperience', 'watchGuardian'],
      template: '<div class="cinematic-lobby-stub" />',
    }),
    CinematicStage: defineComponent({
      name: 'CinematicStage',
      setup(_, { expose }) {
        expose({
          prepare: vi.fn(),
          start: vi.fn(),
          releaseHandoff: vi.fn(),
          destroy: vi.fn(),
          togglePlay: vi.fn(),
          seekTo: vi.fn(),
          seekToRatio: vi.fn(),
          skip: vi.fn(),
        })
        return {}
      },
      template: '<div class="cinematic-stage-stub" />',
    }),
    WolvesIntroOverlay: defineComponent({
      name: 'WolvesIntroOverlay',
      emits: ['status', 'complete'],
      setup(_, { expose }) {
        expose({
          next: vi.fn(),
          previous: vi.fn(),
          toggle: vi.fn(),
          seekToRatio: vi.fn(),
          setVoiceOverEnabled: vi.fn(),
          setCaptionsEnabled: vi.fn(),
        })
        return {}
      },
      template: '<div class="wolves-intro-overlay-stub" />',
    }),
    MediaWidget: { template: '<div class="media-widget-stub" />' },
    Nameplate: { template: '<div class="nameplate-stub" />' },
  }
}

describe('director\'s cut production wall', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not render the Director\'s Cut invitation in the lobby', () => {
    const wrapper = mount(CinematicLobby, { global: { stubs: lobbyStubs() } })

    // The whole block goes, not just the button: the teaser copy promises a cut the build
    // cannot play, which reads as a broken link rather than a hidden feature.
    expect(wrapper.find('.wc-lobby-directors-cut').exists()).toBe(false)
    expect(wrapper.find('.wc-lobby-directors-cut-btn').exists()).toBe(false)
    expect(wrapper.find('.wc-lobby-directors-cut-copy').exists()).toBe(false)

    // The standard front door is untouched. A wall that also takes out the public show is
    // not a wall, it is an outage.
    expect(wrapper.find('.wolves-back-catalogue-stub').exists()).toBe(true)
  })

  it('ignores the ?directors-cut deep link', async () => {
    const store = useCinematicStore()
    const originalSearch = window.location.search
    vi.stubGlobal('location', { ...window.location, search: '?directors-cut' })

    shallowMount(WolvesApp, { global: { stubs: appStubs() } })
    await flushPromises()

    // Hiding the button while the parameter still works is the failure this guards against:
    // the link outlives the button in URLs, chat logs, and recording scripts.
    expect(store.phase).toBe('lobby')

    vi.stubGlobal('location', { ...window.location, search: originalSearch })
  })
})
