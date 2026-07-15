/* eslint-disable no-console */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')

const defaultThreads = Math.max(1, Math.min(2, os.cpus().length - 1))
const defaultRecordingsDir = path.join(__dirname, 'recordings')
const totalMemGiB = Math.max(4, Math.floor(os.totalmem() / (1024 ** 3)))
const defaultMemoryHighGiB = Math.max(8, Math.floor(totalMemGiB * 0.65))
const defaultMemoryMaxGiB = Math.max(defaultMemoryHighGiB + 2, Math.floor(totalMemGiB * 0.8))
const defaults = {
  url: 'http://127.0.0.1:5173/wolves/',
  width: 2560,
  height: 1440,
  fps: 25,
  duration: 424,
  settleMs: 2000,
  threads: defaultThreads,
  crf: 18,
  preset: 'veryfast',
  videoCodec: 'auto',
  vaapiDevice: '/dev/dri/renderD128',
  memoryHigh: `${defaultMemoryHighGiB}G`,
  memoryMax: `${defaultMemoryMaxGiB}G`,
  recordingsDir: defaultRecordingsDir,
  outputPath: path.join(defaultRecordingsDir, 'wolves-first-song-1440p.mp4'),
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw.startsWith('--')) {
      continue
    }
    const [key, inlineValue] = raw.slice(2).split('=', 2)
    const value = inlineValue === undefined ? argv[i + 1] : inlineValue
    if (inlineValue === undefined) {
      i++
    }
    parsed[key] = value
  }
  return parsed
}

function parsePositiveInteger(value, field) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field}: expected positive integer, got "${value}"`)
  }
  return parsed
}

function parseNonNegativeNumber(value, field) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${field}: expected non-negative number, got "${value}"`)
  }
  return parsed
}

function assertLocalUrl(url) {
  const parsed = new URL(url)
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error(`Local-only guard: URL must target localhost/127.0.0.1, got "${url}"`)
  }
}

function buildConfig(args) {
  const cfg = { ...defaults }
  if (args.url) {
    cfg.url = args.url
  }
  if (args.width) {
    cfg.width = parsePositiveInteger(args.width, 'width')
  }
  if (args.height) {
    cfg.height = parsePositiveInteger(args.height, 'height')
  }
  if (args.fps) {
    cfg.fps = parsePositiveInteger(args.fps, 'fps')
  }
  if (args.duration) {
    cfg.duration = parseNonNegativeNumber(args.duration, 'duration')
  }
  if (args.settleMs) {
    cfg.settleMs = parsePositiveInteger(args.settleMs, 'settleMs')
  }
  if (args.threads) {
    cfg.threads = parsePositiveInteger(args.threads, 'threads')
  }
  if (args.crf) {
    cfg.crf = parsePositiveInteger(args.crf, 'crf')
  }
  if (args.preset) {
    cfg.preset = args.preset
  }
  if (args.videoCodec) {
    cfg.videoCodec = args.videoCodec
  }
  if (args.vaapiDevice) {
    cfg.vaapiDevice = args.vaapiDevice
  }
  if (args.memoryHigh) {
    cfg.memoryHigh = args.memoryHigh
  }
  if (args.memoryMax) {
    cfg.memoryMax = args.memoryMax
  }
  if (args.recordingsDir) {
    cfg.recordingsDir = path.resolve(args.recordingsDir)
  }
  if (args.output) {
    cfg.outputPath = path.resolve(args.output)
  }

  assertLocalUrl(cfg.url)
  return cfg
}

function hasVaapiRenderNode(devicePath) {
  return fs.existsSync(devicePath)
}

function selectVideoCodec(requestedCodec, supportedEncoders, vaapiAvailable) {
  if (requestedCodec !== 'auto') {
    return requestedCodec
  }
  if (vaapiAvailable && supportedEncoders.includes('hevc_vaapi')) {
    return 'hevc_vaapi'
  }
  if (vaapiAvailable && supportedEncoders.includes('h264_vaapi')) {
    return 'h264_vaapi'
  }
  if (supportedEncoders.includes('libx264')) {
    return 'libx264'
  }
  return 'libvpx-vp9'
}

