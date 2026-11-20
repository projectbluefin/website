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

// Captured instead of swallowed: a non-zero exit is only acceptable when
// completed failed assertions account for it. A runner that failed to finish
// (suite-load error, setup error, import error) also exits non-zero, and that
// is exactly the case the gate used to report as passing.
let childExit = 0
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
catch (error) {
  childExit = Number.isInteger(error.status)
    ? error.status
    : 1
}

if (!existsSync(reportPath)) {
  console.error('test-baseline: vitest produced no JSON report')
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))

// Validate the report before interpreting it or writing an updated baseline.
// An incomplete report (no `testResults`) means nothing ran to completion, so
// it must never be read as "no new failures" nor recorded as a baseline.
if (!report || typeof report !== 'object' || !Array.isArray(report.testResults)) {
  console.error('test-baseline: vitest report is incomplete or malformed')
  process.exit(2)
}

const cwd = `${process.cwd()}/`

const current = new Set()
for (const file of report.testResults) {
  for (const assertion of file.assertionResults ?? []) {
    // A suite that failed to load reports a failed assertion with no name;
    // it is not a completed assertion and must not enter the failure set.
    if (assertion.status === 'failed' && assertion.fullName) {
      current.add(`${file.name.replace(cwd, '')} :: ${assertion.fullName}`)
    }
  }
}

const sorted = [...current].sort()

// A non-zero child exit with no completed failed assertions is a run that did
// not finish: a suite failed to load, setup threw, or the runner errored. The
// normal red suite always has completed failed assertions to explain its exit
// code, so the absence of any is itself a failure. Reject it before the
// comparison and before any `--update` could record an empty baseline.
if (childExit !== 0 && current.size === 0) {
  console.error(
    'test-baseline: vitest failed to run to completion and reported no completed failures',
  )
  process.exit(2)
}

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
