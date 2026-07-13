import type { WolvesArtifact, WolvesChapter } from '../data/wolves-story'
import { wolvesRelease } from '../data/wolves-story'

export function getChapterForPage(page: number): WolvesChapter | undefined {
  if (wolvesRelease.chapters.length === 0) {
    return undefined
  }
  const found = wolvesRelease.chapters.find(chapter => page >= chapter.pageStart && page <= chapter.pageEnd)
  if (found) {
    return found
  }
  // Clamp to the last chapter for any pages beyond the end of the last chapter
  const lastChapter = wolvesRelease.chapters[wolvesRelease.chapters.length - 1]
  if (page > lastChapter.pageEnd) {
    return lastChapter
  }
  return undefined
}

export function getArtifactsForChapter(chapterId: string): WolvesArtifact[] {
  return wolvesRelease.artifacts.filter(artifact => artifact.chapterId === chapterId)
}

export function getNewArtifactIds(lastSeenReleaseId: string | null): string[] {
  return lastSeenReleaseId === wolvesRelease.id ? [] : wolvesRelease.artifacts.map(artifact => artifact.id)
}
