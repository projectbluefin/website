import { readdir, readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
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

const WOLVES_PATHS = [
  'src/components/wolves',
  'src/WolvesApp.vue',
  'src/wolves-main.ts',
  'src/style/wolves-cinematic.scss',
]

function isWolvesPath(path: string): boolean {
  const relativePath = relative(process.cwd(), path).replace(/\\/g, '/')
  return WOLVES_PATHS.some(prefix => relativePath.startsWith(prefix))
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (isWolvesPath(path)) {
      return []
    }
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return /\.(?:vue|scss|css)$/.test(entry.name) ? [path] : []
  }))

  return nestedFiles.flat()
}

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
    const teaser = await readFile(resolve(process.cwd(), 'wolves/index.html'), 'utf8')
    const experience = await readFile(resolve(process.cwd(), 'wolves/experience/index.html'), 'utf8')

    expect(teaser).toContain('<title>Bluefin: Seven Days to the Wolves — Official Teaser</title>')
    expect(teaser).toContain('property="og:url" content="https://projectbluefin.io/wolves/"')
    expect(teaser).toContain('src="%BASE_URL%src/wolves-teaser-main.ts"')

    expect(experience).toContain('<title>Bluefin: Seven Days to the Wolves</title>')
    expect(experience).toContain('property="og:url" content="https://projectbluefin.io/wolves/experience/"')
    expect(experience).toContain('src="%BASE_URL%src/wolves-main.ts"')
  })

  it('never truncates site copy with CSS ellipses', async () => {
    const files = await sourceFiles(resolve(process.cwd(), 'src'))
    const sources = await Promise.all(files.map(file => readFile(file, 'utf8')))

    expect(sources.join('\n')).not.toMatch(/text-overflow:\s*ellipsis/)
  })
})