function runFfmpeg(config, videoPath, audioPath) {
  const encoderList = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' })
  const supportedEncoders = `${encoderList.stdout || ''}\n${encoderList.stderr || ''}`
  const vaapiAvailable = hasVaapiRenderNode(config.vaapiDevice)
  const videoCodec = selectVideoCodec(config.videoCodec, supportedEncoders, vaapiAvailable)

  const ffmpegArgs = [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-fps_mode',
    'cfr',
    '-r',
    String(config.fps),
    '-threads',
    String(config.threads),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
  ]

  if (videoCodec === 'hevc_vaapi') {
    ffmpegArgs.push(
      '-vaapi_device',
      config.vaapiDevice,
      '-vf',
      'format=nv12,hwupload',
      '-c:v',
      'hevc_vaapi',
      '-qp',
      String(Math.max(16, Math.min(30, config.crf + 2))),
      '-g',
      '120',
      '-rc_mode',
      'CQP',
      '-bf',
      '2',
    )
  }
  else if (videoCodec === 'h264_vaapi') {
    ffmpegArgs.push(
      '-vaapi_device',
      config.vaapiDevice,
      '-vf',
      'format=nv12,hwupload',
      '-c:v',
      'h264_vaapi',
      '-qp',
      String(Math.max(16, Math.min(30, config.crf))),
      '-g',
      '120',
      '-rc_mode',
      'CQP',
      '-bf',
      '2',
    )
  }
  else if (videoCodec === 'libx264') {
    ffmpegArgs.push(
      '-c:v',
      'libx264',
      '-preset',
      config.preset,
      '-crf',
      String(config.crf),
      '-pix_fmt',
      'yuv420p',
    )
  }
  else if (videoCodec === 'libvpx-vp9') {
    // ponytail: no artificial CRF floor here, config.crf is used as-is (bounded to valid vp9 range)
    const vp9Crf = Math.max(4, Math.min(40, config.crf))
    ffmpegArgs.push(
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(vp9Crf),
      '-deadline',
      'realtime',
      '-cpu-used',
      '3',
      '-g',
      '240',
      '-pix_fmt',
      'yuv420p',
    )
  }
  else {
    throw new Error(`Unsupported videoCodec "${videoCodec}". Use auto, hevc_vaapi, h264_vaapi, libx264, or libvpx-vp9.`)
  }

  ffmpegArgs.push(config.outputPath)

  const command = [
    '--user',
    '--scope',
    '-p',
    `MemoryHigh=${config.memoryHigh}`,
    '-p',
    `MemoryMax=${config.memoryMax}`,
    'ffmpeg',
    ...ffmpegArgs,
  ]

  const result = spawnSync('systemd-run', command, { stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`)
  }
}

async function main() {
  const config = buildConfig(parseArgs(process.argv.slice(2)))

  fs.mkdirSync(path.dirname(config.outputPath), { recursive: true })

  console.log(`Starting deterministic local Wolves capture (single-pass, no lossy intermediate):`)
  console.log(`- URL: ${config.url}`)
  console.log(`- Resolution: ${config.width}x${config.height}`)
  console.log(`- FPS: ${config.fps}`)
  console.log(`- Duration: ${config.duration}s`)
  console.log(`- Output: ${config.outputPath}`)

  const audioPath = path.join(__dirname, 'track0.m4a')
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at: ${audioPath}`)
  }

  console.log('Launching headless Chromium...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  console.log(`Navigating to ${config.url} ...`)
  await page.goto(config.url)
  await page.waitForFunction(() => typeof window.simulateWolvesProgress === 'function')
  await page.getByRole('button', { name: '▶ JOIN THE EVOLUTION' }).click()
  await page.waitForSelector('.immersive-layout')

  console.log('Page loaded. Injecting capture CSS...')
  await page.addStyleTag({
    content: `
      .hud-exit-btn { display: none !important; }
      body, * { cursor: none !important; }
    `,
  })

  // ponytail: real-time CDP screencast instead of Playwright's built-in recorder
  // (hardcodes a lossy 1Mbps VP8 intermediate -> that was the actual quality bug) and
  // instead of per-frame page.screenshot() polling (blocks browser rendering, measured
  // ~2fps at 1440p -> 80+ min for the full clip). Screencast pushes frames as the
  // browser paints them without blocking, so capture takes ~real-time only.
  // Frames are buffered to disk (not piped live) because delivery isn't evenly spaced;
  // encoding is a second pass at the *measured* average fps so audio/video stay in sync.
  const framesDir = path.join(config.recordingsDir, 'frames')
  fs.rmSync(framesDir, { recursive: true, force: true })
  fs.mkdirSync(framesDir, { recursive: true })

  const cdp = await context.newCDPSession(page)
  let frameCount = 0
  let lastLogAt = 0
  const pendingWrites = []
  // ponytail: real receipt time per frame, not just a count. Screencast delivery is
  // bursty (not evenly paced) -- encoding at one averaged fps stretches/compresses
  // real motion unevenly, which is what caused the judder/flicker. Recording the
  // actual timestamp per frame lets us rebuild true frame pacing in the encode step.
  const frameTimestamps = []
  cdp.on('Page.screencastFrame', (params) => {
    frameCount++
    const index = frameCount
    const now = Date.now()
    frameTimestamps.push(now)
    if (now - lastLogAt > 30000) {
      lastLogAt = now
      console.log(`Captured ${frameCount} frames so far...`)
    }
    const buf = Buffer.from(params.data, 'base64')
    const framePath = path.join(framesDir, `frame-${String(index).padStart(6, '0')}.jpg`)
    pendingWrites.push(fs.promises.writeFile(framePath, buf))
    // ponytail: ack immediately, disk writes are far faster than the vp9 encoder,
    // so capture isn't gated by encode speed
    cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {})
  })

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: config.width,
    maxHeight: config.height,
    everyNthFrame: 1,
  })

  console.log(`Playing back Wolves experience in real time for ${config.duration}s...`)
  const captureStart = Date.now()
  await page.evaluate((dur) => {
    return new Promise((resolve) => {
      const startTime = performance.now()

      function tick() {
        const elapsed = (performance.now() - startTime) / 1000
        if (elapsed >= dur) {
          if (typeof window.simulateWolvesProgress === 'function') {
            window.simulateWolvesProgress(dur, dur, 0)
          }
          resolve()
          return
        }

        if (typeof window.simulateWolvesProgress === 'function') {
          window.simulateWolvesProgress(elapsed, dur, 0)
        }

        requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    })
  }, config.duration)
  const captureElapsedSeconds = (Date.now() - captureStart) / 1000

  console.log(`Playback complete (${frameCount} frames captured). Stopping screencast...`)
  await cdp.send('Page.stopScreencast')
  await Promise.all(pendingWrites)

  await context.close()
  await browser.close()

  if (frameCount === 0) {
    throw new Error('No frames were captured')
  }

  const effectiveFps = frameCount / captureElapsedSeconds
  console.log(`Captured ${frameCount} frames over ${captureElapsedSeconds.toFixed(1)}s (${effectiveFps.toFixed(2)} fps effective).`)
  console.log('Encoding to VP9 (single pass, true per-frame timing, high-quality preset)...')

  // ponytail: concat demuxer with the real inter-frame gaps instead of assuming a
  // fixed fps. This is what actually fixes judder -- screencast delivery is bursty,
  // so a flat "-r effectiveFps" stretched/compressed real motion unevenly.
  const concatPath = path.join(framesDir, 'concat.txt')
  const concatLines = []
  for (let i = 0; i < frameCount; i++) {
    const framePath = `frame-${String(i + 1).padStart(6, '0')}.jpg`
    const durSeconds
      = i + 1 < frameCount ? (frameTimestamps[i + 1] - frameTimestamps[i]) / 1000 : 1 / effectiveFps
    concatLines.push(`file '${framePath}'`)
    concatLines.push(`duration ${Math.max(durSeconds, 0.001).toFixed(6)}`)
  }
  // ffmpeg concat demuxer quirk: last file's duration is ignored, so repeat it.
  concatLines.push(`file 'frame-${String(frameCount).padStart(6, '0')}.jpg'`)
  fs.writeFileSync(concatPath, concatLines.join('\n'))

  const ffmpegArgs = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-threads',
    String(config.threads),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    String(Math.max(4, Math.min(40, config.crf))),
    // ponytail: this is now a second pass, not a live-bound encode, so there's no
    // reason to use the fastest/lowest-quality realtime preset anymore -- that was
    // a leftover from the earlier live-pipe attempt and was hurting quality.
    '-deadline',
    'good',
    '-cpu-used',
    '2',
    '-g',
    '240',
    '-row-mt',
    '1',
    '-tile-columns',
    '2',
    '-frame-parallel',
    '1',
    '-pix_fmt',
    'yuv420p',
    config.outputPath,
  ]

  const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' })
  fs.rmSync(framesDir, { recursive: true, force: true })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`)
  }

  console.log(`Complete: ${config.outputPath}`)
}

module.exports = {
  buildConfig,
  hasVaapiRenderNode,
  selectVideoCodec,
  runFfmpeg,
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal Error:', err)
    process.exit(1)
  })
}
