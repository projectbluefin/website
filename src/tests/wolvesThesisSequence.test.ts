import { describe, expect, it, vi } from 'vitest'
import {
  getWolvesThesisState,
  parseIncomingSignalMessages,
  wolvesIncomingSignalMessages,
} from '../data/wolves-thesis-sequence'

const THESIS_START_SECONDS = 345

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

  it('does not allow an empty editable signal source to erase the thesis story text', async () => {
    const sourceModule = '../data/wolves-incoming-signal.txt?raw'
    const sequenceModule = '../data/wolves-thesis-sequence'

    try {
      vi.resetModules()
      vi.doMock(sourceModule, () => ({ default: ' \n\t \r\n  ' }))

      const reloadedSequence = await import(sequenceModule)

      expect(reloadedSequence.wolvesIncomingSignalMessages).toEqual([])
      expect(reloadedSequence.getWolvesThesisState(THESIS_START_SECONDS)).toMatchObject({
        active: true,
        text: 'We\'ve got your back.',
        hudLabel: 'Incoming Signal: Universal Blue',
      })
      expect(reloadedSequence.getWolvesThesisState(350.5).text).toBe('We are Universal Blue.')
    }
    finally {
      vi.doUnmock(sourceModule)
      vi.resetModules()
    }
  })

  it('restores the complete approved thesis sequence through the finale', () => {
    expect(getWolvesThesisState(THESIS_START_SECONDS).text).toBe('We\'ve got your back.')
    expect(getWolvesThesisState(347.749).text).toBe('We\'ve got your back.')
    expect(getWolvesThesisState(347.75).text).toBe('You\'ll never walk alone ...')
    expect(getWolvesThesisState(350.5).text).toBe('We are Universal Blue.')
    expect(getWolvesThesisState(359).text).toBe('Evolve or die ...')
    expect(getWolvesThesisState(365).active).toBe(false)
    expect(getWolvesThesisState(405).text).toBe('You have ascended ...')
    expect(getWolvesThesisState(408).text).toBe('Become Legend')
    expect(getWolvesThesisState(425).text).toBe('Become Legend')
  })

  it('preserves the approved thesis window, HUD, and visual modes', () => {
    expect(getWolvesThesisState(344.999).active).toBe(false)
    expect(getWolvesThesisState(345)).toMatchObject({
      active: true,
      mode: 'welcome',
      dayPulse: true,
      hudLabel: 'INCOMING SIGNAL:',
    })
    expect(getWolvesThesisState(351.316)).toMatchObject({
      active: true,
      mode: 'universal-blue',
      hudLabel: 'Universal Blue to Cloud Native, we\'re coming.',
    })
    expect(getWolvesThesisState(349)).toMatchObject({
      active: true,
      mode: 'welcome',
      hudLabel: 'INCOMING SIGNAL:',
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
