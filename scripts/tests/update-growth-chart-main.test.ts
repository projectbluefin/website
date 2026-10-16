import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

// Drives the real CLI entry point (`node scripts/update-growth-chart.js`, as
// update-content.yml runs it) from a scratch copy, so its OUT path resolves
// inside the scratch tree and the committed SVG is never touched. `fetch` is
// replaced by a preload module, so no network is used.

const __dirname = dirname(fileURLToPath(import.meta.url))
const script = join(__dirname, '..', 'update-growth-chart.js')

const PREVIOUS_CHART = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#0c1016"/></svg>'

const FETCH_STUB = `
import { appendFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(process.env.STUB_URL_LOG, String(url) + '\\n')
  return new Response(process.env.STUB_BODY ?? '', {
    status: Number(process.env.STUB_STATUS ?? 200),
    statusText: process.env.STUB_STATUS_TEXT ?? '',
  })
}
`

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

interface Run {
  status: number | null
  stdout: string
  stderr: string
  urls: string[]
  chart: string
}

function runMain(response: { status?: number, statusText?: string, body?: string }): Run {
  const root = mkdtempSync(join(tmpdir(), 'growth-chart-'))
  roots.push(root)
  mkdirSync(join(root, 'scripts'))
  copyFileSync(script, join(root, 'scripts', 'update-growth-chart.js'))
  const chartPath = join(root, 'src', 'assets', 'svg', 'growth_bluefins.svg')
  mkdirSync(dirname(chartPath), { recursive: true })
  writeFileSync(chartPath, PREVIOUS_CHART)
  const stub = join(root, 'fetch-stub.mjs')
  writeFileSync(stub, FETCH_STUB)
  const urlLog = join(root, 'urls.log')
  writeFileSync(urlLog, '')

  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(stub).href, 'scripts/update-growth-chart.js'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        STUB_URL_LOG: urlLog,
        STUB_STATUS: String(response.status ?? 200),
        STUB_STATUS_TEXT: response.statusText ?? '',
        STUB_BODY: response.body ?? '',
      },
    },
  )

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    urls: readFileSync(urlLog, 'utf8').split('\n').filter(Boolean),
    chart: readFileSync(chartPath, 'utf8'),
  }
}

describe('update-growth-chart main()', () => {
  it('fetches the chart from an immutable countme commit, never a branch', () => {
    const run = runMain({ status: 404, statusText: 'Not Found' })

    expect(run.urls).toHaveLength(1)
    expect(run.urls[0]).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/ublue-os\/countme\/[0-9a-f]{40}\/growth_bluefins\.svg$/,
    )
  })

  it('exits non-zero and keeps the previous chart when the download fails', () => {
    const run = runMain({ status: 503, statusText: 'Service Unavailable' })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('[growth-chart] fatal: growth chart fetch failed: 503 Service Unavailable')
    expect(run.stdout).not.toContain('wrote')
    expect(run.chart).toBe(PREVIOUS_CHART)
  })

  it('refuses a downloaded chart whose bytes do not match the pinned checksum', () => {
    const tampered = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ffffff"/></svg>'
    const actual = createHash('sha256').update(tampered).digest('hex')

    const run = runMain({ body: tampered })

    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(
      new RegExp(`growth chart checksum mismatch: expected [0-9a-f]{64}, got ${actual}\\.`),
    )
    expect(run.stderr).toContain('pin the new commit SHA and checksum together')
    expect(run.stdout).not.toContain('wrote')
    expect(run.chart).toBe(PREVIOUS_CHART)
  })

  it('never writes scriptable content that fails the checksum, even if it is a valid SVG', () => {
    const run = runMain({ body: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>' })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('checksum mismatch')
    expect(run.chart).toBe(PREVIOUS_CHART)
    expect(run.chart).not.toContain('onload')
  })
})
