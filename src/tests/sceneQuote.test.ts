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
    // t() must resolve the keys — a missing locale key would echo the raw
    // key into the text and ship a literally broken href.
    expect(authorLink.text()).toBe(i18n.global.t('SpreadQuote.Author'))
    expect(authorLink.text()).not.toBe('SpreadQuote.Author')
    expect(authorLink.attributes('href')).toMatch(/^https?:\/\//)
    expect(authorLink.attributes('target')).toBe('_blank')
  })

  it('renders the quote text inside the blockquote paragraph', () => {
    const wrapper = mountQuote({
      quote: 'SpreadQuote.Quote',
      author: 'SpreadQuote.Author',
      link: 'SpreadQuote.WikiLink',
    })

    const paragraph = wrapper.get('blockquote p')
    // The paragraph text must contain the resolved quote, not the raw key
    expect(paragraph.text()).toContain(i18n.global.t('SpreadQuote.Quote'))
    expect(paragraph.text()).not.toContain('SpreadQuote.Quote')
  })
})
