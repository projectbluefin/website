import { describe, expect, it, vi } from 'vitest'
import {
  getWolvesHudLabel,
  getWolvesThesisState,
  parseEarlySignalMessages,
  parseIncomingSignalMessages,
  wolvesEarlySignalMessages,
  wolvesIncomingSignalMessages,
} from '../data/wolves-thesis-sequence'

const THESIS_START_SECONDS = 345

describe('wolves thesis sequence', () => {
  it('reads ordered non-empty messages from the editable source', () => {
    expect(wolvesIncomingSignalMessages.slice(0, 8)).toEqual([
      'Welcome to Indie Cloud Native',
      'Hikari Protocol: Initialized',
      'KDE Plasma Couplings: ENGAGED',
      'Mechaphippy Deployment: [UNAUTHORIZED]',
      'M2 Status: [ Unknown ]',
      'Field Medical Exoskeleton: [ Missing ]',
      'TARGET ACQUIRED: GOSPO, KYLE',
      'TARGET ACQUIRED: EGGROLL, GLORIOUS',
    ])
    expect(wolvesIncomingSignalMessages[wolvesIncomingSignalMessages.length - 1]).toBe('Software is Supposed to Die')
    expect(wolvesIncomingSignalMessages.every(message => message.length > 0)).toBe(true)
  })

  it('splits the early ambient signals from the climax reports at the delimiter', () => {
    expect(wolvesEarlySignalMessages).toEqual([
      'Welcome to Indie Cloud Native',
      'Hikari Protocol: Initialized',
      'KDE Plasma Couplings: ENGAGED',
      'Mechaphippy Deployment: [UNAUTHORIZED]',
      'M2 Status: [ Unknown ]',
      'Field Medical Exoskeleton: [ Missing ]',
    ])
    expect(parseEarlySignalMessages('a\nb\nc')).toEqual(['a', 'b', 'c'])
    expect(parseEarlySignalMessages('a\n---\nb')).toEqual(['a'])
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
        text: '',
        hudLabel: 'We\'ve got your back.',
      })
      expect(reloadedSequence.getWolvesHudLabel(365)).toBe('Celebrating Five Years of Universal Blue')
    }
    finally {
      vi.doUnmock(sourceModule)
      vi.resetModules()
    }
  })

  it('keeps the finale center overlay to the legend cues only', () => {
    expect(getWolvesThesisState(THESIS_START_SECONDS).text).toBe('')
    expect(getWolvesThesisState(347.75).text).toBe('')
    expect(getWolvesThesisState(350.5).text).toBe('')
    expect(getWolvesThesisState(359).text).toBe('')
    expect(getWolvesThesisState(365).active).toBe(false)
    expect(getWolvesThesisState(405).text).toBe('You have ascended ...')
    expect(getWolvesThesisState(408).text).toBe('Become Legend')
    expect(getWolvesThesisState(425).text).toBe('Become Legend')
  })

  it('leads the finale top statuses with the thesis lines, compresses the signal messages, and finishes on Titanfall', () => {
    expect(getWolvesHudLabel(345)).toBe('We\'ve got your back.')
    expect(getWolvesHudLabel(347.749)).toBe('We\'ve got your back.')
    expect(getWolvesHudLabel(347.75)).toBe('You\'ll never walk alone ...')
    expect(getWolvesHudLabel(350.5)).toBe('We are Universal Blue.')
    expect(getWolvesHudLabel(359)).toBe('Evolve or die ...')
    expect(getWolvesHudLabel(364.999)).toBe('Evolve or die ...')
    const finaleSpan = (408 - 365) / wolvesIncomingSignalMessages.length
    expect(getWolvesHudLabel(365)).toBe(wolvesIncomingSignalMessages[0])
    expect(getWolvesHudLabel(365 + finaleSpan)).toBe(wolvesIncomingSignalMessages[1])
    expect(getWolvesHudLabel(365 + 6 * finaleSpan)).toBe(wolvesIncomingSignalMessages[6])
    expect(getWolvesHudLabel(407.999)).toBe(wolvesIncomingSignalMessages[wolvesIncomingSignalMessages.length - 1])
    expect(getWolvesHudLabel(408)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425.001)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
  })

  it('keeps authored HUD notifications active through thesis-overlay gaps', () => {
    expect(getWolvesHudLabel(12.632)).toBe('Welcome to Indie Cloud Native')
    expect(getWolvesHudLabel(175.96)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.359)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.36)).toBe('Hikari Protocol: Initialized')
    expect(getWolvesHudLabel(228.999)).toBe('pod/thriving-community created')
    expect(getWolvesHudLabel(229)).toBe('Warning: ImagePullBackOff')
    expect(getWolvesHudLabel(276.999)).toBe('"humans/collaboration:latest" is currently experimental.')
    expect(getWolvesHudLabel(277)).toBe('Falling back to "humans/trying-their-best:v1" slowly')
    expect(getWolvesHudLabel(357.632)).toBe('We are Universal Blue.')
  })

  it('holds the opening signal line before the hero run and plays the ambient signals after it', () => {
    // Before the Jorge Bluefin hero window ends (196.36), only the opening
    // line and "The Blue Delivers" may show — no ambient signals that name
    // heroes, and no climax reports.
    for (let time = 0; time < 196.36; time += 1) {
      const label = getWolvesHudLabel(time)
      expect(['Welcome to Indie Cloud Native', 'The Blue Delivers']).toContain(label)
    }
    // The remaining ambient signals compress evenly into the post-hero window,
    // ending on the pod status at the ImagePullBackOff handoff.
    const span = (229 - 196.36) / 6
    expect(getWolvesHudLabel(196.36)).toBe('Hikari Protocol: Initialized')
    expect(getWolvesHudLabel(196.36 + span)).toBe('KDE Plasma Couplings: ENGAGED')
    expect(getWolvesHudLabel(196.36 + 3 * span)).toBe('M2 Status: [ Unknown ]')
    expect(getWolvesHudLabel(196.36 + 4 * span)).toBe('Field Medical Exoskeleton: [ Missing ]')
    expect(getWolvesHudLabel(196.36 + 5 * span)).toBe('pod/thriving-community created')
    // The climax reports stay reserved for the finale compression window.
    for (let time = 196.36; time < 345; time += 0.5) {
      expect(getWolvesHudLabel(time)).not.toMatch(/TARGET ACQUIRED|Kube of Destiny|Projected Joining|Software is Supposed to Die/)
    }
  })

  it('preserves the approved thesis window, HUD, and visual modes', () => {
    expect(getWolvesThesisState(344.999).active).toBe(false)
    expect(getWolvesThesisState(345)).toMatchObject({
      active: true,
      mode: 'welcome',
      dayPulse: true,
      hudLabel: 'We\'ve got your back.',
    })
    expect(getWolvesThesisState(351.316)).toMatchObject({
      active: true,
      mode: 'universal-blue',
      hudLabel: 'We are Universal Blue.',
    })
    expect(getWolvesThesisState(349)).toMatchObject({
      active: true,
      mode: 'welcome',
      hudLabel: 'You\'ll never walk alone ...',
    })
    expect(getWolvesThesisState(395)).toMatchObject({ active: true, mode: 'growing-corruption' })
    expect(getWolvesThesisState(405)).toMatchObject({
      active: true,
      mode: 'legend',
      warning: 'truly a great loss for humanity.',
    })
    expect(getWolvesThesisState(407.999).hudLabel).toBe('Software is Supposed to Die')
    expect(getWolvesThesisState(408)).toMatchObject({
      text: 'Become Legend',
      hudLabel: 'Bazzite Mk6 Units: Prepare for Titanfall',
    })
    expect(getWolvesThesisState(425)).toMatchObject({
      text: 'Become Legend',
      hudLabel: 'Bazzite Mk6 Units: Prepare for Titanfall',
    })
    expect(getWolvesThesisState(425).active).toBe(true)
    expect(getWolvesThesisState(425.001).active).toBe(false)
  })
})
