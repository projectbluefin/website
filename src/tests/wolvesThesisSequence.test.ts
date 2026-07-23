import { describe, expect, it } from 'vitest'
import {
  getWolvesHudLabel,
  getWolvesThesisState,
  parseEarlySignalMessages,
  parseIncomingSignalMessages,
  wolvesEarlySignalMessages,
  wolvesIncomingSignalMessages,
  getTrackZeroSectionMessages,
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
    expect(wolvesIncomingSignalMessages[wolvesIncomingSignalMessages.length - 1]).toBe('The equation must be balanced, think like a dinosaur')
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

  it('recomputes the three formerly locked messages inside their sections', () => {
    expect(getTrackZeroSectionMessages(2)).toContain('Warning: ImagePullBackOff')
    expect(getTrackZeroSectionMessages(3)).toContain('"humans/collaboration:latest" is currently experimental')
    expect(getTrackZeroSectionMessages(3)).toContain('Falling back to "humans/trying-their-best:v1"')
  })

  it('shows each section quote at most once and does not replay earlier sections in the finale', () => {
    for (const sectionIndex of [0, 1, 2, 3, 4]) {
      const messages = getTrackZeroSectionMessages(sectionIndex)
      expect(new Set(messages).size).toBe(messages.length)
      expect(messages.some(message => message.length === 0)).toBe(false)
    }
    const finale = getTrackZeroSectionMessages(4)
    expect(finale).toContain('The equation must be balanced, think like a dinosaur')
    expect(finale.filter(message => message === 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor')).toHaveLength(0)
    expect(finale).not.toContain('Hikari Protocol: Initialized')
  })

  it('uses the ordered Track 0 plan as the signal source', async () => {
    const { TRACK_ZERO_LORE_PLAN } = await import('../data/wolves-track-zero-manifest')
    expect(TRACK_ZERO_LORE_PLAN[0].entries[0]).toMatchObject({ text: 'Welcome to Indie Cloud Native', locked: true })
    expect(wolvesIncomingSignalMessages).toContain('TARGET ACQUIRED: GOSPO, KYLE')
    expect(wolvesIncomingSignalMessages).not.toContain('Add lore here')
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
    expect(getWolvesHudLabel(345)).toBe('We\'ve got your back')
    expect(getWolvesHudLabel(347.749)).toBe('We\'ve got your back')
    expect(getWolvesHudLabel(347.75)).toBe('You\'ll never walk alone ...')
    expect(getWolvesHudLabel(350.5)).toBe('We are Universal Blue')
    expect(getWolvesHudLabel(359)).toBe('Evolve or die ...')
    expect(getWolvesHudLabel(364.999)).toBe('Evolve or die ...')
    const finaleSpan = (408 - 365) / getTrackZeroSectionMessages(4).length
    expect(getWolvesHudLabel(365)).toBe(getTrackZeroSectionMessages(4)[0])
    expect(getWolvesHudLabel(365 + finaleSpan)).toBe(getTrackZeroSectionMessages(4)[1])
    expect(getWolvesHudLabel(365 + 6 * finaleSpan)).toBe(getTrackZeroSectionMessages(4)[6])
    expect(getWolvesHudLabel(407.999)).toBe(getTrackZeroSectionMessages(4)[getTrackZeroSectionMessages(4).length - 1])
    expect(getWolvesHudLabel(408)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425.001)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
  })

  it('keeps authored HUD notifications active through thesis-overlay gaps', () => {
    expect(getWolvesHudLabel(1)).toBe('Welcome to Indie Cloud Native')
    expect(getWolvesHudLabel(175.96)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.359)).toBe('The Blue Delivers')
    expect(getWolvesHudLabel(196.36)).toBe('HAMI brings Bazzite to the KubeCon stage, Amsterdam, 2026')
    expect(getWolvesHudLabel(201.00)).toBe('Bazzite proximity to Kube of Destiny: Critical')
    expect(getWolvesHudLabel(203.00)).toBe('shua_bot: Ensure talent is nurtured, my operator is tired ')
    expect(getWolvesHudLabel(229)).toBe('AN4-ChK-12: Chance of Success: 77.777% and climbing')
    expect(getWolvesHudLabel(276.943)).toBe('Podman Knowledge: [Deployed]')
    expect(getWolvesHudLabel(276.944)).toBe('Buildstream Dakota[GNOMEOS] Prototype: DEADLY')
    expect(getWolvesHudLabel(357.632)).toBe('We are Universal Blue')
  })

  it('holds the opening signal line before the hero run and plays the ambient signals after it', () => {
    // The opening status follows the authored plan and changes before the
    // driving movement; it must not hold until the contributor section.
    expect(getWolvesHudLabel(1)).toBe('Welcome to Indie Cloud Native')
    expect(getWolvesHudLabel(30)).toBe('Welcome to Indie Cloud Native')
    expect(getWolvesHudLabel(42)).toBe('PREVENT OPEN GAMING COLLECTIVE AT ALL COSTS')
    expect(getWolvesHudLabel(140)).not.toBe('Celebrating Five Years of Universal Blue')
    // The remaining ambient signals compress evenly into the post-hero window,
    // ending on the pod status at the ImagePullBackOff handoff.
    const sectionMessages = getTrackZeroSectionMessages(1)
    const postRezaMessages = sectionMessages.slice(6)
    expect(postRezaMessages.length).toBeGreaterThan(0)
    expect(getWolvesHudLabel(202.53)).toBe(postRezaMessages[0])
    expect(getWolvesHudLabel(202.54 + ((229 - 202.53) / postRezaMessages.length))).toBe(postRezaMessages[0])
    // Contributor messages now intentionally occupy the post-hero block.
    for (let time = 229; time < 345; time += 0.5) {
      expect(getWolvesHudLabel(time)).not.toMatch(/TARGET ACQUIRED|Kube of Destiny|Projected Joining|Software is Supposed to Die/)
    }
  })

  it('preserves the approved thesis window, HUD, and visual modes', () => {
    expect(getWolvesThesisState(344.999).active).toBe(false)
    expect(getWolvesThesisState(345)).toMatchObject({
      active: true,
      mode: 'welcome',
      dayPulse: true,
      hudLabel: 'We\'ve got your back',
    })
    expect(getWolvesThesisState(351.316)).toMatchObject({
      active: true,
      mode: 'universal-blue',
      hudLabel: 'We are Universal Blue',
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
    expect(getWolvesThesisState(407.999).hudLabel).toBe('The equation must be balanced, think like a dinosaur')
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
