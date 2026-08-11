import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DakotaScene from '../components/dakota/DakotaScene.vue'

function mountScene() {
  return mount(DakotaScene)
}

describe('dakotaScene.vue', () => {
  // The component reveals its text via a 150 ms setTimeout in onMounted;
  // fake timers keep that timer from leaking past the end of a test.
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the hero title and tag', () => {
    const wrapper = mountScene()

    expect(wrapper.get('.hero-title').text()).toBe('Dakota')
    expect(wrapper.get('.hero-tag strong').text()).toContain('Project Bluefin Presents')
  })

  it('renders the description with expected external links', () => {
    const wrapper = mountScene()

    const desc = wrapper.get('.hero-desc')
    const links = desc.findAll('a')
    expect(links.length).toBeGreaterThan(0)
    const hrefs = links.map(l => l.attributes('href'))

    expect(hrefs).toContain('https://freedesktop-sdk.io')
    expect(hrefs).toContain('https://os.gnome.org')
    expect(hrefs).toContain('https://cncf.io')

    links.forEach((link) => {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })
  })

  it('starts hidden and reveals the text once the mount timer fires', async () => {
    const wrapper = mountScene()

    // Hidden until the 150 ms onMounted timer fires
    expect(wrapper.get('.dakota-text').classes()).not.toContain('is-loaded')

    vi.advanceTimersByTime(150)
    await nextTick()

    expect(wrapper.get('.dakota-text').classes()).toContain('is-loaded')
  })
})
