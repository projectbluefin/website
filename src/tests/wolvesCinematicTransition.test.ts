import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CinematicTransition from '@/components/wolves/cinematic/CinematicTransition.vue'
import { useCinematicStore } from '@/stores/cinematic'

describe('cinematicTransition player-timed decay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('holds the shell for 10 seconds and decays over four seconds', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1
    const wrapper = mount(CinematicTransition)

    store.updateTime(10, 180)
    await wrapper.vm.$nextTick()
    expect(Number(wrapper.get('.wc-transition-shell').attributes('data-opacity'))).toBe(1)

    store.updateTime(12, 180)
    await wrapper.vm.$nextTick()
    expect(Number(wrapper.get('.wc-transition-shell').attributes('data-opacity'))).toBeCloseTo(0.5)

    store.updateTime(14, 180)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.wc-transition-shell').exists()).toBe(false)
  })

  it('restores shell opacity correctly after seeking backward', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1
    const wrapper = mount(CinematicTransition)

    store.updateTime(14, 180)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.wc-transition-shell').exists()).toBe(false)

    store.updateTime(3, 180)
    await wrapper.vm.$nextTick()
    expect(Number(wrapper.get('.wc-transition-shell').attributes('data-opacity'))).toBe(1)
  })

  it('does not render the transition shell for track index 0', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 0
    const wrapper = mount(CinematicTransition)

    store.updateTime(2, 180)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.wc-transition-shell').exists()).toBe(false)
  })
})

describe('cinematicTransition layer separation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('keeps team chat outside the fading transition shell', async () => {
    vi.doMock('@/data/wolves-team-chats', async () => {
      const actual = await vi.importActual<typeof import('@/data/wolves-team-chats')>(
        '@/data/wolves-team-chats',
      )
      return {
        ...actual,
        WOLVES_TEAM_CHATS: {
          ...actual.WOLVES_TEAM_CHATS,
          'ghosts-in-the-mist': {
            messages: [
              { atSeconds: 0, speaker: 'ALPHA', text: 'Fixture chat line' },
            ],
            finalMessageEndsAtSeconds: 300,
          },
        },
      }
    })

    const { default: MockedCinematicTransition } = await import(
      '@/components/wolves/cinematic/CinematicTransition.vue'
    )
    const { useCinematicStore: useMockedCinematicStore } = await import('@/stores/cinematic')

    const store = useMockedCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1
    store.updateTime(2, 180)

    const wrapper = mount(MockedCinematicTransition)
    await wrapper.vm.$nextTick()

    const shell = wrapper.find('.wc-transition-shell')
    const chat = wrapper.find('.wc-team-chat')

    expect(shell.exists()).toBe(true)
    expect(chat.exists()).toBe(true)
    expect(shell.element.contains(chat.element)).toBe(false)

    vi.doUnmock('@/data/wolves-team-chats')
  })
})
