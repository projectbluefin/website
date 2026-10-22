import type { IntroOverlayTextCue } from '../../src/data/wolves-intro-sequence'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from '../../src/data/wolves-directors-cut-artwork'
import { buildDirectorsCutPrologueSegment } from '../../src/data/wolves-directors-cut-intro'
import { ALIASES, isKnownVideo, knownVideoNames, resolveVideo, VIDEOS } from '../wolves-videos.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const cueAt = join(__dirname, '..', 'wolves-cue-at.mjs')

// Each run boots a Vite SSR server to load the authored modules.
const CLI_TIMEOUT = 60_000

interface RunResult {
  status: number | null
  stdout: string
  stderr: string
}

function run(...args: string[]): RunResult {
  const result = spawnSync(process.execPath, [cueAt, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: CLI_TIMEOUT,
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

// Mirrors the tool's own m:ss.ss rendering so expectations come from the show data.
function stamp(seconds: number): string {
  const minutes = Math.floor(Math.floor(seconds) / 60)
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, '0')}`
}

function windowLine(cue: IntroOverlayTextCue): string {
  return `${stamp(cue.start)} - ${stamp(cue.end)}`
}

const cues = buildDirectorsCutPrologueSegment().overlays as readonly IntroOverlayTextCue[]

function cueContaining(seconds: number): IntroOverlayTextCue {
  const cue = cues.find(candidate => seconds >= candidate.start && seconds < candidate.end)
  if (!cue) {
    throw new Error(`no prologue cue contains ${seconds}s`)
  }
  return cue
}

describe('wolves-videos registry', () => {
  it('resolves every alias, and no argument, to the canonical prologue key', () => {
    for (const alias of [1, '1', 'first', 'gardener', 'winnower', 'prologue', undefined]) {
      const { key, video } = resolveVideo(alias as string | undefined)
      expect(key).toBe('prologue')
      expect(video).toBe(VIDEOS.prologue)
    }
  })

  it('returns a null video for an unknown name while echoing the name back', () => {
    expect(resolveVideo('epilogue')).toEqual({ key: 'epilogue', video: null })
  })

  it('knows registry keys and aliases but not prototype properties or nothing', () => {
    expect(isKnownVideo('prologue')).toBe(true)
    expect(isKnownVideo('1')).toBe(true)
    expect(isKnownVideo('gardener')).toBe(true)
    expect(isKnownVideo('2')).toBe(false)
    expect(isKnownVideo('1:50')).toBe(false)
    expect(isKnownVideo('toString')).toBe(false)
    expect(isKnownVideo('constructor')).toBe(false)
    expect(isKnownVideo(undefined)).toBe(false)
    expect(isKnownVideo(null)).toBe(false)
  })

  it('lists every registry key, and every alias points at one of them', () => {
    expect(knownVideoNames()).toBe(Object.keys(VIDEOS).join(', '))
    for (const target of Object.values(ALIASES)) {
      expect(Object.hasOwn(VIDEOS, target)).toBe(true)
    }
  })

  it('numbers the running order from 1 without gaps or repeats', () => {
    const ordinals = Object.values(VIDEOS).map(video => video.ordinal).sort((a, b) => a - b)
    expect(ordinals).toEqual(ordinals.map((_, index) => index + 1))
  })

  it('loads the prologue from the same module the app plays', async () => {
    const requested: string[] = []
    const segment = await VIDEOS.prologue.load(async (specifier: string) => {
      requested.push(specifier)
      return import(/* @vite-ignore */ join(repoRoot, specifier))
    })

    expect(requested).toEqual(['/src/data/wolves-directors-cut-intro.ts'])
    expect(segment).toEqual(buildDirectorsCutPrologueSegment())
  })

  it('reports each concept image by file name with its authored source size', async () => {
    const geometry = await VIDEOS.prologue.loadGeometry(async (specifier: string) =>
      import(/* @vite-ignore */ join(repoRoot, specifier)))

    expect(geometry).toEqual(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => ({
      file: record.localPath.split('/').pop(),
      width: record.sourceWidth,
      height: record.sourceHeight,
    })))
    for (const entry of geometry) {
      expect(entry.file).not.toContain('/')
      expect(entry.width).toBeGreaterThan(0)
      expect(entry.height).toBeGreaterThan(0)
    }
  })
})

describe('wolves-cue-at CLI', () => {
  it('prints usage and fails when given no arguments', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('usage: node scripts/wolves-cue-at.mjs')
    expect(result.stdout).toContain(`videos: ${knownVideoNames()}`)
  })

  it('prints usage and succeeds for --help', () => {
    const result = run('--help')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('usage: node scripts/wolves-cue-at.mjs')
  })

  it('refuses an unknown video and names the known ones', () => {
    const result = run('epilogue', '1:00')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`unknown video "epilogue". known: ${knownVideoNames()}`)
    expect(result.stdout).not.toContain('video 1:')
  })

  it('refuses a video name with neither a timestamp nor --all', () => {
    const result = run('prologue')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('give a timestamp (1:50 or 110) or --all')
  })

  it('reads a lone ordinal as a video, not as the timestamp 0:01', () => {
    const result = run('1')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('give a timestamp')
    expect(result.stdout).not.toContain('at 0:01.00')
  })

  it.each([
    ['m:ss', ['1:50']],
    ['seconds', ['110']],
    ['m and s', ['1m50s']],
    ['ordinal before the timestamp', ['1', '1:50']],
    ['ordinal after the timestamp', ['110', '1']],
    ['alias', ['gardener', '1:50']],
  ])('answers the cue on screen at 110s given %s', (_label, args) => {
    const cue = cueContaining(110)
    const result = run(...args)

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('video 1: prologue')
    expect(result.stdout).toContain(`${cues.length} shots`)
    expect(result.stdout).toContain('at 1:50.00 (110s):')
    expect(result.stdout).toContain(`  ${windowLine(cue)}  [${cue.emphasis ?? 'normal'}]`)
    expect(result.stdout.match(/^ {2}\d+:\d{2}\.\d{2} - /gm)).toHaveLength(1)
  }, CLI_TIMEOUT)

  it('says whether the text is still up, from the cue\'s own hold time', () => {
    const held = cues.find(cue => cue.text && cue.textHoldSeconds != null
      && cue.start + cue.textHoldSeconds < cue.end - 0.1)
    if (!held) {
      throw new Error('expected a prologue cue whose text clears before the shot ends')
    }
    const holdEnd = held.start + held.textHoldSeconds!

    const before = run(String(held.start))
    expect(before.status, before.stderr).toBe(0)
    expect(before.stdout).toContain(`  ${windowLine(held)}`)
    expect(before.stdout).toContain(`text clears ${stamp(holdEnd)}`)
    expect(before.stdout).toContain('text on screen at the requested second: YES')

    const after = run(String((holdEnd + held.end) / 2))
    expect(after.status, after.stderr).toBe(0)
    expect(after.stdout).toContain(`  ${windowLine(held)}`)
    expect(after.stdout).toContain('text on screen at the requested second: no, already cleared')
  }, CLI_TIMEOUT * 2)

  it('reports a timestamp before the first shot as before it, not past the end', () => {
    expect(cues[0].start).toBeGreaterThan(0)
    const result = run('0:00')
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`nothing scheduled — the first shot starts at ${stamp(cues[0].start)}.`)
  }, CLI_TIMEOUT)

  it('reports a timestamp after the last shot as past the end', () => {
    const last = cues[cues.length - 1]
    const result = run(String(Math.ceil(last.end) + 60))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`nothing scheduled — the last shot ends at ${stamp(last.end)}.`)
  }, CLI_TIMEOUT)

  it('lists every shot in order with --all', () => {
    const result = run('prologue', '--all')
    expect(result.status, result.stderr).toBe(0)

    const windows = result.stdout.match(/^ {2}\d+:\d{2}\.\d{2} - \d+:\d{2}\.\d{2}/gm) ?? []
    expect(windows).toEqual(cues.map(cue => `  ${windowLine(cue)}`))
    expect(result.stdout).not.toContain('text on screen at the requested second')
    if (cues.some(cue => !cue.text)) {
      expect(result.stdout).toContain('| (wordless shot)')
    }
  }, CLI_TIMEOUT)
})
