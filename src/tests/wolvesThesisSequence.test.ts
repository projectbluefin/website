import { describe, expect, it, vi } from 'vitest'
import {
  getWolvesHudLabel,
  getWolvesThesisState,
  parseIncomingSignalMessages,
  wolvesIncomingSignalMessages,
} from '../data/wolves-thesis-sequence'

const THESIS_START_SECONDS = 345

describe('wolves thesis sequence', () => {
  it('reads ordered non-empty messages from the editable source', () => {
    expect(wolvesIncomingSignalMessages).toEqual([
      'Incoming Signal',
      'The Blue Delivers',
      'pod/thriving-community created',
      'Warning: ImagePullBackOff - "humans/collaboration:latest" is currently experimental.',
      'Falling back to "humans/trying-their-best:v1"',
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
        hudLabel: 'Incoming Signal',
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

  it('keeps authored HUD notifications active through thesis-overlay gaps', () => {
    expect(getWolvesHudLabel(175.959)).toBe('Incoming Signal')
    expect(getWolvesHudLabel(175.96)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.359)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.36)).toBe('pod/thriving-community created')
    expect(getWolvesHudLabel(228.999)).toBe('pod/thriving-community created')
    expect(getWolvesHudLabel(229)).toBe('Warning: ImagePullBackOff - "humans/collaboration:latest" is currently experimental.')
    expect(getWolvesHudLabel(276.999)).toBe('Warning: ImagePullBackOff - "humans/collaboration:latest" is currently experimental.')
    expect(getWolvesHudLabel(277)).toBe('Falling back to "humans/trying-their-best:v1"')
    expect(getWolvesHudLabel(407.999)).toBe('Falling back to "humans/trying-their-best:v1"')
    expect(getWolvesHudLabel(408)).toBe('Bazzite Mk6 Units: Prepare for Titanfall.')
    expect(getWolvesHudLabel(425)).toBe('Bazzite Mk6 Units: Prepare for Titanfall.')
    expect(getWolvesHudLabel(425.001)).toBe('Bazzite Mk6 Units: Prepare for Titanfall.')
  })

  it('preserves the approved thesis window, HUD, and visual modes', () => {
    expect(getWolvesThesisState(344.999).active).toBe(false)
    expect(getWolvesThesisState(345)).toMatchObject({
      active: true,
      mode: 'welcome',
      dayPulse: true,
      hudLabel: 'Falling back to "humans/trying-their-best:v1"',
    })
    expect(getWolvesThesisState(351.316)).toMatchObject({
      active: true,
      mode: 'universal-blue',
      hudLabel: 'Falling back to "humans/trying-their-best:v1"',
    })
    expect(getWolvesThesisState(349)).toMatchObject({
      active: true,
      mode: 'welcome',
      hudLabel: 'Falling back to "humans/trying-their-best:v1"',
    })
    expect(getWolvesThesisState(395)).toMatchObject({ active: true, mode: 'growing-corruption' })
    expect(getWolvesThesisState(405)).toMatchObject({
      active: true,
      mode: 'legend',
      warning: 'truly a great loss for humanity.',
    })
    expect(getWolvesThesisState(407.999).hudLabel).toBe('Falling back to "humans/trying-their-best:v1"')
    expect(getWolvesThesisState(408)).toMatchObject({
      text: 'Become Legend',
      hudLabel: 'Bazzite Mk6 Units: Prepare for Titanfall.',
    })
    expect(getWolvesThesisState(425)).toMatchObject({
      text: 'Become Legend',
      hudLabel: 'Bazzite Mk6 Units: Prepare for Titanfall.',
    })
    expect(getWolvesThesisState(425).active).toBe(true)
    expect(getWolvesThesisState(425.001).active).toBe(false)
  })
})
