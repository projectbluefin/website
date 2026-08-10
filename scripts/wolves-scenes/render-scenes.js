import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(MODULE_PATH)
const ROOT_DIR = resolve(SCRIPT_DIR, '../..')
const DEFAULT_MANIFEST_PATH = join(SCRIPT_DIR, 'scene-manifest.json')
const DEFAULT_LOCK_PATH = join(SCRIPT_DIR, 'scene-lock.json')
const FFMPEG_BIN = process.env.WOLVES_FFMPEG_BIN ?? 'ffmpeg'
const VALID_REVIEW_POLICIES = new Set([
  'exclude-face-shots',
  'exclude-astronaut-shots',
  'exclude-title-card',
])
const VALID_OVERLAY_KINDS = new Set(['replace-title', 'guardian-nameplate'])

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`)
  }
  return value
}

function requireArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array`)
  }
  return value
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value
}

function requireNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative finite number`)
  }
  return value
}

function validateEnd(value, field) {
  if (value === 'source-end') {
    return value
  }
  return requireNumber(value, field)
}

function validateSelection(value, field) {
  const selection = requireObject(value, field)
  const id = requireString(selection.id, `${field}.id`)
  const start = requireNumber(selection.start, `${field}.start`)
  const end = validateEnd(selection.end, `${field}.end`)
  const label = requireString(selection.label, `${field}.label`)
  if (typeof end === 'number' && end <= start) {
    throw new RangeError(`${field}.end must be greater than start`)
  }
  return { id, start, end, label }
}

function validateReviewPolicy(value, field) {
  const policy = requireObject(value, field)
  const kind = requireString(policy.kind, `${field}.kind`)
  if (!VALID_REVIEW_POLICIES.has(kind)) {
    throw new TypeError(`${field}.kind is invalid`)
  }
  const start = requireNumber(policy.start, `${field}.start`)
  const end = validateEnd(policy.end, `${field}.end`)
  if (typeof end === 'number' && end <= start) {
    throw new RangeError(`${field}.end must be greater than start`)
  }
  return { kind, start, end }
}

function validateOverlay(value, field) {
  const overlay = requireObject(value, field)
  const sceneId = requireString(overlay.sceneId, `${field}.sceneId`)
  const kind = requireString(overlay.kind, `${field}.kind`)
  if (!VALID_OVERLAY_KINDS.has(kind)) {
    throw new TypeError(`${field}.kind is invalid`)
  }
  const start = requireNumber(overlay.start, `${field}.start`)
  if (overlay.endRule !== 'next-hard-cut') {
    throw new TypeError(`${field}.endRule must be next-hard-cut`)
  }
  const text = requireString(overlay.text, `${field}.text`)
  const role = overlay.role === undefined ? undefined : requireString(overlay.role, `${field}.role`)
  return { sceneId, kind, start, endRule: 'next-hard-cut', text, ...(role ? { role } : {}) }
}

export function validateSceneManifest(value) {
  const manifest = requireObject(value, 'manifest')
  if (manifest.version !== 1) {
    throw new TypeError('manifest.version must be 1')
  }
  if (manifest.audio !== 'none') {
    throw new TypeError('manifest.audio must be none')
  }

  const sceneIds = new Set()
  const sourceIds = new Set()
  const youtubeIds = new Set()
  const sources = requireArray(manifest.sources, 'manifest.sources').map((sourceValue, sourceIndex) => {
    const field = `manifest.sources[${sourceIndex}]`
    const source = requireObject(sourceValue, field)
    const id = requireString(source.id, `${field}.id`)
    const youtubeId = requireString(source.youtubeId, `${field}.youtubeId`)
    if (sourceIds.has(id) || youtubeIds.has(youtubeId)) {
      throw new TypeError(`duplicate source id or YouTube id: ${id}`)
    }
    sourceIds.add(id)
    youtubeIds.add(youtubeId)

    const selections = requireArray(source.selections, `${field}.selections`)
      .map((selection, selectionIndex) => validateSelection(selection, `${field}.selections[${selectionIndex}]`))
      .sort((left, right) => left.start - right.start)

    for (let index = 0; index < selections.length; index++) {
      const selection = selections[index]
      if (sceneIds.has(selection.id)) {
        throw new TypeError(`duplicate scene id: ${selection.id}`)
      }
      sceneIds.add(selection.id)
      const previous = selections[index - 1]
      if (previous && previous.end === 'source-end') {
        throw new RangeError(`${field}.selections overlap after source-end`)
      }
      if (previous && typeof previous.end === 'number' && selection.start < previous.end) {
        throw new RangeError(`${field}.selections overlap`)
      }
    }

    const reviewPolicy = source.reviewPolicy === undefined
      ? undefined
      : validateReviewPolicy(source.reviewPolicy, `${field}.reviewPolicy`)
    const overlays = source.overlays === undefined
      ? []
      : requireArray(source.overlays, `${field}.overlays`)
          .map((overlay, overlayIndex) => validateOverlay(overlay, `${field}.overlays[${overlayIndex}]`))

    for (const overlay of overlays) {
      if (!selections.some(selection => selection.id === overlay.sceneId)) {
        throw new TypeError(`${field}.overlays references unknown scene ${overlay.sceneId}`)
      }
    }

    return {
      id,
      youtubeId,
      title: requireString(source.title, `${field}.title`),
      inputFile: requireString(source.inputFile, `${field}.inputFile`),
      selections,
      ...(reviewPolicy ? { reviewPolicy } : {}),
      ...(overlays.length > 0 ? { overlays } : {}),
    }
  })

  return { version: 1, audio: 'none', sources }
}

export function manifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
}

export function validateSceneLock(value, manifest) {
  const lock = requireObject(value, 'lock')
  if (lock.version !== 1) {
    throw new TypeError('lock.version must be 1')
  }
  if (lock.manifestHash !== manifestHash(manifest)) {
    throw new TypeError('lock manifest hash does not match')
  }
  const sourceMetadata = requireObject(lock.sourceMetadata, 'lock.sourceMetadata')
  const resolvedSelections = lock.resolvedSelections === undefined
    ? {}
    : requireObject(lock.resolvedSelections, 'lock.resolvedSelections')
  const overlayEnds = lock.overlayEnds === undefined
    ? {}
    : requireObject(lock.overlayEnds, 'lock.overlayEnds')
  return { version: 1, manifestHash: lock.manifestHash, sourceMetadata, resolvedSelections, overlayEnds }
}

export async function loadSceneManifest(path = DEFAULT_MANIFEST_PATH) {
  return validateSceneManifest(JSON.parse(await readFile(path, 'utf8')))
}

export async function loadSceneLock(path, manifest) {
  return validateSceneLock(JSON.parse(await readFile(path, 'utf8')), manifest)
}

function resolvedSourceSelections(source, lock) {
  const resolved = lock.resolvedSelections[source.id]
  if (source.reviewPolicy && !Array.isArray(resolved)) {
    throw new Error(`source ${source.id} has unresolved ${source.reviewPolicy.kind} review policy`)
  }
  const reviewed = Array.isArray(resolved)
    ? resolved.map((selection, index) => validateSelection(selection, `lock.resolvedSelections.${source.id}[${index}]`))
    : []
  return [...source.selections, ...reviewed].sort((left, right) => left.start - right.start)
}

export function buildSceneJobs(manifest, lock, inputDir, outputDir) {
  const jobs = []
  for (const source of manifest.sources) {
    const metadata = requireObject(lock.sourceMetadata[source.id], `lock.sourceMetadata.${source.id}`)
    const duration = requireNumber(metadata.duration, `lock.sourceMetadata.${source.id}.duration`)
    for (const selection of resolvedSourceSelections(source, lock)) {
      const endSeconds = selection.end === 'source-end' ? duration : selection.end
      if (endSeconds > duration + 0.05) {
        throw new RangeError(`${selection.id} ends after source duration`)
      }
      const overlays = (source.overlays ?? [])
        .filter(overlay => overlay.sceneId === selection.id)
        .map((overlay) => {
          const end = lock.overlayEnds[`${selection.id}:${overlay.start}`]
          return {
            ...overlay,
            ...(typeof end === 'number' ? { end } : {}),
          }
        })
      jobs.push({
        id: selection.id,
        sourceId: source.id,
        sourcePath: join(inputDir, source.inputFile),
        outputPath: join(outputDir, `${selection.id}.mp4`),
        startSeconds: selection.start,
        endSeconds,
        durationSeconds: endSeconds - selection.start,
        label: selection.label,
        overlays,
        sourceMetadata: metadata,
      })
    }
  }
  return jobs
}

function formatSeconds(value) {
  return value.toFixed(3)
}

export function buildFfmpegArgs(job, outputPath = job.outputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    formatSeconds(job.startSeconds),
    '-i',
    job.sourcePath,
    '-t',
    formatSeconds(job.durationSeconds),
    '-map',
    '0:v:0',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-threads',
    '4',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

export function readRenderedMetadata(value) {
  const probe = requireObject(value, 'ffprobe output')
  const streams = requireArray(probe.streams, 'ffprobe output.streams')
  const videoStreams = streams.filter(stream => stream.codec_type === 'video')
  const audioStreams = streams.filter(stream => stream.codec_type === 'audio')
  if (videoStreams.length !== 1) {
    throw new Error(`expected one video stream, found ${videoStreams.length}`)
  }
  if (audioStreams.length !== 0) {
    throw new Error(`expected no audio stream, found ${audioStreams.length}`)
  }
  const video = videoStreams[0]
  return {
    duration: Number.parseFloat(probe.format?.duration),
    videoStreams: videoStreams.length,
    audioStreams: audioStreams.length,
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    frameRate: video.r_frame_rate,
  }
}

function frameDuration(frameRate) {
  const [numerator, denominator] = String(frameRate).split('/').map(Number)
  return denominator > 0 && numerator > 0 ? denominator / numerator : 1 / 24
}

export function verifyDuration(actual, expected, frameRate = '24/1') {
  const tolerance = frameDuration(frameRate) + 0.02
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`rendered duration ${actual} differs from expected ${expected}`)
  }
}

function probe(path) {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    path,
  ], { encoding: 'utf8' })
  return JSON.parse(output)
}

function shellQuote(value) {
  return `'${String(value).replaceAll('\'', '\'\\\'\'')}'`
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--dry-run' || argument === '--verify') {
      args[argument.slice(2)] = true
      continue
    }
    if (!argument.startsWith('--')) {
      throw new Error(`unexpected argument: ${argument}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${argument}`)
    }
    args[argument.slice(2)] = value
    index++
  }
  return args
}

