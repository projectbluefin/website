import { afterEach, describe, expect, it } from 'vitest'
import { resolveLocale, setLocale } from '../composables/useLocale'
import { i18n } from '../locales/schema'

const DEFAULT_LOCALE = 'en-US'
const SUPPORTED_LOCALES = [
  'ar',
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
    expect(Object.keys(i18n.global.messages).sort()).toEqual([...SUPPORTED_LOCALES].sort())
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

  it('resolves exact locale tags', () => {
    expect(resolveLocale('uk')).toBe('uk')
    expect(resolveLocale('pt-BR')).toBe('pt-BR')
  })

  it('resolves regional tags to a bundled base language', () => {
    expect(resolveLocale('uk-UA')).toBe('uk')
    expect(resolveLocale('de')).toBe('de-DE')
  })

  it('returns undefined for unknown or empty tags', () => {
    expect(resolveLocale('xx-XX')).toBeUndefined()
    expect(resolveLocale('')).toBeUndefined()
    expect(resolveLocale(null)).toBeUndefined()
  })
})
