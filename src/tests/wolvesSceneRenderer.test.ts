import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error script module is intentionally plain Node ESM
import {
  buildFfmpegArgs,
  buildSceneJobs,
  manifestHash,
  readRenderedMetadata,
  validateSceneLock,
  validateSceneManifest,
  verifyDuration,
} from '../../scripts/wolves-scenes/render-scenes.js'

const validManifestInput = {
  version: 1,
  audio: 'none',
  sources: [{
    id: 'source',
    youtubeId: 'abcdefghijk',
    title: 'Source',
    inputFile: 'source.mp4',
    selections: [{ id: 'example-001', start: 11, end: 12, label: 'Example' }],
  }],
}

function manifest() {
  return validateSceneManifest(structuredClone(validManifestInput))
}

function lockFor(value = manifest()) {
  return {
    version: 1,
    manifestHash: manifestHash(value),
    sourceMetadata: {
      source: { duration: 20, width: 1920, height: 1080, frameRate: '30/1' },
    },
    resolvedSelections: {},
    overlayEnds: {},
  }
}

describe('wolves scene renderer', () => {
  it('registers every authored source and deterministic cut window', async () => {
    const authored = validateSceneManifest(JSON.parse(await readFile(
      resolve('scripts/wolves-scenes/scene-manifest.json'),
      'utf8',
    )))
    const source = (youtubeId: string) => authored.sources.find(item => item.youtubeId === youtubeId)
    const windows = (youtubeId: string) => source(youtubeId)?.selections.map(item => [item.start, item.end])

    expect(authored.sources).toHaveLength(14)
    expect(windows('Bq-tjhfSLQA')).toEqual([[26, 31], [177, 371], [1411, 1428], [2130, 2161]])
    expect(windows('h-5S82ETKvI')).toEqual([
      [0, 15],
      [19, 27],
      [30, 55],
      [60, 66],
      [69, 75],
      [82, 88],
      [91, 94],
      [104, 108],
    ])
    expect(windows('Ms90okhAbTw')).toEqual([[11, 12], [13, 17], [18, 19], [31, 35]])
    expect(windows('buh6WERf-zY')).toEqual([[25, 31], [39, 53]])
    expect(windows('UchfadQhX7w')).toEqual([[45, 54], [77, 82], [83, 87], [91, 97]])
    expect(source('YLWhu20p-KQ')?.reviewPolicy?.kind).toBe('exclude-face-shots')
    expect(source('LobB2UX1nKw')?.reviewPolicy?.kind).toBe('exclude-astronaut-shots')
    expect(source('6Gm5mbwrqSA')?.reviewPolicy?.kind).toBe('exclude-title-card')
    expect(source('Bq-tjhfSLQA')?.overlays).toEqual([
      expect.objectContaining({ kind: 'replace-title', start: 62, text: 'Project Bluefin' }),
      expect.objectContaining({ kind: 'guardian-nameplate', start: 89, text: 'Ahmed Adan', role: 'Warlock' }),
    ])
  })

  it('validates the manifest and builds silent frame-accurate ffmpeg jobs', () => {
    const value = manifest()
    const lock = validateSceneLock(lockFor(value), value)
    const [job] = buildSceneJobs(value, lock, '/inputs', '/outputs')

    expect(job).toMatchObject({
      sourcePath: '/inputs/source.mp4',
      outputPath: '/outputs/example-001.mp4',
      startSeconds: 11,
      endSeconds: 12,
      durationSeconds: 1,
    })
    expect(buildFfmpegArgs(job)).toEqual(expect.arrayContaining([
      '-ss',
      '11.000',
      '-t',
      '1.000',
      '-an',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
    ]))
    expect(buildFfmpegArgs(job)).not.toContain('0:a')
  })

  it('rejects invalid audio, duplicate ids, empty windows, overlaps, and stale locks', () => {
    expect(() => validateSceneManifest({ ...validManifestInput, audio: 'source' })).toThrow(/audio.*none/i)

    const duplicate = structuredClone(validManifestInput)
    duplicate.sources[0].selections.push({ id: 'example-001', start: 13, end: 14, label: 'Duplicate' })
    expect(() => validateSceneManifest(duplicate)).toThrow(/duplicate scene/i)

    const empty = structuredClone(validManifestInput)
    empty.sources[0].selections[0].end = 11
    expect(() => validateSceneManifest(empty)).toThrow(/end.*greater/i)

    const overlap = structuredClone(validManifestInput)
    overlap.sources[0].selections.push({ id: 'example-002', start: 11.5, end: 13, label: 'Overlap' })
    expect(() => validateSceneManifest(overlap)).toThrow(/overlap/i)

    const value = manifest()
    expect(() => validateSceneLock({ ...lockFor(value), manifestHash: 'stale' }, value)).toThrow(/manifest hash/i)
  })

  it('requires reviewed selections before rendering visual exclusion policies', () => {
    const input = structuredClone(validManifestInput)
    input.sources[0].selections = []
    Object.assign(input.sources[0], {
      reviewPolicy: { kind: 'exclude-face-shots', start: 0, end: 10 },
    })
    const value = validateSceneManifest(input)
    const unresolvedLock = validateSceneLock(lockFor(value), value)
    expect(() => buildSceneJobs(value, unresolvedLock, '/inputs', '/outputs')).toThrow(/unresolved/i)

    const resolvedLock = validateSceneLock({
      ...lockFor(value),
      resolvedSelections: {
        source: [{ id: 'face-free-001', start: 0, end: 4, label: 'Face-free shot' }],
      },
    }, value)
    expect(buildSceneJobs(value, resolvedLock, '/inputs', '/outputs')).toHaveLength(1)
  })

  it('resolves source-end windows from probed source duration', () => {
    const input = structuredClone(validManifestInput)
    input.sources[0].selections[0].end = 'source-end' as never
    const value = validateSceneManifest(input)
    const lock = validateSceneLock(lockFor(value), value)
    expect(buildSceneJobs(value, lock, '/inputs', '/outputs')[0]).toMatchObject({
      startSeconds: 11,
      endSeconds: 20,
      durationSeconds: 9,
    })
  })

  it('validates rendered stream shape and duration tolerance', () => {
    expect(readRenderedMetadata({
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' }],
      format: { duration: '4.98' },
    })).toMatchObject({
      videoStreams: 1,
      audioStreams: 0,
      codec: 'h264',
    })

    expect(() => readRenderedMetadata({
      streams: [
        { codec_type: 'video' },
        { codec_type: 'audio' },
      ],
      format: { duration: '5' },
    })).toThrow(/audio stream/i)
    expect(() => verifyDuration(4.98, 5, '30/1')).not.toThrow()
    expect(() => verifyDuration(4.5, 5, '30/1')).toThrow(/duration/i)
  })
})
