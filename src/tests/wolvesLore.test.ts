import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WolvesLoreColumn from '../components/wolves/WolvesLoreColumn.vue'
import quoteData from '../data/bazzite-quotes.json'

interface BazziteQuote {
  quote: string
  attribution: string
  context?: string
  date?: string
}

const quotes = quoteData as BazziteQuote[]

describe('wolvesLoreColumn', () => {
  it('contains exactly five final-schema lorem ipsum placeholders', () => {
    expect(quotes).toHaveLength(5)

    for (const [index, entry] of quotes.entries()) {
      expect(Object.keys(entry).sort()).toEqual(['attribution', 'context', 'date', 'quote'])
      expect(entry).toMatchObject({
        quote: expect.stringMatching(/^Lorem ipsum/i),
        attribution: `Placeholder Dispatch 0${index + 1}`,
        context: 'Approved Discord quote placeholder',
        date: `2099-01-0${index + 1}`,
      })
      expect(entry).not.toHaveProperty('person')
      expect(entry).not.toHaveProperty('sourceType')
      expect(entry).not.toHaveProperty('sourceTitle')
      expect(entry).not.toHaveProperty('sourceDetail')
    }

    const wrapper = mount(WolvesLoreColumn)
    expect(wrapper.get('ol').attributes('aria-label')).toBe('Recovered transmissions')
    expect(wrapper.findAll('.lore-entry')).toHaveLength(5)
    expect(wrapper.findAll('.qr-grid')).toHaveLength(1)
    expect(wrapper.get('[data-testid="wolves-qr-codes"]').attributes('data-testid')).toBe('wolves-qr-codes')
    expect(wrapper.text()).toContain(quotes[0].quote)
    expect(quotes.every(entry => wrapper.text().includes(entry.attribution))).toBe(true)
  })
})
