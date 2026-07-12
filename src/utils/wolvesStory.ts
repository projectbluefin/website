import { wolvesRelease, type WolvesArtifact, type WolvesChapter } from '../data/wolves-story'

export function getChapterForPage(page: number): WolvesChapter | undefined {
  return wolvesRelease.chapters.find(chapter => page >= chapter.pageStart && page <= chapter.pageEnd)
}

export function getArtifactsForChapter(chapterId: string): WolvesArtifact[] {
  return wolvesRelease.artifacts.filter(artifact => artifact.chapterId === chapterId)
}

export function getNewArtifactIds(lastSeenReleaseId: string | null): string[] {
  return lastSeenReleaseId === wolvesRelease.id ? [] : wolvesRelease.artifacts.map(artifact => artifact.id)
}
