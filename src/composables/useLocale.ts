import { i18n } from '../locales/schema'

/**
 * Set the active locale.
 * vue-i18n is configured in LEGACY mode, where i18n.global.locale
 * is a plain string — NOT a ref. Never write .locale.value.
 */
export function setLocale(locale: string): void {
  ;(i18n.global as any).locale = locale
}

/**
 * Resolve a requested locale tag (e.g. from ?lang= or navigator.language)
 * to a bundled locale. Falls back to a base-language match so tags like
 * 'uk-UA' resolve to 'uk' and 'de' resolves to 'de-DE'.
 *
 * The base-language fallback only applies when exactly one bundled locale
 * shares the base language. When several do (e.g. zh-HK and zh-TW), picking
 * one would depend on bundling order, so the tag is left unresolved and the
 * caller keeps the default locale.
 */
export function resolveLocale(requested: string | null | undefined): string | undefined {
  if (!requested) {
    return undefined
  }

  const available: string[] = i18n.global.availableLocales as unknown as string[]
  const exact = available.find(locale => locale.toLowerCase() === requested.toLowerCase())
  if (exact) {
    return exact
  }

  const base = requested.split('-')[0].toLowerCase()
  const baseMatches = available.filter(locale => locale.toLowerCase().split('-')[0] === base)
  return baseMatches.length === 1 ? baseMatches[0] : undefined
}
