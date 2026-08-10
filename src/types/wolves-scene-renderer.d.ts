declare module '*scripts/wolves-scenes/render-scenes.js' {
  export interface SceneSelection {
    id: string
    start: number
    end: number | 'source-end'
    label: string
  }

  export interface SceneOverlay {
    sceneId: string
    kind: 'replace-title' | 'guardian-nameplate'
    start: number
    endRule: 'next-hard-cut'
    text: string
    role?: string
  }

  export interface SceneSource {
    id: string
    youtubeId: string
    title: string
    inputFile: string
    selections: SceneSelection[]
    reviewPolicy?: {
      kind: 'exclude-face-shots' | 'exclude-astronaut-shots' | 'exclude-title-card'
      start: number
      end: number | 'source-end'
    }
    overlays?: SceneOverlay[]
  }

  export interface SceneManifest {
    version: 1
    audio: 'none'
    sources: SceneSource[]
  }

  export interface SceneLock {
    version: 1
    manifestHash: string
    sourceMetadata: Record<string, {
      duration: number
      width: number
      height: number
      frameRate: string
      codec?: string
    }>
    resolvedSelections: Record<string, SceneSelection[]>
    overlayEnds: Record<string, number>
  }

  export interface SceneJob {
    id: string
    sourceId: string
    sourcePath: string
    outputPath: string
    startSeconds: number
    endSeconds: number
    durationSeconds: number
    label: string
    overlays: SceneOverlay[]
    sourceMetadata: SceneLock['sourceMetadata'][string]
  }

  export function validateSceneManifest(value: unknown): SceneManifest
  export function manifestHash(manifest: SceneManifest): string
  export function validateSceneLock(value: unknown, manifest: SceneManifest): SceneLock
  export function buildSceneJobs(
    manifest: SceneManifest,
    lock: SceneLock,
    inputDir: string,
    outputDir: string,
  ): SceneJob[]
  export function buildFfmpegArgs(job: SceneJob, outputPath?: string): string[]
  export function readRenderedMetadata(value: unknown): {
    duration: number
    videoStreams: number
    audioStreams: number
    codec: string
    width: number
    height: number
    frameRate: string
  }
  export function verifyDuration(actual: number, expected: number, frameRate?: string): void
}
