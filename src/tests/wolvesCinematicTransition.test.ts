import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CinematicTransition from '@/components/wolves/cinematic/CinematicTransition.vue'
import { useCinematicStore } from '@/stores/cinematic'

describe('cinematicTransition overlay duration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds the transition overlay for 6 seconds then hides it', async () => {
    const store = useCinematicStore()
    store.phase = 'cinematic'
    store.segmentIndex = 0

    const wrapper = mount(CinematicTransition)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)

    // Trigger transition by changing segmentIndex
    store.segmentIndex = 1
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)

    // Advance 5.9 seconds
    await vi.advanceTimersByTimeAsync(5900)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)

    // Complete the 6 seconds
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })

  it('does not trigger the transition overlay if phase is not cinematic', async () => {
    const store = useCinematicStore()
    store.phase = 'intro'
    store.segmentIndex = 0

    const wrapper = mount(CinematicTransition)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)

    store.segmentIndex = 1
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })
})
