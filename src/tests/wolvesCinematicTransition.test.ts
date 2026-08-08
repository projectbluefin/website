import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CinematicTransition from '@/components/wolves/cinematic/CinematicTransition.vue'
import { useCinematicStore } from '@/stores/cinematic'

// These tests drive the store actions the player actually calls
// (`beginCrossfade()` at the start of a handoff, `advanceSegment()` when the
// fade lands) rather than assigning `segmentIndex` directly. Assigning the index
// is what let the overlay watch the wrong signal unnoticed: it only changes once
// the fade is already over, so the overlay covered the opening of the new song
// instead of the seam between the two.
describe('cinematicTransition overlay duration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function enterCinematicAt(index: number) {
    const store = useCinematicStore()
    store.phase = 'cinematic'
    store.showTransitionOverlay = true
    store.segmentIndex = index
    return store
  }

  it('raises the overlay when the crossfade starts, not after it lands', async () => {
    const store = enterCinematicAt(1)
    const wrapper = mount(CinematicTransition)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)

    // The handoff begins. The songs are still cross-fading and `segmentIndex`
    // still names the outgoing segment; the overlay must already be covering it.
    store.beginCrossfade(2)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)
    expect(store.segmentIndex).toBe(1)
  })

  it('stays up across the moment the segment lands', async () => {
    const store = enterCinematicAt(1)
    const wrapper = mount(CinematicTransition)

    store.beginCrossfade(2)
    await wrapper.vm.$nextTick()

    await vi.advanceTimersByTimeAsync(2500)
    store.advanceSegment()
    await wrapper.vm.$nextTick()
    // The fade has completed and `crossfading` has gone back to false. The
    // overlay must not flicker out with it.
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)
  })

  it('announces the incoming segment rather than the one that just ended', async () => {
    const store = enterCinematicAt(1)
    const wrapper = mount(CinematicTransition)

    store.beginCrossfade(2)
    await wrapper.vm.$nextTick()

    const incoming = store.segments[2]
    expect(wrapper.text()).toContain(incoming.title)
    expect(wrapper.text()).not.toContain(store.segments[1].title)
  })

  it('holds the transition overlay for 11 seconds then hides it', async () => {
    const store = enterCinematicAt(1)
    const wrapper = mount(CinematicTransition)

    store.beginCrossfade(2)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(10900)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })

  it('does not trigger the transition overlay if phase is not cinematic', async () => {
    const store = useCinematicStore()
    store.phase = 'intro'
    store.segmentIndex = 0

    const wrapper = mount(CinematicTransition)
    store.beginCrossfade(1)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })

  it('does not show a transition when returning to 7 Days to the Wolves', async () => {
    const store = enterCinematicAt(1)
    const wrapper = mount(CinematicTransition)

    store.beginCrossfade(0)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })

  it('skips the transition overlay for back-catalogue albums', async () => {
    const store = useCinematicStore()
    store.phase = 'cinematic'
    store.showTransitionOverlay = false
    store.segmentIndex = 0

    const wrapper = mount(CinematicTransition)
    store.beginCrossfade(2)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })

  it('does not show a title slide for the Ghosts In The Mist handoff', async () => {
    const store = enterCinematicAt(0)
    const wrapper = mount(CinematicTransition)

    // Segment 1 is ghosts-in-the-mist; its opening guardian plate must stay clear.
    store.beginCrossfade(1)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wc-transition-overlay').exists()).toBe(false)
  })
})
