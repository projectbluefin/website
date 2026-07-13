import { describe, expect, it } from 'vitest'
import { getWolvesThesisState } from '../data/wolves-thesis-sequence'

describe('wolves thesis sequence', () => {
  it('preserves the approved thesis timing and final call to action', () => {
    expect(getWolvesThesisState(345)).toMatchObject({ active: true, mode: 'welcome', dayPulse: true, hudLabel: 'Incoming Signal: Universal Blue' })
    expect(getWolvesThesisState(350.5).text).toBe('We are Universal Blue.')
    expect(getWolvesThesisState(355).text).toBe('Evolve or die ...')
    expect(getWolvesThesisState(395).mode).toBe('growing-corruption')
    expect(getWolvesThesisState(405)).toMatchObject({ mode: 'legend', text: 'Become Legend', subtitle: 'You have ascended ...', warning: 'truly a great loss for humanity.' })
    expect(getWolvesThesisState(425).active).toBe(true)
  })
})
