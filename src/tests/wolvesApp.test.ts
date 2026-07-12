import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import WolvesApp from '../WolvesApp.vue'

const { comicReaderAttrsSpy, soundtrackAttrsSpy } = vi.hoisted(() => ({
  comicReaderAttrsSpy: vi.fn(),
  soundtrackAttrsSpy: vi.fn(),
}))

// Mock child components to isolate WolvesApp
vi.mock('../components/TopNavbar.vue', () => ({
  default: { template: '<div>TopNavbar</div>' },
}))
vi.mock('../components/wolves/WolvesComicReader.vue', () => ({
  default: defineComponent({
    name: 'WolvesComicReaderStub',
    inheritAttrs: false,
    setup(_, { attrs }) {
      comicReaderAttrsSpy({ ...attrs })
      return () => h('div', 'WolvesComicReader')
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

  it('renders title, dispatch card, newsletter console, and discord mesh link', () => {
    const wrapper = mount(WolvesApp)

    expect(wrapper.text()).toContain('Seven Days to the Wolves')
    expect(wrapper.text()).toContain('Recovered Transmissions')
    expect(wrapper.text()).toContain('JOIN THE MESH (DISCORD)')
    expect(wrapper.text()).toContain('DECRYPTION_STATUS')
  })

  it('runs typewriter on mounting and allows skipping it by clicking the card', async () => {
    const wrapper = mount(WolvesApp)

    // Typewriter is triggered
    // Click viewport to skip
    await wrapper.find('.quote-viewport').trigger('click')

    // After skip, the displayed text should match the current lore entry quote or conversation text
    const vm = wrapper.vm as any
    if (vm.currentLoreEntry.type === 'quote') {
      expect(vm.typedQuoteText).toBe(vm.currentLoreEntry.data.quote)
    }
    else {
      expect(vm.typedMessagesText[0]).toBe(vm.currentLoreEntry.data.messages[0].text)
    }
  })

  it('cycles lore when clicking next/prev buttons', async () => {
    const wrapper = mount(WolvesApp)
    const vm = wrapper.vm as any

    const initialIndex = vm.currentLoreIndex

    // Click next
    await wrapper.find('.quote-nav-btn.next').trigger('click')
    expect(vm.currentLoreIndex).not.toBe(initialIndex)

    // Click prev
    await wrapper.find('.quote-nav-btn.prev').trigger('click')
    expect(vm.currentLoreIndex).toBe(initialIndex)
  })

  it('handles email submission in the terminal console card', async () => {
    const wrapper = mount(WolvesApp)

    const input = wrapper.find('.console-input')
    await input.setValue('operative@projectbluefin.io')

    await wrapper.find('.console-form').trigger('submit')

    // Check feedback
    expect(wrapper.find('.console-feedback').text()).toContain('kubectl rollout status')
  })
})
