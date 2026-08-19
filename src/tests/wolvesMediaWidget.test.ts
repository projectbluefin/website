import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import { useCinematicStore, WOLVES_DIRECTORS_CUT_EXPERIENCE, WOLVES_EXPERIENCE } from '@/stores/cinematic'

/** Mirrors the widget's own clock formatting so expectations track the real timeline. */
function mmss(seconds: number): string {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

describe('media widget', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    // `activeSegments` is module-level state (see cinematic.ts); restore the
    // standard show so a Director's Cut or catalogue test cannot leak into
    // the next one.
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
  })

  it('drives its primary progress telemetry from the authored overall timeline while keeping segment time secondary', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.jumpToSegment(5)
    store.updateTime(10, 271, 10)

    const wrapper = mount(MediaWidget)
    const asciiProgress = wrapper.get('.wc-widget-progress-ascii')

    expect(asciiProgress.findAll('.is-filled')).toHaveLength(Math.round(store.segmentProgress * 40))
    expect(asciiProgress.findAll('.is-dino')).toHaveLength(Math.floor(Math.round(store.segmentProgress * 40) / 10))
    expect(wrapper.get('.wc-widget-progress').attributes('aria-valuenow')).toBe(String(Math.round(store.segmentProgress * 100)))
    expect(wrapper.text()).not.toContain('DEPLOYMENT: five-years-of-universal-blue')
    expect(wrapper.text()).toContain('0:10 / 4:31')
    // Derived rather than hard-coded: the overall timeline is the sum of every authored
    // intro segment, so adding or retiming one (e.g. the opening title card) shifts these
    // totals. A literal here silently rots the moment the sequence changes.
    expect(wrapper.text()).toContain(`TOTAL ${mmss(store.overallElapsed)} / ${mmss(store.overallDuration)}`)
  })

  it('shows contributor slogans and randomizes Nova glitches in Track 1’s final stretch', async () => {
    const store = useCinematicStore()
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    store.enterCinematic()
    store.updateTime(313.76, 424, 313.76)

    const wrapper = mount(MediaWidget)

    expect(wrapper.findAll('.wc-widget-slogan')).toHaveLength(2)
    expect(wrapper.findAll('.wc-widget-slogan').every(slogan => slogan.text() === '#NOVA4EVER')).toBe(true)

    store.updateTime(314.3, 424, 314.3)
    await nextTick()

    expect(wrapper.findAll('.wc-widget-slogan').every(slogan => slogan.text() === '#FIGHTFORMAINTAINERS')).toBe(true)
    expect(wrapper.findAll('.wc-widget-slogan-bluefin')).toHaveLength(4)
    random.mockRestore()
  })

  it('renders structured title and artist credit for catalogue tracks only', () => {
    const store = useCinematicStore()
    store.loadExperience({
      id: 'album-test',
      title: 'Album Test',
      artwork: 'album.jpg',
      segments: [{
        id: 'track-one',
        kind: 'youtube',
        youtubeId: 'track-one',
        chapter: 'Album Test',
        title: 'Ava of Death',
        artist: 'Eleine',
        artwork: 'track.jpg',
        durationSeconds: 247,
      }],
    })
    store.enterCinematic()

    const wrapper = mount(MediaWidget)

    expect(wrapper.get('.wc-track-credit-title').text()).toBe('Ava of Death')
    expect(wrapper.get('.wc-track-credit-byline').text()).toBe('By Eleine')
  })

  it('renders external single-track playback without mutating the cinematic store', () => {
    const store = useCinematicStore()
    const wrapper = mount(MediaWidget, {
      props: {
        title: 'Trailer 1 — Seven Days to the Wolves',
        artwork: '/poster.webp',
        elapsed: 55,
        duration: 110,
        playing: true,
        showSkipControls: false,
      },
    })

    expect(wrapper.get('.wc-widget-title').text()).toBe('Trailer 1 — Seven Days to the Wolves')
    expect(wrapper.get('.wc-widget-art').attributes('src')).toBe('/poster.webp')
    expect(wrapper.text()).toContain('0:55 / 1:50')
    expect(wrapper.text()).toContain('TOTAL 0:55 / 1:50')
    expect(wrapper.get('.wc-widget-progress').attributes('aria-valuenow')).toBe('50')
    expect(wrapper.findAll('.wc-widget-progress-ascii .is-filled')).toHaveLength(20)
    expect(wrapper.get('button[aria-label="Pause"]').attributes('aria-label')).toBe('Pause')
    expect(wrapper.find('button[aria-label="Previous"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Next"]').exists()).toBe(false)
    expect(store.segmentElapsed).toBe(0)
  })

  it('seeks continuously while the progress slider is dragged', async () => {
    const wrapper = mount(MediaWidget, {
      props: { elapsed: 0, duration: 110 },
    })
    const slider = wrapper.get('.wc-widget-progress')
    const element = slider.element as HTMLElement
    element.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 500,
      bottom: 32,
      width: 400,
      height: 32,
      toJSON: () => ({}),
    }))
    element.setPointerCapture = vi.fn()
    element.hasPointerCapture = vi.fn(() => true)
    element.releasePointerCapture = vi.fn()

    await slider.trigger('pointerdown', { clientX: 200, pointerId: 7, button: 0 })
    await slider.trigger('pointerup', { clientX: 400, pointerId: 7 })

    expect(wrapper.emitted('seek')).toEqual([[0.25], [0.75]])
    expect(element.setPointerCapture).toHaveBeenCalledWith(7)
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('shows the plain authored title, not a catalogue credit, for the Director\'s Cut', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()

    const wrapper = mount(MediaWidget)

    expect(wrapper.find('.wc-track-credit-title').exists()).toBe(false)
    expect(wrapper.find('.wc-track-credit-byline').exists()).toBe(false)
    expect(wrapper.get('.wc-widget-title').text()).toBe(store.segment.title)
  })
})
