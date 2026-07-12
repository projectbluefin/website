import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { bazziteQuotes } from '../components/wolves/lore'
import WolvesLoreColumn from '../components/wolves/WolvesLoreColumn.vue'

describe('wolvesLoreColumn.vue', () => {
  it('renders a static accessible placeholder quote list', () => {
    const wrapper = mount(WolvesLoreColumn)
    const items = wrapper.findAll('ol li')

    expect(wrapper.get('ol').attributes('aria-label')).toBe('Recovered transmissions')
    expect(items).toHaveLength(bazziteQuotes.length)
    expect(wrapper.text()).toContain(bazziteQuotes[0].quote)
    expect(wrapper.text()).toContain(bazziteQuotes[0].attribution)
    expect(wrapper.text()).toContain(bazziteQuotes[0].context as string)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('.qr-grid').exists()).toBe(false)
    expect('person' in bazziteQuotes[0]).toBe(false)
    expect('sourceTitle' in bazziteQuotes[0]).toBe(false)
  })
})
