import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const testBaseline = join(__dirname, '..', 'test-baseline.mjs')

const temporaryRoots: string[] = []

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

/**
 * `npx vitest run --reporter=json --outputFile=<path>` stand-in.
 *
 * The real gate shells out to vitest and reads the JSON report back from the
 * temporary path it chose, so the stub parses `--outputFile=` off the argv and
 * writes whatever `STUB_REPORT` holds. An empty `STUB_REPORT` writes nothing,
 * which is how "vitest produced no report" is reproduced. The stub exits
 * non-zero by default because that is the normal case for a red suite, and the
 * gate is supposed to swallow it.
 */
const NPX_STUB = `#!/usr/bin/env bash
out=""
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) out="\${arg#--outputFile=}" ;;
  esac
done
if [[ -n "$STUB_REPORT" && -n "$out" ]]; then
  printf '%s' "$STUB_REPORT" > "$out"
fi
exit "\${STUB_VITEST_RC:-1}"
`

/**
 * test-baseline.mjs resolves `tests/known-failures.txt` from its own location
 * and exports nothing, so it is exercised exactly as `npm run test:gate` runs
 * it: copied into a throwaway tree and executed as a subprocess.
 */
function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'test-baseline-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, 'tests'), { recursive: true })
  mkdirSync(join(root, 'bin'), { recursive: true })
  copyFileSync(testBaseline, join(root, 'scripts', 'test-baseline.mjs'))

  const npx = join(root, 'bin', 'npx')
  writeFileSync(npx, NPX_STUB, { mode: 0o755 })

  return root
}

function baselinePath(root: string) {
  return join(root, 'tests', 'known-failures.txt')
}

function writeBaseline(root: string, contents: string) {
  writeFileSync(baselinePath(root), contents)
}

/** Build a vitest JSON report; file names are absolute, as vitest emits them. */
function report(root: string, files: Array<{ name: string, assertions: Array<[string, string]> }>) {
  return JSON.stringify({
    testResults: files.map(file => ({
      name: join(root, file.name),
      assertionResults: file.assertions.map(([status, fullName]) => ({ status, fullName })),
    })),
  })
}

