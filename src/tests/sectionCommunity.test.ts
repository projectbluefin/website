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

    // Assert the resolved messages — a missing locale key would echo the raw
    // key, which still passes a bare toBeTruthy().
    const tag = wrapper.get('.community-tag strong').text()
    const title = wrapper.get('.community-header h2').text()
    expect(tag).toBe(i18n.global.t('Community.Tag'))
    expect(title).toBe(i18n.global.t('Community.Title'))
    expect(tag).not.toContain('Community.')
    expect(title).not.toContain('Community.')
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

    const title = wrapper.get('.card-content h3').text()
    const description = wrapper.get('.card-content p').text()
    expect(title).toBe(i18n.global.t('Community.Documentation.Title'))
    expect(description).toBe(i18n.global.t('Community.Documentation.Description'))
    expect(title).not.toBe('Community.Documentation.Title')
    expect(description).not.toBe('Community.Documentation.Description')
  })
})
