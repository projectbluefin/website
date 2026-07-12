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

  it('previous page button is disabled on first page', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const prevBtn = wrapper.get('.reader-controls button[aria-label="Previous page"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
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

  it('renders autoplay toggle button and allows toggling it off/on', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        chapters: [],
        autoplay: true,
      },
    })

    const toggleBtn = wrapper.get('.autoplay-toggle-btn')
    expect(toggleBtn.text()).toContain('AUTO')

    await toggleBtn.trigger('click')
    expect(toggleBtn.text()).toContain('MANUAL')
  })
})
