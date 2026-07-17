import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'

describe('wolves cinematic lobby', () => {
  it('uses the Bluefin brand as its left-aligned title', () => {
    const wrapper = mount(CinematicLobby)

    expect(wrapper.get('.wc-lobby-title').text()).toBe('BLUEFIN')
    expect(wrapper.get('.wc-lobby-frame').classes()).toContain('wc-lobby-frame--left')
  })
})