async function runFfmpeg(args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(FFMPEG_BIN, args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (status) => {
      if (status === 0) {
        resolvePromise()
      }
      else {
        reject(new Error(`ffmpeg exited with status ${status}`))
      }
    })
  })
}

async function renderJob(job) {
  await mkdir(dirname(job.outputPath), { recursive: true })
  const partialPath = job.outputPath.replace(/\.mp4$/u, '.partial.mp4')
  await rm(partialPath, { force: true })
  await runFfmpeg(buildFfmpegArgs(job, partialPath))
  const metadata = readRenderedMetadata(probe(partialPath))
  verifyDuration(metadata.duration, job.durationSeconds, metadata.frameRate)
  if (metadata.codec !== 'h264') {
    throw new Error(`${job.id} rendered with ${metadata.codec}, expected h264`)
  }
  if (metadata.width !== job.sourceMetadata.width || metadata.height !== job.sourceMetadata.height) {
    throw new Error(`${job.id} dimensions differ from source`)
  }
  await rename(partialPath, job.outputPath)
  return {
    id: job.id,
    filename: `${job.id}.mp4`,
    sourceId: job.sourceId,
    sourceStart: job.startSeconds,
    sourceEnd: job.endSeconds,
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    frameRate: metadata.frameRate,
    codec: metadata.codec,
    overlays: job.overlays,
  }
}

