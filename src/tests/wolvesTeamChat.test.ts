import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WolvesTeamChat from '@/components/wolves/cinematic/WolvesTeamChat.vue'

describe('wolvesTeamChat', () => {
  it('renders reached messages as a log and exposes CNCF command links', () => {
    const sequence = {
      messages: [
        { atSeconds: 1, speaker: 'ALPHA', text: 'First authored line' },
        { atSeconds: 5, speaker: 'BETA', text: 'Second authored line' },
      ],
      finalMessageEndsAtSeconds: 9,
    }

    const wrapper = mount(WolvesTeamChat, {
      props: { elapsedSeconds: 5, sequence },
    })

    expect(wrapper.get('[role="log"]').text()).toContain('ALPHA')
    expect(wrapper.get('[role="log"]').text()).toContain('BETA')
    expect(wrapper.get('a[href="https://contribute.cncf.io"]').text())
      .toBe('xdg-open contribute.cncf.io')
    expect(wrapper.get('a[href="https://ask.cncf.io"]').text())
      .toBe('xdg-open ask.cncf.io')
  })

  it('does not render an empty authored sequence', () => {
    const wrapper = mount(WolvesTeamChat, {
      props: {
        elapsedSeconds: 30,
        sequence: { messages: [], finalMessageEndsAtSeconds: 0 },
      },
    })

    expect(wrapper.find('.wc-team-chat').exists()).toBe(false)
  })
})
