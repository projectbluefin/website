import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WolvesSoundtrack from '../components/wolves/WolvesSoundtrack.vue'

describe('wolves soundtrack', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    document.documentElement.classList.remove('wolves-player-active')
  })

  it('does not create the player until the visitor starts the soundtrack', async () => {
    const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })

    expect(wrapper.find('iframe').exists()).toBe(false)
    await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
    expect(wrapper.find('iframe').attributes('src')).toContain('youtube.com/embed/videoseries')
  })

  it('mute control does not exist (would restart iframe player)', () => {
    const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })
    expect(wrapper.find('button[aria-label="Toggle mute"]').exists()).toBe(false)
  })

  it('no persisted start state hides the entry gate', () => {
    // Clear storage, mount, assert start button visible
    sessionStorage.clear()
    const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })
    expect(wrapper.find('button[aria-label="Start soundtrack"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('skips entry gate on reload only after explicit dismiss', () => {
    sessionStorage.setItem('wolves_soundtrack_dismissed', 'true')
    const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })
    expect(wrapper.find('button[aria-label="Start soundtrack"]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
