import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// renovate.json's constraints.npm sets the npm version Renovate writes
// package-lock.json with. It must match the npm CI runs, which is the one
// bundled with Node, so a Node major can move it. Renovate doesn't offer
// updates to the pin, so this fails the Node major PR until someone raises it.
const [running = '', runningMajor = ''] = (process.env.npm_config_user_agent ?? '').match(/\bnpm\/(\d+)\.\d+\.\d+/) ?? []

describe('renovate npm pin', () => {
  it.skipIf(!running)('matches the npm running the tests', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'renovate.json'), 'utf8')) as { constraints?: { npm?: string } }
    const pin = config.constraints?.npm ?? ''
    const version = running.slice(4)
    expect(
      pin.match(/\d+/)?.[0],
      `renovate.json has constraints.npm "${pin}", but the tests run npm ${version}. Set constraints.npm to "^${version}" in this pull request.`,
    ).toBe(runningMajor)
  })
})
