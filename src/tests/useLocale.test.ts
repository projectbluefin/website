import { afterEach, describe, expect, it } from 'vitest'
import { resolveLocale, setLocale } from '../composables/useLocale'
import { i18n } from '../locales/schema'

const DEFAULT_LOCALE = 'en-US'
const SUPPORTED_LOCALES = [
  'ar',
  'cs',
  'de-DE',
  'en-US',
  'eo',
  'es',
  'fr-FR',
  'hi',
  'id',
  'it',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'pl',
  'pt-BR',
  'ru-RU',
  'sk-SK',
  'sv',
  'tr',
  'uk',
  'vi-VN',
  'zh-HK',
  'zh-Hans',
  'zh-TW',
]

describe('useLocale', () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE)
  })

  it('bundles the supported locales', () => {
    const expected = [...SUPPORTED_LOCALES].sort()
    expect(Object.keys(i18n.global.messages).sort()).toEqual(expected)
  })

  it('uses en-US as the default locale', () => {
    expect((i18n.global as any).locale).toBe(DEFAULT_LOCALE)
  })

  it('switches the active locale', () => {
    setLocale('ja-JP')
    expect((i18n.global as any).locale).toBe('ja-JP')

    setLocale('de-DE')
    expect((i18n.global as any).locale).toBe('de-DE')
  })

  describe('resolveLocale', () => {
    it('returns the requested tag when it is an exact available locale', () => {
      expect(resolveLocale('ja-JP')).toBe('ja-JP')
      expect(resolveLocale('de-DE')).toBe('de-DE')
      expect(resolveLocale('zh-HK')).toBe('zh-HK')
      expect(resolveLocale('zh-Hans')).toBe('zh-Hans')
      expect(resolveLocale('zh-TW')).toBe('zh-TW')
      expect(resolveLocale('eo')).toBe('eo')
    })

    it('aliases Simplified-Chinese region tags to the zh-Hans bundle', () => {
      // zh-CN, zh-SG, and zh-MY have no exact bundle; each must resolve to
      // the Simplified-Chinese bundle, not to en-US. The regression from
      // issues #915 and #909 was a Simplified-Chinese browser falling to
      // en-US because the exact-match check rejected the region tag before
      // any fallback.
      expect(resolveLocale('zh-CN')).toBe('zh-Hans')
      expect(resolveLocale('zh-SG')).toBe('zh-Hans')
      expect(resolveLocale('zh-MY')).toBe('zh-Hans')
    })

    it('aliases script-qualified Simplified-Chinese tags to the zh-Hans bundle', () => {
      // Apple platforms report the script subtag (zh-Hans-CN). Without an
      // alias the exact-match check rejects it and the user gets en-US (#907).
      expect(resolveLocale('zh-Hans-CN')).toBe('zh-Hans')
      expect(resolveLocale('zh-Hans-SG')).toBe('zh-Hans')
      expect(resolveLocale('zh-Hans-MY')).toBe('zh-Hans')
      // Traditional script tags are not aliased onto the Simplified bundle.
      expect(resolveLocale('zh-Hant-TW')).not.toBe('zh-Hans')
      expect(resolveLocale('zh-Hant-HK')).not.toBe('zh-Hans')
    })

    it('aliases the Ukrainian regional tag to the uk bundle', () => {
      // uk-UA has no bundle of its own and uk is the only Ukrainian bundle,
      // so the region tag resolves unambiguously to uk. This is issue #905:
      // a browser reporting uk-UA previously fell to the default locale.
      expect(resolveLocale('uk-UA')).toBe('uk')
      // The exact bundle is still matched verbatim.
      expect(resolveLocale('uk')).toBe('uk')
    })

    it('aliases cs-CZ to the cs bundle', () => {
      // cs-CZ has no bundle of its own and `cs` is the only Czech bundle, so
      // routing the region tag to the base bundle is unambiguous. This
      // closes issue #928: a Czech browser reporting the regional tag
      // previously fell to en-US even though `?lang=cs` works. Single-bundle
      // languages without a region (e.g. `eo`, where browsers send the bare
      // tag because Esperanto has no associated region subtag) exact-match
      // through the first resolveLocale branch and need no alias entry.
      expect(resolveLocale('cs-CZ')).toBe('cs')
      // The exact bundle is still matched verbatim.
      expect(resolveLocale('cs')).toBe('cs')
    })

    it.each([
      ['ar-EG', 'ar'],
      ['es-ES', 'es'],
      ['hi-IN', 'hi'],
      ['id-ID', 'id'],
      ['it-IT', 'it'],
      ['pl-PL', 'pl'],
      ['sv-SE', 'sv'],
      ['tr-TR', 'tr'],
    ])('aliases %s to the single %s bundle', (tag, bundle) => {
      const siblings = i18n.global.availableLocales.filter(locale => locale.split('-')[0] === bundle)
      expect(siblings).toEqual([bundle])
      expect(resolveLocale(tag)).toBe(bundle)
      expect(resolveLocale(bundle)).toBe(bundle)
    })

    it('does not alias Traditional-Chinese region tags', () => {
      // Each Traditional region has its own bundle, so they must keep their
      // own tag. The exact-match path handles the bundled ones; the alias
      // path must NOT collapse them onto zh-Hans or zh-TW.
      expect(resolveLocale('zh-HK')).toBe('zh-HK')
      expect(resolveLocale('zh-TW')).toBe('zh-TW')
      // zh-MO has no bundle and no alias entry — it falls to the default
      // rather than silently picking one of the Traditional variants.
      expect(resolveLocale('zh-MO')).toBe(DEFAULT_LOCALE)
    })

    it('does not alias bare zh to any of the Chinese bundles', () => {
      // Three Chinese bundles (zh-HK, zh-Hans, zh-TW) share the base "zh".
      // The skill rules forbid generic fallback that picks arbitrarily between
      // siblings; this is the test that locks the policy in place.
      expect(resolveLocale('zh')).toBe(DEFAULT_LOCALE)
    })

    it('does not introduce subtag fallback for other languages', () => {
      // The policy from content-maintenance/SKILL.md: a bare-language file
      // is not picked for a browser reporting a region tag (and vice versa)
      // when the alias map has no entry for that tag. resolveLocale honours
      // that — only the explicit LOCALE_ALIASES entries get a second chance.
      // `cs-CZ` is covered by the alias added for issue #928; `sk-SK` has
      // its own bundle and is matched verbatim; bare `sk`, `de`, and `fr`
      // have no alias entry and must fall to the default.
      expect(resolveLocale('sk')).toBe(DEFAULT_LOCALE)
      expect(resolveLocale('de')).toBe(DEFAULT_LOCALE)
      expect(resolveLocale('fr')).toBe(DEFAULT_LOCALE)
    })

    it('falls back to the default locale when the tag has no match', () => {
      expect(resolveLocale('')).toBe(DEFAULT_LOCALE)
      expect(resolveLocale('xx')).toBe(DEFAULT_LOCALE)
      expect(resolveLocale('klingon')).toBe(DEFAULT_LOCALE)
    })
  })
})
