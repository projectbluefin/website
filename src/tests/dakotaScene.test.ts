import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DakotaScene from '../components/dakota/DakotaScene.vue'

function mountScene() {
  return mount(DakotaScene)
}

describe('dakotaScene.vue', () => {
  it('renders the hero title and tag', () => {
    const wrapper = mountScene()

    expect(wrapper.get('.hero-title').text()).toBe('Dakota')
    expect(wrapper.get('.hero-tag strong').text()).toContain('Project Bluefin Presents')
  })

  it('renders the description with expected external links', () => {
    const wrapper = mountScene()

    const desc = wrapper.get('.hero-desc')
    const links = desc.findAll('a')
    const hrefs = links.map(l => l.attributes('href'))

    expect(hrefs).toContain('https://freedesktop-sdk.io')
    expect(hrefs).toContain('https://os.gnome.org')
    expect(hrefs).toContain('https://cncf.io')

    links.forEach((link) => {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })
  })

  it('starts with the text hidden (opacity 0 via CSS class)', () => {
    const wrapper = mountScene()

    expect(wrapper.get('.dakota-text').classes()).not.toContain('is-loaded')
  })
})
