import { describe, expect, it } from 'vitest'
import * as content from '../content'

describe('content.ts — exported constants', () => {
  it('LangLandingBluefinImageURLs contains valid paths', () => {
    expect(content.LangLandingBluefinImageURLs.length).toBeGreaterThan(0)
    for (const url of content.LangLandingBluefinImageURLs) {
      expect(url).toMatch(/^\.\/characters\/header\/.*\.webp$/)
    }
  })

  it('LangUsersBluefinImageURL is a valid path', () => {
    expect(content.LangUsersBluefinImageURL).toMatch(/\.webp$/)
  })

  it('LangMissionBluefinImageURL is a valid path', () => {
    expect(content.LangMissionBluefinImageURL).toMatch(/\.webp$/)
  })

  it('social links have valid URLs', () => {
    const socialLinks = (content as any).LangSocialLinks ?? []
    for (const link of socialLinks) {
      if (link?.href) {
        expect(link.href).toMatch(/^https?:\/\//)
      }
    }
  })

  it('markdown content does not have broken link syntax', () => {
    const markdownFields = [
      content.LangUsersAppendix,
      content.LangDevsAppendix,
      content.LangMissionText,
    ]
    for (const field of markdownFields) {
      // Check for [text](url) where url is not empty
      const links = field.match(/\[([^\]]+)\]\(([^)]*)\)/g) ?? []
      for (const link of links) {
        const url = link.match(/\]\(([^)]*)\)/)?.[1]
        expect(url, `Broken link in: ${link}`).toBeTruthy()
        expect(url).toMatch(/^https?:\/\/|^#/)
      }
    }
  })
})
