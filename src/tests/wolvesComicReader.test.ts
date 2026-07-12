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

  it('starts in paged mode and reports the active page', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })

    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Page By Page')
    await wrapper.get('button[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('renders a tablist with Page By Page and Continuous Scroll tabs', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const tablist = wrapper.get('[role="tablist"]')
    const tabs = tablist.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toBe('Page By Page')
    expect(tabs[1].text()).toBe('Continuous Scroll')
  })

  it('defaults to paged mode with first tab aria-selected=true', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('aria-selected')).toBe('false')
  })

  it('switches to continuous mode when Continuous Scroll tab is clicked', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(tabs[0].attributes('aria-selected')).toBe('false')
  })

  it('shows loading state while PDF is loading', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const loadingEl = wrapper.find('.comic-status-wrap')
    expect(loadingEl.exists()).toBe(true)
    expect(loadingEl.text()).toContain('Loading comic pages')
  })

  it('previous page button is disabled on first page', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    // The control bar's "Previous page" button (inside .reader-controls) should be disabled on page 1.
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
    // Navigate through pages to cross from prologue (1-5) to pursuit (6-10)
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

  // ARIA relations tests
  it('has stable tab IDs: tab-paged and tab-continuous', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('id')).toBe('tab-paged')
    expect(tabs[1].attributes('id')).toBe('tab-continuous')
  })

  it('tabs have aria-controls linking to panel IDs', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('aria-controls')).toBe('panel-paged')
    expect(tabs[1].attributes('aria-controls')).toBe('panel-continuous')
  })

  it('paged panel has role=tabpanel with matching id and aria-labelledby', () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    const pagedPanel = wrapper.find('#panel-paged')
    expect(pagedPanel.attributes('role')).toBe('tabpanel')
    expect(pagedPanel.attributes('aria-labelledby')).toBe('tab-paged')
  })

  it('continuous panel has role=tabpanel with matching id and aria-labelledby', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    const continuousPanel = wrapper.find('#panel-continuous')
    expect(continuousPanel.attributes('role')).toBe('tabpanel')
    expect(continuousPanel.attributes('aria-labelledby')).toBe('tab-continuous')
  })

  it('arrow keys prevent page navigation when focus is inside tablist', async () => {
    const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })

    // Set activeElement to the paged tab
    const pagedTab = wrapper.findAll('[role="tab"]')[0]
    Object.defineProperty(document, 'activeElement', { value: pagedTab.element, writable: true, configurable: true })

    // Dispatch arrow key event
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    window.dispatchEvent(event)

    await wrapper.vm.$nextTick()

    // Should not emit update:page when arrow key is in tablist
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })
})
