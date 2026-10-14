import { describe, expect, it } from 'vitest'
import {
  getTrackZeroSectionMessages,
  getWolvesHudLabel,
  getWolvesThesisState,
  parseEarlySignalMessages,
  parseIncomingSignalMessages,
  wolvesEarlySignalMessages,
  wolvesIncomingSignalMessages,
} from '../data/wolves-thesis-sequence'
import { TRACK_ZERO_SECTIONS } from '../data/wolves-track-zero-beats'
import {
  getTrackZeroFrontStatusMessages,
  getTrackZeroRotatingStatusMessages,
  TRACK_ZERO_LORE_PLAN,
} from '../data/wolves-track-zero-manifest'

const THESIS_START_SECONDS = 345
const DEFAULT_HUD_LABEL = 'Celebrating Five Years of Universal Blue'

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
      'TARGETS ACQUIRED: ZEGLIUS, RENNER, INFFY, LEDIF, GLORIOUS EGGROLL',
    ])
    expect(wolvesIncomingSignalMessages.at(-1)).toBe('The equation must be balanced, think like a dinosaur')
    expect(wolvesIncomingSignalMessages.every(message => message.length > 0)).toBe(true)
  })

  it('queues every non-locked status in authored order, including repeats', () => {
    const messages = getTrackZeroRotatingStatusMessages()

    expect(messages.slice(0, 6)).toEqual([
      'Hikari Protocol: Initialized',
      'KDE Plasma Couplings: ENGAGED',
      'Mechaphippy Deployment: [UNAUTHORIZED]',
      'M2 Status: [ Unknown ]',
      'Field Medical Exoskeleton: [ Missing ]',
      'TARGET ACQUIRED: GOSPO, KYLE',
    ])
    expect(messages.filter(message => message === 'Software is Supposed to Die')).toHaveLength(3)
    expect(messages.at(-1)).toBe('The equation must be balanced, think like a dinosaur')
  })

  it('keeps the finale entries out of the smooth front status queue', () => {
    const messages = getTrackZeroFrontStatusMessages()

    expect(messages).not.toContain('Why do they shackle themselves')
    expect(messages.filter(message => message === 'Mechaphippy Deployment: [UNAUTHORIZED]')).toHaveLength(2)
    expect(messages.at(-1)).toBe('Falling back to "humans/trying-their-best:v1"')
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

  it('uses the ordered Track 0 plan as the signal source', () => {
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
    expect(getWolvesThesisState(TRACK_ZERO_SECTIONS.finaleStart).text).toBe('Become Legend')
    expect(getWolvesThesisState(425).text).toBe('Become Legend')
  })

  it('leads the finale top statuses with the thesis lines, compresses the signal messages, and finishes on Titanfall', () => {
    expect(getWolvesHudLabel(345)).toBe('We\'ve got your back')
    expect(getWolvesHudLabel(347.749)).toBe('We\'ve got your back')
    expect(getWolvesHudLabel(347.75)).toBe('You\'ll never walk alone ...')
    expect(getWolvesHudLabel(350.5)).toBe('We are Universal Blue')
    expect(getWolvesHudLabel(359)).toBe('Evolve or die ...')
    expect(getWolvesHudLabel(364.999)).toBe('Evolve or die ...')
    const finale = getTrackZeroSectionMessages(4)
    const slotDuration = (408 - 365) / finale.length
    expect(getWolvesHudLabel(365)).toBe(finale[0])
    expect(getWolvesHudLabel(365 + slotDuration)).toBe(finale[1])
    expect(getWolvesHudLabel(407.999)).toBe(finale.at(-1))
    expect(getWolvesHudLabel(408)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
    expect(getWolvesHudLabel(425.001)).toBe('Bazzite Mk6 Units: Prepare for Titanfall')
  })

  it('paces every pre-finale status smoothly through unlocked front-of-video time', () => {
    expect(getWolvesHudLabel(1)).toBe('Welcome to Indie Cloud Native')
    expect(getWolvesHudLabel(30)).toBe('Welcome to Indie Cloud Native')
    const front = getTrackZeroFrontStatusMessages()
    const frontSlotDuration = (345 - 41.982 - (196.36 - 175.96) - (212.68 - 200.44) - (215.76 - 212.68)) / front.length
    expect(getWolvesHudLabel(42)).toBe(front[0])
    expect(front).toContain(getWolvesHudLabel(41.982 + frontSlotDuration + 0.1))
    expect(getWolvesHudLabel(140)).not.toBe(DEFAULT_HUD_LABEL)
    expect(getWolvesHudLabel(212.679)).toBe('HAMI brings Bazzite to the KubeCon stage, Amsterdam, 2026')
    expect(getWolvesHudLabel(212.68)).toBe('Bazzite proximity to Kube of Destiny: Critical')
    expect(getWolvesHudLabel(229)).not.toBe(DEFAULT_HUD_LABEL)
    expect(getWolvesHudLabel(276.943)).not.toBe(DEFAULT_HUD_LABEL)
    expect(getWolvesHudLabel(276.944)).not.toBe(DEFAULT_HUD_LABEL)
    expect(getWolvesHudLabel(357.632)).toBe('We are Universal Blue')
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
    expect(getWolvesThesisState(TRACK_ZERO_SECTIONS.finaleStart)).toMatchObject({
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
