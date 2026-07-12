import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { bazziteQuotes } from '../components/wolves/lore'
import WolvesApp from '../WolvesApp.vue'

const { comicReaderAttrsSpy, soundtrackAttrsSpy } = vi.hoisted(() => ({
  comicReaderAttrsSpy: vi.fn(),
  soundtrackAttrsSpy: vi.fn(),
}))

vi.mock('../components/TopNavbar.vue', () => ({
  default: { template: '<div>TopNavbar</div>' },
}))

vi.mock('../components/wolves/WolvesComicReader.vue', () => ({
  default: defineComponent({
    name: 'WolvesComicReaderStub',
    inheritAttrs: false,
    props: {
      chapters: {
        type: Array,
        default: () => [],
      },
    },
    setup(_, { attrs }) {
      comicReaderAttrsSpy({ ...attrs })
      return () => h('div', { class: 'comic-reader' }, 'WolvesComicReader')
    },
  }),
}))

vi.mock('../components/wolves/WolvesSoundtrack.vue', () => ({
  default: defineComponent({
    name: 'WolvesSoundtrackStub',
    inheritAttrs: false,
    setup(_, { attrs }) {
      soundtrackAttrsSpy({ ...attrs })
      return () => h('div', { ...attrs }, 'WolvesSoundtrack')
    },
  }),
}))

describe('wolvesApp.vue', () => {
  it('orders the mobile landmarks comic, soundtrack, lore, and QR codes', () => {
    const wrapper = mount(WolvesApp)
    const ids = wrapper.findAll('[data-testid]').map(node => node.attributes('data-testid'))

    expect(ids).toEqual([
      'wolves-comic-column',
      'wolves-soundtrack',
      'wolves-lore-column',
      'wolves-qr-codes',
    ])
    expect(wrapper.text()).toContain('Seven Days to the Wolves')
    expect(wrapper.text()).toContain(bazziteQuotes[0].attribution)
    expect(wrapper.findAll('.qr-grid')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('JOIN THE MESH (DISCORD)')
  })

  it('does not couple comic page events to the soundtrack', () => {
    const wrapper = mount(WolvesApp)
    const comicReader = wrapper.findComponent({ name: 'WolvesComicReaderStub' })
    const soundtrack = wrapper.findComponent({ name: 'WolvesSoundtrackStub' })

    expect(comicReader.props()).not.toHaveProperty('autoplay')
    expect(comicReaderAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('autoplay')
    expect(soundtrack.props()).toEqual({})
    expect(soundtrackAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('playing')
    expect(soundtrackAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('chapter')
  })
})
