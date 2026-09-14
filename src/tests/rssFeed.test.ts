import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RssFeed from '../components/RssFeed.vue'
import { i18n } from '../locales/schema'
import { sanitizeFeedLink } from '../utils/feedParser'

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

  it('sanitizes non-http(s) entry link hrefs from the feed', async () => {
    const MALICIOUS_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Evil Post</title>
    <link href="javascript:alert(1)"/>
    <published>2024-02-01T10:00:00Z</published>
    <summary>xss attempt</summary>
  </entry>
</feed>`
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => MALICIOUS_XML,
    })))

    const wrapper = mountFeed({ feedUrl: FEED_URL })
    await flushPromises()

    expect(wrapper.get('.post-title a').attributes('href')).toBe('#')
  })
})

describe('sanitizeFeedLink', () => {
  it('keeps https and http links', () => {
    expect(sanitizeFeedLink('https://docs.projectbluefin.io/blog/x')).toBe('https://docs.projectbluefin.io/blog/x')
    expect(sanitizeFeedLink('http://example.com/y')).toBe('http://example.com/y')
  })

  it('keeps root-relative links but rejects protocol-relative ones', () => {
    expect(sanitizeFeedLink('/blog/post')).toBe('/blog/post')
    expect(sanitizeFeedLink('//evil.example/x')).toBe('#')
  })

  it('replaces javascript:, data: and malformed hrefs with #', () => {
    expect(sanitizeFeedLink('javascript:alert(1)')).toBe('#')
    expect(sanitizeFeedLink('  JavaScript:alert(1)')).toBe('#')
    expect(sanitizeFeedLink('data:text/html,<script>alert(1)</script>')).toBe('#')
    expect(sanitizeFeedLink('vbscript:msgbox(1)')).toBe('#')
    expect(sanitizeFeedLink('')).toBe('#')
    expect(sanitizeFeedLink('not a url')).toBe('#')
  })
})
