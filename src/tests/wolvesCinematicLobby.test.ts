import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'

describe('wolves cinematic lobby', () => {
  it('keeps the pre-a278 lobby splash title and centered frame', () => {
    const wrapper = mount(CinematicLobby)

    expect(wrapper.get('.wc-lobby-title').text()).toBe('SEVEN DAYSTO THE WOLVES')
    expect(wrapper.get('.wc-lobby-frame').classes()).not.toContain('wc-lobby-frame--left')
  })
})
