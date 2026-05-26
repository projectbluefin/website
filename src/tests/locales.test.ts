import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const localesDir = fileURLToPath(new URL('../locales', import.meta.url))
const localeFiles = readdirSync(localesDir).filter(f => f.endsWith('.json'))
const enUS = JSON.parse(readFileSync(resolve(localesDir, 'en-US.json'), 'utf8'))

function flatKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return flatKeys(value, path)
    }
    return [path]
  })
}

const enKeys = flatKeys(enUS)

describe('locale files — structural integrity', () => {
  it('en-US.json exists and has keys', () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it('all locale files are valid JSON', () => {
    for (const file of localeFiles) {
      const content = readFileSync(resolve(localesDir, file), 'utf8')
      expect(() => JSON.parse(content), `${file} is invalid JSON`).not.toThrow()
    }
  })

  for (const file of localeFiles) {
    if (file === 'en-US.json') continue
    const locale = JSON.parse(readFileSync(resolve(localesDir, file), 'utf8'))
    const localeKeys = flatKeys(locale)

    it(`${file} has no extra top-level sections absent from en-US`, () => {
      const enTopLevel = Object.keys(enUS)
      const localeTopLevel = Object.keys(locale)
      const extras = localeTopLevel.filter(k => !enTopLevel.includes(k))
      expect(extras, `Extra sections in ${file}: ${extras.join(', ')}`).toHaveLength(0)
    })

    it(`${file} has no extra keys absent from en-US`, () => {
      const extras = localeKeys.filter(k => !enKeys.includes(k))
      expect(extras, `Extra keys in ${file}: ${extras.join(', ')}`).toHaveLength(0)
    })
  }
})

describe('locale files — value sanity', () => {
  it('en-US values are all non-empty strings', () => {
    for (const key of enKeys) {
      const parts = key.split('.')
      let val: any = enUS
      for (const p of parts) val = val[p]
      expect(val, `en-US key "${key}" is empty`).toBeTruthy()
    }
  })
})