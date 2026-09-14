export interface BlogPost {
  title: string
  link: string
  description: string
  pubDate: string
  formattedDate: string
}

interface XmlNodeLike {
  textContent?: string | null
  getAttribute?: (name: string) => string | null
  getElementsByTagName: (tagName: string) => ArrayLike<XmlNodeLike>
}

export interface XmlParser {
  parseFromString: (xml: string, mimeType: DOMParserSupportedType) => Document
}

function getFirstElement(parent: { getElementsByTagName: (tagName: string) => ArrayLike<XmlNodeLike> }, tagName: string) {
  return parent.getElementsByTagName(tagName)[0] ?? null
}

function getTextContent(parent: { getElementsByTagName: (tagName: string) => ArrayLike<XmlNodeLike> }, tagName: string) {
  return getFirstElement(parent, tagName)?.textContent?.trim() ?? ''
}

function getAttribute(parent: { getElementsByTagName: (tagName: string) => ArrayLike<XmlNodeLike> }, tagName: string, name: string) {
  return getFirstElement(parent, tagName)?.getAttribute?.(name) ?? ''
}

/**
 * Feed entry links are cross-origin, externally authored content bound to
 * `<a :href>`, and Vue does not sanitize href bindings: a `javascript:` or
 * `data:` href executes in this origin on click (stored XSS). Only allow
 * http(s) and root-relative links; everything else falls back to `#`.
 */
export function sanitizeFeedLink(href: string): string {
  const trimmed = href.trim()
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed : '#'
  }
  catch {
    return '#'
  }
}

export function formatFeedDate(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function parseAtomFeed(xmlText: string, parser: XmlParser = new DOMParser()) {
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const hasParserError = xmlDoc.documentElement?.nodeName === 'parsererror'
    || xmlDoc.getElementsByTagName('parsererror').length > 0

  if (hasParserError) {
    throw new Error('Failed to parse XML feed')
  }

  return Array.from(xmlDoc.getElementsByTagName('entry')).map((entry): BlogPost => {
    const published = getTextContent(entry, 'published') || getTextContent(entry, 'updated')

    return {
      title: getTextContent(entry, 'title') || 'Untitled',
      link: sanitizeFeedLink(getAttribute(entry, 'link', 'href')),
      description: getTextContent(entry, 'summary') || getTextContent(entry, 'content'),
      pubDate: published,
      formattedDate: formatFeedDate(published),
    }
  })
}
