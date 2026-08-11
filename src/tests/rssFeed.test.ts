import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RssFeed from '../components/RssFeed.vue'
import { i18n } from '../locales/schema'

const FEED_URL = 'https://docs.projectbluefin.io/atom.xml'

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Bluefin Blog</title>
  <entry>
    <title>Post One</title>
    <link href="https://docs.projectbluefin.io/blog/post-one"/>
    <published>2024-02-01T10:00:00Z</published>
    <summary>First post summary</summary>
  </entry>
  <entry>
    <title>Post Two</title>
    <link href="https://docs.projectbluefin.io/blog/post-two"/>
    <published>2024-02-08T10:00:00Z</published>
    <summary>Second post summary</summary>
  </entry>
  <entry>
    <title>Post Three</title>
    <link href="https://docs.projectbluefin.io/blog/post-three"/>
    <published>2024-02-15T10:00:00Z</published>
    <summary>Third post summary</summary>
  </entry>
</feed>`

function mountFeed(props: { feedUrl: string, perPage?: number }) {
  return mount(RssFeed, {
    props,
    global: {
      plugins: [i18n],
    },
  })
}

describe('rssFeed.vue', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders posts from the live feed, limited by perPage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => ATOM_XML,
    })))

    const wrapper = mount(RssFeed, {
      props: { feedUrl: FEED_URL, perPage: 2 },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const posts = wrapper.findAll('article.blog-post')
    expect(posts).toHaveLength(2)
    expect(posts[0].get('.post-title a').text()).toBe('Post One')
    expect(posts[0].get('.post-title a').attributes('href'))
      .toBe('https://docs.projectbluefin.io/blog/post-one')
    expect(posts[0].get('.post-date').text()).toBe('February 1, 2024')

    const viewAll = wrapper.get('.feed-source a')
    expect(viewAll.attributes('href')).toBe('https://docs.projectbluefin.io')
  })

  it('falls back to bundled posts when the live feed is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    const wrapper = mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    const posts = wrapper.findAll('article.blog-post')
    expect(posts).toHaveLength(3)
    expect(posts[0].get('.post-title a').text()).toBe('Introducing Project Bluefin')
  })

  it('applies perPage to the fallback posts as well', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL, perPage: 1 })
    await flushPromises()

    expect(wrapper.findAll('article.blog-post')).toHaveLength(1)
  })

  it('requests the configured feed URL with CORS mode', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => ATOM_XML,
    }))
    vi.stubGlobal('fetch', fetchMock)

    mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      FEED_URL,
      expect.objectContaining({ mode: 'cors' }),
    )
  })

  it('shows the loading state until the feed resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const wrapper = mountFeed({ feedUrl: FEED_URL })

    expect(wrapper.get('.loading').text()).toBe('Loading blog posts...')
    expect(wrapper.findAll('article.blog-post')).toHaveLength(0)
  })

  it('shows the empty state when the feed parses but has no entries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => `<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom"><title>Bluefin Blog</title></feed>`,
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    // An empty feed is not an error: no fallback posts, just the empty state.
    expect(wrapper.findAll('article.blog-post')).toHaveLength(0)
    expect(wrapper.get('.no-posts').text()).toBe('No blog posts found.')
  })

  it('falls back to bundled posts when the feed XML is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => '<feed><entry></feed>',
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    const posts = wrapper.findAll('article.blog-post')
    expect(posts).toHaveLength(3)
    expect(posts[0].get('.post-title a').text()).toBe('Introducing Project Bluefin')
  })

  it('renders fallback values for entries missing title, link, or date', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => `<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <summary>Only a summary, nothing else</summary>
          </entry>
          <entry>
            <title>Dated-less Post</title>
            <link href="https://docs.projectbluefin.io/blog/no-date"/>
          </entry>
        </feed>`,
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    const posts = wrapper.findAll('article.blog-post')
    expect(posts).toHaveLength(2)

    // Missing title and link degrade to 'Untitled' and '#'.
    expect(posts[0].get('.post-title a').text()).toBe('Untitled')
    expect(posts[0].get('.post-title a').attributes('href')).toBe('#')
    expect(posts[0].get('.post-description').text()).toContain('Only a summary')

    // Missing published date hides the time element entirely.
    expect(posts[0].find('time.post-date').exists()).toBe(false)
    expect(posts[1].get('.post-title a').text()).toBe('Dated-less Post')
    expect(posts[1].find('time.post-date').exists()).toBe(false)
  })

  it('renders every post when perPage exceeds the feed length', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => ATOM_XML,
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL, perPage: 10 })
    await flushPromises()

    expect(wrapper.findAll('article.blog-post')).toHaveLength(3)
  })
})
