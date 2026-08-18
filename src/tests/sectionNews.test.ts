import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SectionNews from '../components/sections/SectionNews.vue'
import { i18n } from '../locales/schema'

function mountNews() {
  // Stub fetch so the child RssFeed does not hit the network. The stub always
  // rejects, which drives RssFeed into its bundled fallback posts.
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
  // Restore fetch even when an assertion throws, so a failure here cannot
  // poison later tests with the rejecting stub.
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the news section title from i18n', async () => {
    const wrapper = mountNews()
    const title = wrapper.get('h2').text()
    expect(title).toBe(i18n.global.t('News.Title'))
    expect(title).not.toBe('News.Title')
    // Let RssFeed's onMounted fetch settle before the test ends
    await flushPromises()
  })

  it('embeds the RssFeed component with correct feed URL and perPage', async () => {
    const wrapper = mountNews()

    // RssFeed is rendered as a child — verify it received the correct props
    const rssFeed = wrapper.findComponent({ name: 'RssFeed' })
    expect(rssFeed.exists()).toBe(true)
    expect(rssFeed.props('feedUrl')).toBe('https://docs.projectbluefin.io/blog/atom.xml')
    expect(rssFeed.props('perPage')).toBe(5)
    await flushPromises()
  })

  it('has the correct section id for navigation anchoring', async () => {
    const wrapper = mountNews()
    expect(wrapper.get('section').attributes('id')).toBe('scene-news')
    await flushPromises()
  })

  it('renders RssFeed fallback posts once the rejecting fetch settles', async () => {
    const wrapper = mountNews()
    await flushPromises()

    const rssFeed = wrapper.findComponent({ name: 'RssFeed' })
    // Loading is over and the bundled fallback posts are shown
    expect(rssFeed.find('.loading').exists()).toBe(false)
    const posts = rssFeed.findAll('.blog-post')
    expect(posts).toHaveLength(3)
    expect(rssFeed.text()).toContain('Introducing Project Bluefin')
  })
})
