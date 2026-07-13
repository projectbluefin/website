import { describe, expect, it } from 'vitest'
import { getWolvesThesisState } from '../data/wolves-thesis-sequence'

describe('wolves thesis sequence', () => {
  it('preserves the approved thesis timing and final call to action', () => {
    expect(getWolvesThesisState(345)).toMatchObject({ active: true, mode: 'welcome', text: 'We\'ve got your back.', dayPulse: true, hudLabel: 'Incoming Signal: Universal Blue' })
    expect(getWolvesThesisState(347.749)).toMatchObject({ mode: 'welcome', text: 'We\'ve got your back.' })
    expect(getWolvesThesisState(347.75)).toMatchObject({ active: true, mode: 'welcome', text: 'You\'ll never walk alone ...', dayPulse: true, hudLabel: 'Incoming Signal: Universal Blue' })
    expect(getWolvesThesisState(350.499)).toMatchObject({ mode: 'welcome', text: 'You\'ll never walk alone ...' })
    expect(getWolvesThesisState(350.5).text).toBe('We are Universal Blue.')
    expect(getWolvesThesisState(359).text).toBe('Evolve or die ...')
    expect(getWolvesThesisState(395).mode).toBe('growing-corruption')
    expect(getWolvesThesisState(405)).toMatchObject({ mode: 'legend', text: 'You have ascended ...', subtitle: '', warning: 'truly a great loss for humanity.' })
    expect(getWolvesThesisState(408)).toMatchObject({ mode: 'legend', text: 'Become Legend', subtitle: '', warning: 'truly a great loss for humanity.' })
    expect(getWolvesThesisState(425).active).toBe(true)
  })
})
