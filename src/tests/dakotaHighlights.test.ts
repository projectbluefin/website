import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DakotaHighlights from '../components/dakota/DakotaHighlights.vue'

function mountHighlights() {
  return mount(DakotaHighlights)
}

describe('dakotaHighlights.vue', () => {
  it('renders the GNOME OS hero item spanning full width', () => {
    const wrapper = mountHighlights()

    const gnomeItem = wrapper.get('.brand-gnome')
    expect(gnomeItem.get('.brand-title').text()).toBe('GNOME OS')
    expect(gnomeItem.get('.brand-title').attributes('href')).toBe('https://os.gnome.org')
    expect(gnomeItem.get('p').text()).toContain('latest stable release')
  })

  it('renders all five brand items', () => {
    const wrapper = mountHighlights()

    const items = wrapper.findAll('.brand-item')
    expect(items).toHaveLength(5)
  })

  it('marks external links with target and rel', () => {
    const wrapper = mountHighlights()

    const externalLinks = wrapper.findAll('a.brand-title[href]')
    // Guard against the selector silently matching nothing
    expect(externalLinks).toHaveLength(3)
    externalLinks.forEach((link) => {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })
  })

  it('renders the Freedesktop SDK item with correct link', () => {
    const wrapper = mountHighlights()

    const fsdkLink = wrapper.find('a.brand-title[href="https://freedesktop-sdk.io"]')
    expect(fsdkLink.exists()).toBe(true)
    expect(fsdkLink.text()).toBe('Freedesktop SDK')
  })

  it('renders non-link brand titles as spans', () => {
    const wrapper = mountHighlights()

    const spanTitles = wrapper.findAll('span.brand-title')
    expect(spanTitles.length).toBeGreaterThanOrEqual(1)
    expect(spanTitles.map(s => s.text())).toContain('Designed for Contributors')
  })
})
