import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneQuote from '../components/common/SceneQuote.vue'
import { i18n } from '../locales/schema'

function mountQuote(props: { quote: string, author: string, link: string }) {
  return mount(SceneQuote, {
    props,
    global: {
      plugins: [i18n],
    },
  })
}

describe('sceneQuote.vue', () => {
  it('renders a translated quote with linked attribution', () => {
    const wrapper = mountQuote({
      quote: 'SpreadQuote.Quote',
      author: 'SpreadQuote.Author',
      link: 'SpreadQuote.WikiLink',
    })

    const blockquote = wrapper.find('blockquote')
    expect(blockquote.exists()).toBe(true)

    const cite = wrapper.get('cite')
    const authorLink = cite.get('a')
    expect(authorLink.text()).toBeTruthy()
    expect(authorLink.attributes('href')).toBeTruthy()
    expect(authorLink.attributes('target')).toBe('_blank')
  })

  it('renders the quote text inside the blockquote paragraph', () => {
    const wrapper = mountQuote({
      quote: 'SpreadQuote.Quote',
      author: 'SpreadQuote.Author',
      link: 'SpreadQuote.WikiLink',
    })

    const paragraph = wrapper.get('blockquote p')
    // The paragraph text includes both the quote and the cited author
    expect(paragraph.text().length).toBeGreaterThan(0)
  })
})