function run(root: string, options: { report?: string, args?: string[], vitestRc?: number } = {}): RunResult {
  const result = execFileSync(
    process.execPath,
    [
      join(root, 'scripts', 'test-baseline.mjs'),
      ...(options.args ?? [])
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        STUB_REPORT: options.report ?? '',
        STUB_VITEST_RC: String(options.vitestRc ?? 1),
      },
      // The gate exits non-zero on new failures; capture instead of throwing.
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  // execFileSync throws on non-zero, so this path is only reached on success.
  return { status: 0, stdout: result, stderr: '' }
}

/** execFileSync throws for a non-zero exit; normalise both outcomes. */
function runGate(root: string, options: Parameters<typeof run>[1] = {}): RunResult {
  try {
    return run(root, options)
  }
  catch (error) {
    const failure = error as { status: number, stdout: string, stderr: string }
    return {
      status: failure.status,
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? ''),
    }
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('scripts/test-baseline.mjs (npm run test:gate)', () => {
  it('exits 2 when vitest produces no JSON report', () => {
    const root = makeRepo()
    writeBaseline(root, '')

    const { status, stderr } = runGate(root)

    expect(status).toBe(2)
    expect(stderr).toContain('test-baseline: vitest produced no JSON report')
  })

  it('exits 2 when no baseline has been recorded yet', () => {
    const root = makeRepo()

    const { status, stderr } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        }
      ]),
    })

    expect(status).toBe(2)
    expect(stderr).toContain('test-baseline: no baseline recorded; run with --update')
  })

  it('records the failing set, sorted and cwd-relative, under --update', () => {
    const root = makeRepo()

    const { status, stdout } = runGate(root, {
      args: ['--update'],
      report: report(root, [
        {
          name: 'src/tests/z.test.ts',
          assertions: [
            ['failed', 'z fails']
          ]
        },
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails'],
            ['passed', 'a passes']
          ]
        },
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: recorded 2 known failures')
    expect(readFileSync(baselinePath(root), 'utf8')).toBe(
      'src/tests/a.test.ts :: a fails\nsrc/tests/z.test.ts :: z fails\n',
    )
  })

  it('records an empty baseline when nothing failed', () => {
    const root = makeRepo()

    const { status, stdout } = runGate(root, {
      args: ['--update'],
      vitestRc: 0,
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['passed', 'a passes']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: recorded 0 known failures')
    expect(readFileSync(baselinePath(root), 'utf8')).toBe('\n')
  })

  it('--update does not read the baseline, so it works with none present', () => {
    const root = makeRepo()
    rmSync(baselinePath(root), { force: true })

    const { status } = runGate(root, {
      args: ['--update'],
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(existsSync(baselinePath(root))).toBe(true)
  })

  it('passes when every current failure is already in the baseline', () => {
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\n')

    const { status, stdout } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: no new failures (1 known, baseline 1).')
  })

  it('fails on a new failure and names it', () => {
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\n')

    const { status, stderr } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        },
        {
          name: 'src/tests/b.test.ts',
          assertions: [
            ['failed', 'b fails']
          ]
        },
      ]),
    })

    expect(status).toBe(1)
    expect(stderr).toContain('test-baseline: 1 NEW failure(s) introduced:')
    expect(stderr).toContain('- src/tests/b.test.ts :: b fails')
    expect(stderr).not.toContain('- src/tests/a.test.ts :: a fails')
    expect(stderr).toContain('Fix these, or justify and re-record with --update.')
  })

  it('reports baseline entries that now pass without failing the gate', () => {
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\nsrc/tests/b.test.ts :: b fails\n')

    const { status, stdout } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: 1 baseline failure(s) now PASS — shrink the baseline:')
    expect(stdout).toContain('+ src/tests/b.test.ts :: b fails')
  })

  it('reports fixed and new failures in the same run, exiting on the new ones', () => {
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\n')

    const { status, stdout, stderr } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/b.test.ts',
          assertions: [
            ['failed', 'b fails']
          ]
        }
      ]),
    })

    expect(status).toBe(1)
    expect(stdout).toContain('+ src/tests/a.test.ts :: a fails')
    expect(stderr).toContain('- src/tests/b.test.ts :: b fails')
  })

  it('counts only failed assertions, ignoring passed and skipped ones', () => {
    const root = makeRepo()
    writeBaseline(root, '')

    const { status, stdout } = runGate(root, {
      vitestRc: 0,
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['passed', 'a passes'],
            ['skipped', 'a is skipped'],
            ['pending', 'a is pending']
          ],
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: no new failures (0 known, baseline 0).')
  })

  it('rejects an incomplete report with no testResults, even on a clean exit', () => {
    // An empty report means nothing ran to completion. It must fail the gate
    // (exit 2) regardless of the child exit code, and never read as "no new
    // failures".
    const root = makeRepo()
    writeBaseline(root, '')

    const { status, stderr } = runGate(root, { vitestRc: 0, report: '{}' })
    expect(status).toBe(2)
    expect(stderr).toContain('test-baseline: vitest report is incomplete or malformed')

    // The same report with a non-zero child exit is rejected the same way.
    expect(runGate(root, { vitestRc: 1, report: '{}' }).status).toBe(2)
  })

  it('tolerates a file with no assertionResults on a clean exit', () => {
    // A completed run that simply reports a file with no assertions still has
    // no failures to report; only an unexplained non-zero exit is a problem.
    const root = makeRepo()
    writeBaseline(root, '')

    expect(
      runGate(root, {
        vitestRc: 0,
        report: JSON.stringify({
          testResults: [
            {
              name: join(root, 'src/tests/a.test.ts')
            }
          ],
        }),
      }).status,
    ).toBe(0)
  })

  it('rejects a failed suite with no completed assertions', () => {
    // Import / suite-load failure: vitest exits non-zero, the suite contributes
    // no completed failed assertions, and success is false.
    const root = makeRepo()
    writeBaseline(root, '')

    const report = JSON.stringify({
      success: false,
      testResults: [
        {
          name: join(root, 'src/tests/broken.test.ts'),
          assertionResults: []
        }
      ],
    })

    const { status, stderr } = runGate(root, { vitestRc: 1, report })
    expect(status).toBe(2)
    expect(stderr).toContain('test-baseline: vitest failed to run to completion')
  })

  it('rejects a runner error even when one assertion passed', () => {
    // A passing assertion plus a runner error still means the run did not
    // complete; the single pass does not explain the non-zero exit.
    const root = makeRepo()
    writeBaseline(root, '')

    const report = JSON.stringify({
      success: false,
      testResults: [
        {
          name: join(root, 'src/tests/a.test.ts'),
          assertionResults: [
            { status: 'passed', fullName: 'a passes' }
          ],
        },
      ],
    })

    expect(runGate(root, { vitestRc: 1, report }).status).toBe(2)
  })

  it('rejects a suite-load failure reported with a nameless failed assertion', () => {
    // Real vitest emits a failed entry with an empty fullName for a suite that
    // failed to import. That is not a completed assertion and must not be
    // counted, so the non-zero exit stays unexplained and the gate rejects it.
    const root = makeRepo()
    writeBaseline(root, '')

    const report = JSON.stringify({
      success: false,
      testResults: [
        {
          name: join(root, 'src/tests/broken.test.ts'),
          assertionResults: [
            { status: 'failed', fullName: '' }
          ],
        },
      ],
    })

    expect(runGate(root, { vitestRc: 1, report }).status).toBe(2)
  })

  it('rejects a suite-load failure even when a known failure exists elsewhere', () => {
    // A non-empty baseline plus an unrelated known failure must not mask a
    // file that failed to import.
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\n')

    const report = JSON.stringify({
      success: false,
      testResults: [
        {
          name: join(root, 'src/tests/a.test.ts'),
          status: 'failed',
          assertionResults: [{ status: 'failed', fullName: 'a fails' }],
        },
        {
          name: join(root, 'src/tests/broken.test.ts'),
          status: 'failed',
          assertionResults: [],
        },
      ],
    })

    const { status, stderr } = runGate(root, { vitestRc: 1, report })
    expect(status).toBe(2)
    expect(stderr).toContain('src/tests/broken.test.ts')
    expect(runGate(root, { vitestRc: 1, report, args: ['--update'] }).status).toBe(2)
    expect(readFileSync(baselinePath(root), 'utf8')).toBe('src/tests/a.test.ts :: a fails\n')
  })

  it('refuses to overwrite the baseline under --update on a runner error', () => {
    // The update mode must not record an empty baseline from an incomplete run.
    const root = makeRepo()
    writeBaseline(root, 'src/tests/a.test.ts :: a fails\n')

    const report = JSON.stringify({
      success: false,
      testResults: [
        {
          name: join(root, 'src/tests/broken.test.ts'),
          assertionResults: []
        }
      ],
    })

    const { status } = runGate(root, {
      args: ['--update'],
      vitestRc: 1,
      report
    })
    expect(status).toBe(2)
    // The recorded baseline is left untouched.
    expect(readFileSync(baselinePath(root), 'utf8')).toBe('src/tests/a.test.ts :: a fails\n')
  })

  it('still passes a healthy run with a passing assertion', () => {
    // Passing control: a clean, complete run is unaffected by the new checks.
    const root = makeRepo()
    writeBaseline(root, '')

    const { status, stdout } = runGate(root, {
      vitestRc: 0,
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['passed', 'a passes']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('no new failures')
  })

  it('ignores blank and whitespace-padded baseline lines', () => {
    const root = makeRepo()
    writeBaseline(root, '\n   src/tests/a.test.ts :: a fails   \n\n')

    const { status, stdout } = runGate(root, {
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('test-baseline: no new failures (1 known, baseline 1).')
  })

  it('swallows a zero vitest exit just as it swallows a non-zero one', () => {
    const root = makeRepo()
    writeBaseline(root, '')

    const { status, stdout } = runGate(root, {
      vitestRc: 0,
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['passed', 'a passes']
          ]
        }
      ]),
    })

    expect(status).toBe(0)
    expect(stdout).toContain('no new failures')
  })

  it('deduplicates identical failures reported by more than one file entry', () => {
    const root = makeRepo()

    runGate(root, {
      args: ['--update'],
      report: report(root, [
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        },
        {
          name: 'src/tests/a.test.ts',
          assertions: [
            ['failed', 'a fails']
          ]
        },
      ]),
    })

    expect(readFileSync(baselinePath(root), 'utf8')).toBe('src/tests/a.test.ts :: a fails\n')
  })
})
