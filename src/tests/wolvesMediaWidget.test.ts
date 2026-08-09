import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import { useCinematicStore } from '@/stores/cinematic'

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
})
