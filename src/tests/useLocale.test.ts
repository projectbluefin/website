import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../composables/useLocale'
import { i18n } from '../locales/schema'

const DEFAULT_LOCALE = 'en-US'
const SUPPORTED_LOCALES = [
  'de-DE',
  'en-US',
  'eo',
  'fr-FR',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'pt-BR',
  'ru-RU',
  'sk-SK',
  'vi-VN',
  'zh-HK',
  'zh-TW',
]

describe('useLocale', () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE)
  })

  it('bundles the supported locales', () => {
    expect(Object.keys(i18n.global.messages).sort()).toEqual(SUPPORTED_LOCALES)
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
})
