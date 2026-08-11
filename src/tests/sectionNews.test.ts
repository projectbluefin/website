import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SectionNews from '../components/sections/SectionNews.vue'
import { i18n } from '../locales/schema'

function mountNews() {
  // Stub fetch so the child RssFeed does not hit the network
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('offline')
  }))

  return mount(SectionNews, {
    global: {
      plugins: [i18n],
    },
  })
}

describe('sectionNews.vue', () => {
  it('renders the news section title from i18n', () => {
    const wrapper = mountNews()
    expect(wrapper.get('h2').text()).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('embeds the RssFeed component with correct feed URL and perPage', () => {
    const wrapper = mountNews()

    // RssFeed is rendered as a child — verify it received the correct props
    const rssFeed = wrapper.findComponent({ name: 'RssFeed' })
    expect(rssFeed.exists()).toBe(true)
    expect(rssFeed.props('feedUrl')).toBe('https://docs.projectbluefin.io/blog/atom.xml')
    expect(rssFeed.props('perPage')).toBe(5)
    vi.unstubAllGlobals()
  })

  it('has the correct section id for navigation anchoring', () => {
    const wrapper = mountNews()
    expect(wrapper.get('section').attributes('id')).toBe('scene-news')
    vi.unstubAllGlobals()
  })
})
