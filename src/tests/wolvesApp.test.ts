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
    emits: ['update:page'],
    setup(_, { attrs, emit }) {
      comicReaderAttrsSpy({ ...attrs })
      return () => h('button', {
        class: 'comic-reader',
        onClick: () => emit('update:page', 6),
      }, 'WolvesComicReader')
    },
  }),
}))

vi.mock('../components/wolves/WolvesSoundtrack.vue', () => ({
  default: defineComponent({
    name: 'WolvesSoundtrackStub',
    inheritAttrs: false,
    setup(_, { attrs }) {
      soundtrackAttrsSpy({ ...attrs })
      return () => h('div', 'WolvesSoundtrack')
    },
  }),
}))

describe('wolvesApp.vue', () => {
  it('does not couple comic or soundtrack playback through parent bindings', () => {
    mount(WolvesApp)

    expect(comicReaderAttrsSpy).toHaveBeenCalled()
    expect(soundtrackAttrsSpy).toHaveBeenCalled()

    expect(comicReaderAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('autoplay')
    expect(soundtrackAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('playing')
    expect(soundtrackAttrsSpy.mock.lastCall?.[0]).not.toHaveProperty('chapter')
  })

  it('renders title, static lore, qr donate placeholder, newsletter console, and discord mesh link', () => {
    const wrapper = mount(WolvesApp)

    expect(wrapper.text()).toContain('Seven Days to the Wolves')
    expect(wrapper.text()).toContain('JOIN THE MESH (DISCORD)')
    expect(wrapper.text()).toContain('DECRYPTION_STATUS')
    expect(wrapper.text()).toContain(bazziteQuotes[0].attribution)
    expect(wrapper.findAll('a[href="#"]')).toHaveLength(1)
  })

  it('handles email submission in the terminal console card', async () => {
    const wrapper = mount(WolvesApp)

    const input = wrapper.find('.console-input')
    await input.setValue('operative@projectbluefin.io')
    await wrapper.find('.console-form').trigger('submit')

    expect(wrapper.find('.console-feedback').text()).toContain('kubectl rollout status')
  })
})
