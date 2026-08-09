import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrackCredit from '@/components/wolves/cinematic/TrackCredit.vue'

describe('catalogue track credit', () => {
  it('renders the Jorge separator and Bluefin-blue B as structured text', () => {
    const wrapper = mount(TrackCredit, {
      props: {
        title: 'Ava of Death',
        artist: 'Eleine',
      },
    })

    expect(wrapper.get('.wc-track-credit-title').text()).toBe('Ava of Death')
    expect(wrapper.get('.wc-track-credit-separator').text()).toBe('|')
    expect(wrapper.get('.wc-track-credit-separator').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.wc-track-credit-b').text()).toBe('B')
    expect(wrapper.get('.wc-track-credit-byline').text()).toBe('By Eleine')
  })

  it('supports a wider top-nameplate variant without By', () => {
    const wrapper = mount(TrackCredit, {
      props: {
        title: 'Ava of Death',
        artist: 'Eleine',
        showBy: false,
        wide: true,
      },
    })

    expect(wrapper.classes()).toContain('wc-track-credit--wide')
    expect(wrapper.find('.wc-track-credit-b').exists()).toBe(false)
    expect(wrapper.get('.wc-track-credit-byline').text()).toBe('Eleine')
  })
})
