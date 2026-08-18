#!/usr/bin/env node
/**
 * Answer "what is on screen at m:ss" for a Wolves video, from the real show data.
 *
 * Hand-simulating the mark grid and screenshotting nearby seconds both fail silently:
 * either can step straight over the exact cue the owner named.
 *
 * This loads the authored modules through Vite (so the aliases and TypeScript resolve
 * exactly as the app sees them) and reports the cue whose window contains the timestamp.
 * If it disagrees with the show, the show is what changed — fix the caller, not this.
 *
 *   node scripts/wolves-cue-at.mjs 1:50
 *   node scripts/wolves-cue-at.mjs prologue 110
 *   node scripts/wolves-cue-at.mjs prologue --all
 */

import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { isKnownVideo, knownVideoNames, resolveVideo } from './wolves-videos.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Accept `110`, `1:50`, or `1m50s`. Timestamps are how the owner reports defects. */
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
    textUp: at == null || !cue.text ? null : at < holdEnd,
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
    console.info(`videos: ${knownVideoNames()} (default: prologue)`)
    process.exit(args.length === 0 ? 1 : 0)
  }

  const positional = args.filter(arg => !arg.startsWith('-'))

  // Resolve the video before reading anything as a timestamp: `1` is both a valid
  // ordinal for the prologue and a valid timestamp, and parsing first makes the
  // ordinal unreachable.
  const named = positional.find(arg => isKnownVideo(arg))
    ?? positional.find(arg => Number.isNaN(parseTimestamp(arg)))
  const { key, video } = resolveVideo(named)
  if (!video) {
    console.error(`unknown video "${named}". known: ${knownVideoNames()}`)
    process.exit(1)
  }

  const wantsAll = args.includes('--all')
  const stamp = positional.find(arg => arg !== named && !Number.isNaN(parseTimestamp(arg)))
  if (!wantsAll && stamp == null) {
    console.error('give a timestamp (1:50 or 110) or --all')
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
      // Say which kind of gap this is. "Past the end" for a timestamp that falls before
      // the first shot, or inside a hole in the grid, sends the reader looking for a
      // missing cue at the wrong end of the video.
      const first = cues[0]
      const last = cues[cues.length - 1]
      if (first && at < first.start) {
        console.info(`  nothing scheduled — the first shot starts at ${formatTimestamp(first.start)}.\n`)
      }
      else if (last && at >= last.end) {
        console.info(`  nothing scheduled — the last shot ends at ${formatTimestamp(last.end)}.\n`)
      }
      else {
        console.info('  nothing scheduled — the timestamp falls in a gap between shots.\n')
      }
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
