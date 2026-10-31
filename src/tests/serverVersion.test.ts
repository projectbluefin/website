import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ServerVersion from '../components/server/ServerVersion.vue'

describe('serverVersion.vue', () => {
  it('links to the GitHub releases page in a new tab', () => {
    const wrapper = mount(ServerVersion)

    const link = wrapper.get('a.release-link')
    expect(link.attributes('href')).toBe('https://github.com/projectbluefin/server/releases')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('carries the Beta ribbon on the release box', () => {
    const wrapper = mount(ServerVersion)

    expect(wrapper.get('.release-widget > .corner-ribbon').text()).toBe('Beta')
    expect(wrapper.text()).not.toContain('Alpha')
  })
})
