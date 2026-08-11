#!/usr/bin/env node
/**
 * Answer "what is on screen at m:ss" for a Wolves video, from the real show data.
 *
 * Every previous audit of a timestamp was done by hand-simulating the mark grid, or by
 * screenshotting nearby seconds and hoping. Both fail silently: one session probed 263s,
 * 266s and 320s and stepped straight over the 281s cue the owner was asking about.
 *
 * This loads the authored modules through Vite (so the aliases and TypeScript resolve
 * exactly as the app sees them) and reports the cue whose window contains the timestamp.
 * If it disagrees with the show, the show is what changed — fix the caller, not this.
 *
 *   node scripts/wolves-cue-at.mjs 4:41
 *   node scripts/wolves-cue-at.mjs prologue 281
 *   node scripts/wolves-cue-at.mjs prologue --all
 */

import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Ordinal running order of the show's videos. Keep in step with docs/reference/wolves-video-order.md. */
const VIDEOS = {
  prologue: {
    ordinal: 1,
    title: 'The Gardener and the Winnower (scored Gayane prologue)',
    load: async loadModule => (await loadModule('/src/data/wolves-directors-cut-intro.ts'))
      .buildDirectorsCutPrologueSegment(),
  },
}

const ALIASES = { 1: 'prologue', first: 'prologue', gardener: 'prologue', winnower: 'prologue' }

/** Accept `281`, `4:41`, or `4m41s`. Timestamps are how the owner reports defects. */
function parseTimestamp(value) {
  const colon = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(value)
  if (colon) {
    return Number(colon[1]) * 60 + Number(colon[2])
  }
  const spelled = /^(\d+)m(\d+(?:\.\d+)?)s?$/.exec(value)
  if (spelled) {
    return Number(spelled[1]) * 60 + Number(spelled[2])
  }
  const plain = Number(value)
  return Number.isFinite(plain) ? plain : Number.NaN
}

function formatTimestamp(seconds) {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = (seconds - minutes * 60).toFixed(2).padStart(5, '0')
  return `${minutes}:${rest}`
}

function describeCue(cue, at) {
  const words = cue.text ? cue.text.trim().split(/\s+/).filter(Boolean).length : 0
  const lines = cue.text ? cue.text.split('\n').length : 0
  const holdEnd = cue.textHoldSeconds != null ? cue.start + cue.textHoldSeconds : cue.end
  return {
    window: `${formatTimestamp(cue.start)} - ${formatTimestamp(cue.end)}`,
    text: cue.text || '(wordless shot)',
    words,
    lines,
    longestLine: cue.text
      ? Math.max(...cue.text.split('\n').map(line => line.trim().length))
      : 0,
    emphasis: cue.emphasis ?? 'normal',
    position: cue.textPosition ?? 'default',
    image: cue.backgroundImage ?? (cue.backgroundCrossfade ? '(crossfade)' : '(none)'),
    textUp: at == null ? null : at < holdEnd,
    holdEnds: cue.textHoldSeconds != null ? formatTimestamp(holdEnd) : '(holds the shot)',
  }
}

function print(cue, at) {
  const detail = describeCue(cue, at)
  console.info(`  ${detail.window}  [${detail.emphasis}]`)
  for (const line of detail.text.split('\n')) {
    console.info(`    | ${line}`)
  }
  console.info(`    words ${detail.words}  lines ${detail.lines}  longest line ${detail.longestLine} chars`)
  console.info(`    text clears ${detail.holdEnds}  position ${detail.position}  image ${detail.image}`)
  if (detail.textUp != null) {
    console.info(`    text on screen at the requested second: ${detail.textUp ? 'YES' : 'no, already cleared'}`)
  }
  console.info('')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('--help')) {
    console.info('usage: node scripts/wolves-cue-at.mjs [video] <m:ss | seconds | --all>')
    console.info(`videos: ${Object.keys(VIDEOS).join(', ')} (default: prologue)`)
    process.exit(args.length === 0 ? 1 : 0)
  }

  const named = args.find(arg => !arg.startsWith('-') && Number.isNaN(parseTimestamp(arg)))
  const key = ALIASES[named] ?? named ?? 'prologue'
  const video = VIDEOS[key]
  if (!video) {
    console.error(`unknown video "${named}". known: ${Object.keys(VIDEOS).join(', ')}`)
    process.exit(1)
  }

  const wantsAll = args.includes('--all')
  const stamp = args.find(arg => !arg.startsWith('-') && !Number.isNaN(parseTimestamp(arg)))
  if (!wantsAll && stamp == null) {
    console.error('give a timestamp (4:41 or 281) or --all')
    process.exit(1)
  }

  const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  try {
    const segment = await video.load(specifier => server.ssrLoadModule(specifier))
    const cues = segment.overlays

    console.info(`\nvideo ${video.ordinal}: ${key} — ${video.title}`)
    console.info(`duration ${formatTimestamp(segment.duration)}, ${cues.length} shots\n`)

    if (wantsAll) {
      cues.forEach(cue => print(cue))
      return
    }

    const at = parseTimestamp(stamp)
    const cue = cues.find(candidate => at >= candidate.start && at < candidate.end)
    console.info(`at ${formatTimestamp(at)} (${at}s):\n`)
    if (!cue) {
      console.info('  nothing scheduled — the timestamp is past the end of this video.\n')
      return
    }
    print(cue, at)
  }
  finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
