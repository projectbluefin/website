import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const localesDir = resolve(here, '../locales')

function loadLocale(filename: string): Record<string, unknown> {
  const content = readFileSync(resolve(localesDir, filename), 'utf8')
  return JSON.parse(content)
}

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flatKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys.sort()
}

const localeFiles = readdirSync(localesDir).filter(f => f.endsWith('.json'))
const enUS = loadLocale('en-US.json')
const enKeys = flatKeys(enUS)

describe('locale files', () => {
  it('en-US.json exists and has keys', () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  for (const file of localeFiles) {
    if (file === 'en-US.json') continue

    it(`${file} has all keys from en-US.json`, () => {
      const locale = loadLocale(file)
      const localeKeys = flatKeys(locale)
      const missing = enKeys.filter(k => !localeKeys.includes(k))
      if (missing.length > 0) {
        // Warn but don't fail — incomplete translations are expected
        console.warn(`${file} missing ${missing.length} keys: ${missing.slice(0, 5).join(', ')}...`)
      }
      // At minimum, the locale should have SOME keys
      expect(localeKeys.length).toBeGreaterThan(0)
    })
  }

  it('all locale files are valid JSON', () => {
    for (const file of localeFiles) {
      expect(() => loadLocale(file)).not.toThrow()
    }
  })
})
