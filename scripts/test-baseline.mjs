#!/usr/bin/env node
/**
 * Test baseline gate.
 *
 * This repository's vitest suite has been red for a long time. A bare
 * `npm run test:run` therefore cannot tell an agent whether *their* change
 * broke something: it prints a large failure count either way, and real
 * regressions hide inside the noise.
 *
 * This script compares the current set of failing tests against the recorded
 * baseline in `tests/known-failures.txt` and fails only on NEW failures. It
 * also reports tests that were expected to fail but now pass, so the baseline
 * shrinks as the suite is repaired.
 *
 * Usage:
 *   node scripts/test-baseline.mjs            # gate: non-zero exit on new failures
 *   node scripts/test-baseline.mjs --update   # re-record the baseline
 *
 * Re-record the baseline ONLY when you have deliberately fixed or accepted a
 * change in the failure set, and say so in the commit message.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASELINE = new URL('../tests/known-failures.txt', import.meta.url)
const shouldUpdate = process.argv.includes('--update')

const reportPath = join(mkdtempSync(join(tmpdir(), 'wolves-baseline-')), 'vitest.json')

try {
  execFileSync(
    'npx',
    [
      'vitest',
      'run',
      '--reporter=json',
      `--outputFile=${reportPath}`
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit']
    },
  )
}
catch {
  // vitest exits non-zero whenever tests fail, which is the normal case here.
}

if (!existsSync(reportPath)) {
  console.error('test-baseline: vitest produced no JSON report')
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const cwd = `${process.cwd()}/`

const current = new Set()
for (const file of report.testResults ?? []) {
  for (const assertion of file.assertionResults ?? []) {
    if (assertion.status === 'failed') {
      current.add(`${file.name.replace(cwd, '')} :: ${assertion.fullName}`)
    }
  }
}

const sorted = [...current].sort()

if (shouldUpdate) {
  writeFileSync(BASELINE, `${sorted.join('\n')}\n`)
  console.info(`test-baseline: recorded ${sorted.length} known failures`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error('test-baseline: no baseline recorded; run with --update')
  process.exit(2)
}

const known = new Set(
  readFileSync(BASELINE, 'utf8').split('\n').map(line => line.trim()).filter(Boolean),
)

const added = sorted.filter(name => !known.has(name))
const fixed = [...known].filter(name => !current.has(name)).sort()

if (fixed.length > 0) {
  console.info(`\ntest-baseline: ${fixed.length} baseline failure(s) now PASS — shrink the baseline:`)
  for (const name of fixed) {
    console.info(`  + ${name}`)
  }
}

if (added.length > 0) {
  console.error(`\ntest-baseline: ${added.length} NEW failure(s) introduced:`)
  for (const name of added) {
    console.error(`  - ${name}`)
  }
  console.error('\nFix these, or justify and re-record with --update.')
  process.exit(1)
}

console.info(`\ntest-baseline: no new failures (${current.size} known, baseline ${known.size}).`)
