import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as content from '../content'

const TEXT_EXPORTS = [
  'LangLandingTag',
  'LangLandingTitle',
  'LangLandingText',
  'LangUsersTag',
  'LangUsersTitle',
  'LangUsersText',
  'LangUsersAppendix',
  'LangDevsTag',
  'LangDevsTitle',
  'LangDevsText',
  'LangDevsAppendix',
  'LangMissionTag',
  'LangMissionTitle',
  'LangMissionText',
  'LangAppendixText',
  'LangAppendixYTVideo',
  'LangFooterProjectTitle',
  'LangFooterProject',
  'LangFooterReferences',
] as const

const IMAGE_EXPORTS = [
  'LangUsersBluefinImageURL',
  'LangDevsTowerImageURL',
  'LangMissionBluefinImageURL',
] as const

describe('content exports', () => {
  it('provides the required text content exports', () => {
    for (const key of TEXT_EXPORTS) {
      expect(content[key]).toEqual(expect.any(String))
      expect(content[key].trim().length).toBeGreaterThan(0)
    }
  })

  it('provides image paths as strings', () => {
    expect(content.LangLandingBluefinImageURLs.length).toBeGreaterThan(0)
    for (const path of content.LangLandingBluefinImageURLs) {
      expect(path).toEqual(expect.any(String))
      expect(path.startsWith('./characters/header/')).toBe(true)
    }

    for (const key of IMAGE_EXPORTS) {
      expect(content[key]).toEqual(expect.any(String))
      expect(content[key].startsWith('./characters/') || content[key].startsWith('/brands/')).toBe(true)
    }
  })

  it('exports list items and link metadata as strings', () => {
    expect(content.LangUsersListItems).toHaveLength(3)
    expect(content.LangUsersListItems).toEqual(expect.arrayContaining([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]))

    for (const item of content.LangSocialLinks) {
      expect(item.text).toEqual(expect.any(String))
      expect(item.link).toEqual(expect.any(String))
      expect(item.link.startsWith('https://')).toBe(true)
    }

    for (const item of [...content.LangPoweredBy, ...content.LangAlumniCompanies, ...content.LangSponsors]) {
      expect(item.altText).toEqual(expect.any(String))
      expect(item.imageUrl).toEqual(expect.any(String))
      expect(item.imageUrl.startsWith('/brands/')).toBe(true)
      if (item.projectUrl) {
        expect(item.projectUrl).toEqual(expect.any(String))
        expect(item.projectUrl.startsWith('https://')).toBe(true)
      }
    }
  })

  it('publishes the Wolves campaign entrypoint', async () => {
    const html = await readFile(resolve(process.cwd(), 'wolves/index.html'), 'utf8')

    expect(html).toContain('<title>Bluefin: Seven Days to the Wolves</title>')
    expect(html).toContain('property="og:url" content="https://projectbluefin.io/wolves/"')
    expect(html).toContain('src="%BASE_URL%src/wolves-main.ts"')
  })
})
