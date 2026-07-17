import type { WolvesTeamChatSequence } from '@/data/wolves-team-chats'
import { describe, expect, it } from 'vitest'
import {
  getVisibleWolvesTeamChatMessages,
  getWolvesTeamChatOpacity,
} from '@/data/wolves-team-chats'

const sequence: WolvesTeamChatSequence = {
  messages: [
    { atSeconds: 2, speaker: 'ALPHA', text: 'First authored line' },
    { atSeconds: 8, speaker: 'BETA', text: 'Second authored line' },
  ],
  finalMessageEndsAtSeconds: 12,
}

describe('wolves team chat timing', () => {
  it('reveals only messages reached by the player clock', () => {
    expect(getVisibleWolvesTeamChatMessages(sequence, 1.999)).toEqual([])
    expect(getVisibleWolvesTeamChatMessages(sequence, 2)).toHaveLength(1)
    expect(getVisibleWolvesTeamChatMessages(sequence, 8)).toHaveLength(2)
  })

  it('fades for four seconds after the final authored message ends', () => {
    expect(getWolvesTeamChatOpacity(sequence, 12)).toBe(1)
    expect(getWolvesTeamChatOpacity(sequence, 14)).toBeCloseTo(0.5)
    expect(getWolvesTeamChatOpacity(sequence, 16)).toBe(0)
  })
})
