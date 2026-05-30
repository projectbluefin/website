import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import type { XmlParser } from '../utils/feedParser'
import { formatFeedDate, parseAtomFeed } from '../utils/feedParser'

describe('feedParser', () => {
  it('parses Atom entries with summaries and published dates', () => {
    const posts = parseAtomFeed(`
      <feed>
        <entry>
          <title>First post</title>
          <link href="https://docs.projectbluefin.io/blog/first" />
          <summary>Hello world</summary>
          <published>2024-01-15T10:00:00Z</published>
        </entry>
        <entry>
          <title>Second post</title>
          <link href="https://docs.projectbluefin.io/blog/second" />
          <content>Fallback content</content>
          <updated>2024-02-01T08:30:00Z</updated>
        </entry>
      </feed>
    `, new DOMParser() as unknown as XmlParser)

    expect(posts).toEqual([
      {
        title: 'First post',
        link: 'https://docs.projectbluefin.io/blog/first',
        description: 'Hello world',
        pubDate: '2024-01-15T10:00:00Z',
        formattedDate: 'January 15, 2024',
      },
      {
        title: 'Second post',
        link: 'https://docs.projectbluefin.io/blog/second',
        description: 'Fallback content',
        pubDate: '2024-02-01T08:30:00Z',
        formattedDate: 'February 1, 2024',
      },
    ])
  })

  it('falls back when optional Atom fields are missing', () => {
    const posts = parseAtomFeed(`
      <feed>
        <entry>
          <link />
        </entry>
      </feed>
    `, new DOMParser() as unknown as XmlParser)

    expect(posts).toEqual([
      {
        title: 'Untitled',
        link: '#',
        description: '',
        pubDate: '',
        formattedDate: '',
      },
    ])
  })

  it('returns an empty list when the feed has no entries', () => {
    expect(parseAtomFeed('<feed></feed>', new DOMParser() as unknown as XmlParser)).toEqual([])
  })

  it('throws when the parser reports malformed XML', () => {
    const parserWithError: XmlParser = {
      parseFromString(_xml: string, _mimeType: string) {
        return new DOMParser().parseFromString('<parsererror />', 'text/xml') as unknown as ReturnType<XmlParser['parseFromString']>
      },
    }

    expect(() => parseAtomFeed('<feed>', parserWithError)).toThrow('Failed to parse XML feed')
  })

  it('returns the original string for invalid dates', () => {
    expect(formatFeedDate('not-a-date')).toBe('not-a-date')
  })
})
