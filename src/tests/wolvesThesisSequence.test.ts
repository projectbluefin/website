import { describe, expect, it, vi } from 'vitest'
import {
  getWolvesThesisState,
  parseIncomingSignalMessages,
  wolvesIncomingSignalMessages,
} from '../data/wolves-thesis-sequence'

const THESIS_START_SECONDS = 345
const PHRASE_SECONDS = 16 * 60 / 152

describe('wolves thesis sequence', () => {
  it('reads ordered non-empty messages from the editable source', () => {
    expect(wolvesIncomingSignalMessages).toEqual([
      'INCOMING SIGNAL:',
      'Universal Blue to Cloud Native, we\'re coming.',
      'Hikari Protocol: Initialized',
      'KDE Plasma Couplings: ENGAGED',
      'Mechaphippy Deployment: [UNAUTHORIZED]',
      'M2 Status: [ Unknown ]',
      'Field Medical Exoskeleton: [ Missing ]',
      'TARGET ACQUIRED: GOSPO, KYLE. Earth',
      'Kube Status: Earth',
      'Projected Joining: Salt Lake City, Utah, Circa 2026',
      'Chance of Seventh Clone Ascension: ABSOLUTE',
      'Execute Request Order: You have ascended.',
      'Bazzite Mk6 Units: Prepare for Titanfall.',
    ])
  })

  it('returns an immutable empty list for whitespace-only incoming signal sources', () => {
    const messages = parseIncomingSignalMessages(' \n\t \r\n  ')

    expect(messages).toEqual([])
    expect(Object.isFrozen(messages)).toBe(true)
    expect(() => {
      (messages as string[]).push('fallback')
    }).toThrow(TypeError)
  })

  it('keeps thesis state text empty when the incoming signal source has no messages', async () => {
    const sourceModule = '../data/wolves-incoming-signal.txt?raw'
    const sequenceModule = '../data/wolves-thesis-sequence'

    try {
      vi.resetModules()
      vi.doMock(sourceModule, () => ({ default: ' \n\t \r\n  ' }))

      const reloadedSequence = await import(sequenceModule)

      expect(reloadedSequence.wolvesIncomingSignalMessages).toEqual([])
      expect(getWolvesThesisState(THESIS_START_SECONDS).text).toBe(wolvesIncomingSignalMessages[0])
      expect(reloadedSequence.getWolvesThesisState(THESIS_START_SECONDS)).toMatchObject({
        active: true,
        text: '',
        hudLabel: 'Incoming Signal: Universal Blue',
      })
      expect(reloadedSequence.getWolvesThesisState(365).text).toBe('')
    }
    finally {
      vi.doUnmock(sourceModule)
      vi.resetModules()
    }
  })

  it('plays the signal sequence once in sixteen-beat phrases through the finale', () => {
    expect(getWolvesThesisState(THESIS_START_SECONDS).text).toBe(wolvesIncomingSignalMessages[0])
    expect(getWolvesThesisState(THESIS_START_SECONDS + PHRASE_SECONDS - 0.001).text).toBe(wolvesIncomingSignalMessages[0])
    expect(getWolvesThesisState(THESIS_START_SECONDS + PHRASE_SECONDS).text).toBe(wolvesIncomingSignalMessages[1])
    expect(getWolvesThesisState(THESIS_START_SECONDS + PHRASE_SECONDS * 11).text).toBe('Execute Request Order: You have ascended.')
    expect(getWolvesThesisState(THESIS_START_SECONDS + PHRASE_SECONDS * 12).text).toBe('Bazzite Mk6 Units: Prepare for Titanfall.')
    expect(getWolvesThesisState(425).text).toBe('Bazzite Mk6 Units: Prepare for Titanfall.')
  })

  it('preserves the approved thesis window, HUD, and visual modes', () => {
    expect(getWolvesThesisState(344.999).active).toBe(false)
    expect(getWolvesThesisState(345)).toMatchObject({
      active: true,
      mode: 'welcome',
      dayPulse: true,
      hudLabel: 'Incoming Signal: Universal Blue',
    })
    expect(getWolvesThesisState(365)).toMatchObject({
      active: true,
      mode: 'corruption',
      hudLabel: 'Incoming Signal: Universal Blue',
    })
    expect(getWolvesThesisState(395)).toMatchObject({ active: true, mode: 'growing-corruption' })
    expect(getWolvesThesisState(405)).toMatchObject({
      active: true,
      mode: 'legend',
      warning: 'truly a great loss for humanity.',
    })
    expect(getWolvesThesisState(425).active).toBe(true)
    expect(getWolvesThesisState(425.001).active).toBe(false)
  })
})