async function mapConcurrent(items, concurrency, operation) {
  const results = Array.from({ length: items.length })
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex++
      results[index] = await operation(items[index])
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  ))
  return results
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const manifestPath = resolve(args.manifest ?? DEFAULT_MANIFEST_PATH)
  const lockPath = resolve(args.lock ?? DEFAULT_LOCK_PATH)
  const inputDir = resolve(args['input-dir'] ?? '/var/tmp/website-agent/wolves-scenes/sources')
  const outputDir = resolve(args['output-dir'] ?? join(ROOT_DIR, 'recordings/wolves-scenes'))
  const manifest = await loadSceneManifest(manifestPath)
  const lock = await loadSceneLock(lockPath, manifest)
  const jobs = buildSceneJobs(manifest, lock, inputDir, outputDir)

  if (args['dry-run']) {
    for (const job of jobs) {
      console.info(['ffmpeg', ...buildFfmpegArgs(job)].map(shellQuote).join(' '))
    }
    return
  }

  const concurrency = Number.parseInt(args.jobs ?? '2', 10)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('--jobs must be an integer from 1 through 8')
  }
  const records = await mapConcurrent(jobs, concurrency, renderJob)
  await writeFile(join(outputDir, 'index.json'), `${JSON.stringify({ version: 1, scenes: records }, null, 2)}\n`)

  if (args.verify) {
    console.info(`Verified ${records.length} silent scene masters.`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === MODULE_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
