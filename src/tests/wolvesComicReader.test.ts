import type { WolvesChapter } from '../data/wolves-story'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WolvesComicReader from '../components/wolves/WolvesComicReader.vue'

const CHAPTERS: WolvesChapter[] = [
  { id: 'prologue', title: 'The Signal', description: 'The archive opens.', pageStart: 1, pageEnd: 5, soundtrackLabel: 'Arrival' },
  { id: 'pursuit', title: 'The Hunt', description: 'The maintainers are pursued.', pageStart: 6, pageEnd: 10, soundtrackLabel: 'Pressure' },
]

// PDF.js is not available in happy-dom; stub the global so loadPdfJs() does not throw.
function stubPdfJs() {
  ;(window as any).pdfjsLib = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 10, getPage: () => Promise.resolve(null), destroy: vi.fn() }),
    }),
  }
}

describe('wolvesComicReader', () => {
  beforeEach(() => {
    delete (window as any).pdfjsLib
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement
      if (typeof (script as any).onload === 'function') {
        stubPdfJs()
        ;(script as any).onload()
      }
      return node
    })

    const mockFetch = vi.fn((url: string) => {
      if (url.includes('wolves-playlist.json')) {
        return Promise.resolve(new Response(JSON.stringify({
          source: { provider: 'youtube', playlistId: '123' },
          tracks: [
            { id: 'track0', title: 'Cover Track', artist: 'Artist 0', youtubeVideoId: '1', bpm: 0 },
            { id: 'track1', title: 'Active Track 1', artist: 'Artist 1', youtubeVideoId: '2', bpm: 120, phraseBeats: 8, fadeDuration: 1000 },
          ]
        })))
      }
      if (url.includes('flickr-photos.json')) {
        return Promise.resolve(new Response(JSON.stringify([
          { id: 'photo1', server: 'srv1', secret: 'sec1', title: 'CNCF Photo 1' },
          { id: 'photo2', server: 'srv2', secret: 'sec2', title: 'CNCF Photo 2' },
          { id: 'photo3', server: 'srv3', secret: 'sec3', title: 'CNCF Photo 3' },
        ])))
      }
      return Promise.resolve(new Response(JSON.stringify({})))
    })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('reports the active page and allows page turning', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })

    await wrapper.get('button[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('shows loading state while PDF is loading', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const loadingEl = wrapper.find('.comic-status-wrap')
    expect(loadingEl.exists()).toBe(true)
    expect(loadingEl.text()).toContain('Loading comic pages')
  })

  it('emits update:page with 1-based page on Next click', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    await wrapper.get('button[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
    await wrapper.get('button[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('update:page')?.[1]).toEqual([3])
  })

  it('emits chapter-change when chapter boundary is crossed', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: CHAPTERS } })
    for (let i = 0; i < 5; i++) {
      await wrapper.get('button[aria-label="Next page"]').trigger('click')
    }
    const emissions = wrapper.emitted('chapterChange') as string[][]
    expect(emissions).toBeTruthy()
    const ids = emissions.flat()
    expect(ids).toContain('pursuit')
  })

  it('removes keydown listener on unmount', async () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    wrapper.unmount()
    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('handles autoplay prop correctly', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        autoplay: true,
      },
    })

    expect(wrapper.props('autoplay')).toBe(true)
  })

  it('handles pacingMode prop correctly', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        autoplay: true,
        pacingMode: 'hyper',
      },
    })

    expect(wrapper.props('pacingMode')).toBe('hyper')
  })

  it('computes activeFlickrIndex and currentBeat correctly based on playlistCurrentTime and track properties', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        trackIndex: 1,
        playlistCurrentTime: 12,
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    const len = (wrapper.vm as any).mixedPhotos.length
    expect((wrapper.vm as any).currentBeat).toBe(24)
    expect((wrapper.vm as any).activeFlickrIndex).toBe(1 % len)

    await wrapper.setProps({ playlistCurrentTime: 18 })
    expect((wrapper.vm as any).currentBeat).toBe(36)
    expect((wrapper.vm as any).activeFlickrIndex).toBe(2 % len)
  })

  it('hides manual navigation buttons in Live Gallery Mode (trackIndex > 0)', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        trackIndex: 1,
        playlistCurrentTime: 0,
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    const prevBtn = wrapper.find('button[aria-label="Previous page"]')
    const nextBtn = wrapper.find('button[aria-label="Next page"]')

    expect((prevBtn.element as any).style.display).toBe('none')
    expect((nextBtn.element as any).style.display).toBe('none')
  })

  it('allows manual navigation buttons when not in Live Gallery Mode (trackIndex = 0)', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        trackIndex: 0,
        page: 2,
      },
    })

    const vm = wrapper.vm as any
    vm.pdfLoading = false
    vm.pdfError = ''
    await wrapper.vm.$nextTick()

    const prevBtn = wrapper.find('button[aria-label="Previous page"]')
    const nextBtn = wrapper.find('button[aria-label="Next page"]')

    expect(prevBtn.isVisible()).toBe(true)
    expect(nextBtn.isVisible()).toBe(true)
  })

  it('correctly transitions and double-buffers Flickr photos', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        trackIndex: 1,
        playlistCurrentTime: 0,
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    const len = (wrapper.vm as any).mixedPhotos.length
    expect((wrapper.vm as any).activePhotoIndex).toBe(0 % len)
    expect((wrapper.vm as any).previousPhotoIndex).toBeNull()

    await wrapper.setProps({ playlistCurrentTime: 18 })
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).activePhotoIndex).toBe((2 % len))
    expect((wrapper.vm as any).previousPhotoIndex).toBe(0 % len)
    expect((wrapper.vm as any).isPhotoTransitioning).toBe(true)

    const layer = wrapper.find('.flickr-photo-layer.fading-out')
    expect(layer.exists()).toBe(true)
  })

  it('correctly initializes the experimental timeline and resolves active slide details', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        trackIndex: 0,
        playlistCurrentTime: 0,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.isExperimental).toBe(true)

    // Verify timeline is constructed
    const timeline = vm.timelineSlides
    expect(timeline.length).toBeGreaterThan(0)

    // No duplicate slides across the timeline
    const ids = timeline.map((s: any) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)

    // Check Section 1 slide durations: Day/Night should be 127/17 * 2, Single should be 127/17
    const daynightSlide = timeline.find((s: any) => s.type === 'daynight')
    if (daynightSlide) {
      expect(daynightSlide.duration).toBeCloseTo((127 / 17) * 2)
    }

    const singleSlide = timeline.find((s: any) => s.type === 'single' && s.startTime < 127)
    if (singleSlide) {
      expect(singleSlide.duration).toBeCloseTo(127 / 17)
    }

    // Verify opacity transitions for day/night slide
    if (daynightSlide) {
      await wrapper.setProps({ playlistCurrentTime: daynightSlide.startTime })
      expect(vm.daynightNightOpacity).toBe(0)

      await wrapper.setProps({ playlistCurrentTime: daynightSlide.startTime + (daynightSlide.duration / 2) })
      expect(vm.daynightNightOpacity).toBeCloseTo(0.5)

      await wrapper.setProps({ playlistCurrentTime: daynightSlide.startTime + daynightSlide.duration - 0.01 })
      expect(vm.daynightNightOpacity).toBeCloseTo(0.999, 1)
    }
  })
})
