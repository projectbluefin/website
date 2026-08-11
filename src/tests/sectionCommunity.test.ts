import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SectionCommunity from '../components/sections/SectionCommunity.vue'
import { i18n } from '../locales/schema'

function mountCommunity() {
  return mount(SectionCommunity, {
    global: {
      plugins: [i18n],
      provide: {
        visibleSection: { value: '' },
      },
    },
  })
}

describe('sectionCommunity.vue', () => {
  it('renders the community tag and title from i18n', () => {
    const wrapper = mountCommunity()

    expect(wrapper.get('.community-tag strong').text()).toBeTruthy()
    expect(wrapper.get('.community-header h2').text()).toBeTruthy()
  })

  it('renders three action buttons with correct links', () => {
    const wrapper = mountCommunity()

    const buttons = wrapper.findAll('.community-button')
    expect(buttons).toHaveLength(3)

    const hrefs = buttons.map(b => b.attributes('href'))
    expect(hrefs).toContain('https://docs.projectbluefin.io')
    expect(hrefs).toContain('https://discord.gg/WYCpGEM4sM')
    expect(hrefs).toContain('https://github.com/ublue-os/bluefin/discussions')

    buttons.forEach((btn) => {
      expect(btn.attributes('target')).toBe('_blank')
    })
  })

  it('renders the documentation card with image and description', () => {
    const wrapper = mountCommunity()

    const cardIcon = wrapper.get('.card-icon a')
    expect(cardIcon.attributes('href')).toBe('https://docs.projectbluefin.io')

    const img = cardIcon.get('img')
    expect(img.attributes('alt')).toBe('Bluefin Documentation')

    expect(wrapper.get('.card-content h3').text()).toBeTruthy()
    expect(wrapper.get('.card-content p').text()).toBeTruthy()
  })
})
