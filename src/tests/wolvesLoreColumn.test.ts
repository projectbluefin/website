import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { bazziteQuotes } from '../components/wolves/lore'
import WolvesLoreColumn from '../components/wolves/WolvesLoreColumn.vue'
import { wolvesRelease } from '../data/wolves-story'

vi.mock('../utils/loreRotation', () => ({
  shuffleLoreEntries: <T>(entries: T[]) => entries,
}))

describe('wolvesLoreColumn.vue', () => {
  it('renders quote-schema entries from bazzite quotes data', async () => {
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        chapter: wolvesRelease.chapters[1],
      },
    })

    await wrapper.find('.quote-viewport').trigger('click')

    expect(wrapper.text()).toContain(bazziteQuotes[0].quote)
    expect(wrapper.text()).toContain(bazziteQuotes[0].attribution)
    expect(wrapper.text()).toContain(bazziteQuotes[0].context as string)
    expect('person' in bazziteQuotes[0]).toBe(false)
    expect('sourceTitle' in bazziteQuotes[0]).toBe(false)
  })

  it('does not render QR codes inside the lore column', () => {
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        chapter: wolvesRelease.chapters[0],
      },
    })

    expect(wrapper.findComponent({ name: 'WolvesQrCodes' }).exists()).toBe(false)
  })
})
