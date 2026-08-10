import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadSceneManifest,
  manifestHash,
  validateSceneLock,
} from './render-scenes.js'

const MODULE_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(MODULE_PATH)
const DEFAULT_MANIFEST_PATH = join(SCRIPT_DIR, 'scene-manifest.json')
const DEFAULT_DECISIONS_PATH = join(SCRIPT_DIR, 'scene-decisions.json')
const DEFAULT_LOCK_PATH = join(SCRIPT_DIR, 'scene-lock.json')
const FFMPEG_BIN = process.env.WOLVES_FFMPEG_BIN ?? 'ffmpeg'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (!key.startsWith('--')) {
      throw new Error(`unexpected argument: ${key}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${key}`)
    }
    args[key.slice(2)] = value
    index++
  }
  return args
}

function probeSource(path) {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    path,
  ], { encoding: 'utf8' })
  const parsed = JSON.parse(output)
  const videoStreams = parsed.streams.filter(stream => stream.codec_type === 'video')
  if (videoStreams.length !== 1) {
    throw new Error(`${path} must contain exactly one video stream`)
  }
  const video = videoStreams[0]
  return {
    duration: Number.parseFloat(parsed.format.duration),
    width: video.width,
    height: video.height,
    frameRate: video.r_frame_rate,
    codec: video.codec_name,
  }
}

function formatSeconds(value) {
  return Math.max(0, value).toFixed(3)
}

function captureFrame(sourcePath, timestamp, outputPath) {
  execFileSync(FFMPEG_BIN, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    formatSeconds(timestamp),
    '-i',
    sourcePath,
    '-frames:v',
    '1',
    '-vf',
    'scale=480:-1',
    outputPath,
  ])
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function buildReview(manifest, lock, inputDir, analysisDir) {
  const cards = []
  await mkdir(analysisDir, { recursive: true })

  for (const source of manifest.sources) {
    const selections = [
      ...source.selections,
      ...(lock.resolvedSelections[source.id] ?? []),
    ]
    const sourcePath = join(inputDir, source.inputFile)
    const sourceDuration = lock.sourceMetadata[source.id].duration
    for (const selection of selections) {
      const end = selection.end === 'source-end' ? sourceDuration : selection.end
      const startFrame = `${selection.id}-start.jpg`
      const endFrame = `${selection.id}-end.jpg`
      captureFrame(sourcePath, selection.start + 0.04, join(analysisDir, startFrame))
      captureFrame(sourcePath, Math.max(selection.start, end - 0.04), join(analysisDir, endFrame))
      cards.push({
        id: selection.id,
        label: selection.label,
        range: `${formatSeconds(selection.start)}-${formatSeconds(end)}`,
        startFrame,
        endFrame,
      })
    }
  }

  const body = cards.map(card => `
    <article>
      <h2>${htmlEscape(card.id)}</h2>
      <p>${htmlEscape(card.label)} | ${htmlEscape(card.range)}</p>
      <img src="${htmlEscape(card.startFrame)}" alt="${htmlEscape(card.id)} first frame">
      <img src="${htmlEscape(card.endFrame)}" alt="${htmlEscape(card.id)} last frame">
    </article>`).join('\n')
  await writeFile(join(analysisDir, 'review.html'), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Wolves scene boundary review</title>
<style>
body { background: #111; color: #eee; font: 16px sans-serif; margin: 2rem; }
article { border-top: 1px solid #555; padding: 1rem 0; }
img { margin-right: 1rem; max-width: 46%; vertical-align: top; }
</style>
<h1>Wolves scene boundary review</h1>
${body}
</html>
`)
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const manifestPath = resolve(args.manifest ?? DEFAULT_MANIFEST_PATH)
  const decisionsPath = resolve(args.decisions ?? DEFAULT_DECISIONS_PATH)
  const lockPath = resolve(args.lock ?? DEFAULT_LOCK_PATH)
  const inputDir = resolve(args['input-dir'] ?? '/var/tmp/website-agent/wolves-scenes/sources')
  const analysisDir = resolve(args['analysis-dir'] ?? '/var/tmp/website-agent/wolves-scenes/analysis')
  const manifest = await loadSceneManifest(manifestPath)
  const decisions = JSON.parse(await readFile(decisionsPath, 'utf8'))
  const sourceMetadata = {}

  for (const source of manifest.sources) {
    sourceMetadata[source.id] = probeSource(join(inputDir, source.inputFile))
  }

  const lock = validateSceneLock({
    version: 1,
    manifestHash: manifestHash(manifest),
    sourceMetadata,
    resolvedSelections: decisions.resolvedSelections ?? {},
    overlayEnds: decisions.overlayEnds ?? {},
  }, manifest)

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  await buildReview(manifest, lock, inputDir, analysisDir)
  console.info(`Wrote ${basename(lockPath)} and ${join(analysisDir, 'review.html')}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === MODULE_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
