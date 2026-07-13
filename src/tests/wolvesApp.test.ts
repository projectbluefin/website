import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WolvesApp from '../WolvesApp.vue'

vi.mock('../data/wolves-soundtrack', () => ({
  loadWolvesSoundtrack: vi.fn().mockResolvedValue({
    source: { provider: 'youtube', playlistId: 'test' },
    tracks: [],
  }),
}))

vi.mock('../components/TopNavbar.vue', () => ({
  default: { template: '<div>TopNavbar</div>' },
}))

vi.mock('../components/wolves/WolvesComicReader.vue', () => ({
  default: {
    props: ['trackIndex', 'playlistCurrentTime'],
    template: '<div class="comic-reader" :data-track-index="trackIndex" :data-current-time="playlistCurrentTime">WolvesComicReader</div>',
  },
}))

vi.mock('../components/wolves/WolvesSoundtrack.vue', () => ({
  default: {
    props: ['playing', 'chapter', 'loreCopied'],
    emits: ['progress'],
    template: '<div class="soundtrack-chapter">{{ chapter?.id ?? `none` }}</div>',
  },
}))

vi.mock('../components/wolves/WolvesLoreColumn.vue', () => ({
  default: {
    props: ['artifactId', 'duration'],
    template: '<div class="lore-artifact">{{ artifactId }}</div>',
  },
}))

vi.mock('../components/wolves/WolvesQrCodes.vue', () => ({
  default: {
    template: '<div class="wolves-qr-codes">WolvesQrCodes</div>',
  },
}))

describe('wolvesApp.vue', () => {
  it('renders the page title, bottom QR section, and has experience button', () => {
    const wrapper = mount(WolvesApp)

    expect(wrapper.text()).toContain('Seven Days to the Wolves')
    expect(wrapper.find('.wolves-page-qr').exists()).toBe(true)
    expect(wrapper.find('.wolves-qr-codes').exists()).toBe(true)
    expect(wrapper.find('.experience-cta-btn').exists()).toBe(true)
  })

  it('passes the timeline-selected artifact to lore in immersive mode', async () => {
    const wrapper = mount(WolvesApp)

    // Initially immersive elements are not rendered
    expect(wrapper.find('.comic-reader').exists()).toBe(false)

    // Click button to enter immersive mode
    await wrapper.find('.experience-cta-btn').trigger('click')

    // Now elements are rendered
    expect(wrapper.find('.comic-reader').exists()).toBe(true)
    expect(wrapper.find('.lore-artifact').text()).toBe('arthur-c-clarke-4')

    const soundtrack = wrapper.findComponent({ name: 'WolvesSoundtrack' })
    await soundtrack.vm.$emit('progress', { currentTime: 180, duration: 423, playlistIndex: 0 })

    expect(wrapper.find('.lore-artifact').text()).toBe('lorem-pursuit-1')
  })

  it('preserves the Track 0 story and lore split after playback progress begins', async () => {
    const wrapper = mount(WolvesApp)

    await wrapper.get('.experience-cta-btn').trigger('click')
    await wrapper.findComponent({ name: 'WolvesSoundtrack' }).vm.$emit('progress', {
      currentTime: 180,
      duration: 423,
      playlistIndex: 0,
    })

    expect(wrapper.find('.comic-reader').exists()).toBe(true)
    expect(wrapper.find('.lore-artifact').text()).toBe('lorem-pursuit-1')
  })

  it('keeps the Track 0 reader time and lore under the entering Equinox overlay', async () => {
    vi.useFakeTimers()

    try {
      const wrapper = mount(WolvesApp)

      await wrapper.get('.experience-cta-btn').trigger('click')
      const soundtrack = wrapper.findComponent({ name: 'WolvesSoundtrack' })
      await soundtrack.vm.$emit('progress', {
        currentTime: 180,
        duration: 240,
        playlistIndex: 0,
      })
      await soundtrack.vm.$emit('progress', {
        currentTime: 0,
        duration: 240,
        playlistIndex: 1,
      })

      expect(wrapper.find('.equinox-overlay').exists()).toBe(true)
      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('narrative-split')
      expect(wrapper.get('.immersive-content-grid').classes()).not.toContain('equinox-active')
      expect(wrapper.find('.lore-artifact').text()).toBe('lorem-pursuit-1')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('0')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('180')

      await vi.advanceTimersByTimeAsync(1499)

      expect(wrapper.find('.equinox-overlay').exists()).toBe(true)
      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('narrative-split')
      expect(wrapper.find('.lore-artifact').text()).toBe('lorem-pursuit-1')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('0')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('180')

      await vi.advanceTimersByTimeAsync(1)

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('centered-gallery')
      expect(wrapper.find('.comic-reader').exists()).toBe(true)
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('1')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('0')
      expect(wrapper.find('.lore-artifact').exists()).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('ignores a stale presentation handoff when tracks change rapidly', async () => {
    vi.useFakeTimers()

    try {
      const wrapper = mount(WolvesApp)

      await wrapper.get('.experience-cta-btn').trigger('click')
      const soundtrack = wrapper.findComponent({ name: 'WolvesSoundtrack' })
      await soundtrack.vm.$emit('progress', { currentTime: 180, duration: 240, playlistIndex: 0 })
      await soundtrack.vm.$emit('progress', { currentTime: 0, duration: 240, playlistIndex: 1 })
      await vi.advanceTimersByTimeAsync(1000)
      await soundtrack.vm.$emit('progress', { currentTime: 0, duration: 240, playlistIndex: 2 })
      await vi.advanceTimersByTimeAsync(500)

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('narrative-split')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('0')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('180')

      await vi.advanceTimersByTimeAsync(1000)

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('centered-gallery')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('2')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('0')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('resets the Track 0 presentation when re-entering before player progress', async () => {
    vi.useFakeTimers()

    try {
      const wrapper = mount(WolvesApp)

      await wrapper.get('.experience-cta-btn').trigger('click')
      const soundtrack = wrapper.findComponent({ name: 'WolvesSoundtrack' })
      await soundtrack.vm.$emit('progress', { currentTime: 180, duration: 240, playlistIndex: 0 })
      await soundtrack.vm.$emit('progress', { currentTime: 12, duration: 240, playlistIndex: 1 })
      await vi.advanceTimersByTimeAsync(1500)

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('centered-gallery')
      expect(wrapper.find('.lore-artifact').exists()).toBe(false)
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('1')

      await soundtrack.vm.$emit('progress', { currentTime: 12, duration: 240, playlistIndex: 2 })
      await wrapper.get('.hud-exit-btn').trigger('click')
      await wrapper.get('.experience-cta-btn').trigger('click')

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('narrative-split')
      expect(wrapper.find('.lore-artifact').text()).toBe('arthur-c-clarke-4')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('0')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('0')

      await vi.advanceTimersByTimeAsync(1500)

      expect(wrapper.get('.immersive-content-grid').attributes('data-presentation')).toBe('narrative-split')
      expect(wrapper.find('.lore-artifact').text()).toBe('arthur-c-clarke-4')
      expect(wrapper.get('.comic-reader').attributes('data-track-index')).toBe('0')
      expect(wrapper.get('.comic-reader').attributes('data-current-time')).toBe('0')
    }
    finally {
      vi.useRealTimers()
    }
  })
})
