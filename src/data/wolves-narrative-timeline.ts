import type { WolvesArtifact } from './wolves-story'
import { wolvesRelease } from './wolves-story'

export interface WolvesNarrativeSlot {
  artifactId: string
  startTime: number
  endTime: number
}

interface WolvesNarrativeLock {
  artifactId: string
  startTime: number
  endTime?: number
}

export const lockedNarrativeSlots: readonly WolvesNarrativeLock[] = [
  { artifactId: 'arthur-c-clarke-4', startTime: 0 },
  { artifactId: 'lorem-pursuit-1', startTime: 150, endTime: 220 },
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]

function legacySchedulerWeight(artifact: WolvesArtifact): number {
  return Math.max(artifact.body.trim().length, 1)
}

function createWeightedSlots(artifacts: readonly WolvesArtifact[], startTime: number, endTime: number) {
  const totalWeight = artifacts.reduce((sum, artifact) => sum + legacySchedulerWeight(artifact), 0)
  let currentTime = startTime

  return artifacts.map((artifact, index) => {
    const isLast = index === artifacts.length - 1
    const duration = isLast
      ? endTime - currentTime
      : ((endTime - startTime) * legacySchedulerWeight(artifact)) / totalWeight
    const slot = { artifactId: artifact.id, startTime: currentTime, endTime: currentTime + duration }
    currentTime = slot.endTime
    return slot
  })
}

function getArtifact(artifactId: string): WolvesArtifact {
  const artifact = wolvesRelease.artifacts.find(artifact => artifact.id === artifactId)
  if (!artifact) {
    throw new Error(`Missing locked narrative artifact: ${artifactId}`)
  }
  return artifact
}

function getMetadataOrderedPool() {
  const lockedArtifactIds = new Set(lockedNarrativeSlots.map(lock => lock.artifactId))

  return wolvesRelease.artifacts
    .map((artifact, index) => ({ artifact, index }))
    .filter(({ artifact }) => !lockedArtifactIds.has(artifact.id))
    .sort((left, right) => left.artifact.publishedAt.localeCompare(right.artifact.publishedAt) || left.index - right.index)
    .map(({ artifact }) => artifact)
}

function createNarrativeTimeline(): WolvesNarrativeSlot[] {
  const [firstLock, ...fixedLocks] = lockedNarrativeSlots
  if (!firstLock || fixedLocks.length === 0) {
    throw new Error('A starting lock and at least one fixed lock are required')
  }

  const firstArtifact = getArtifact(firstLock.artifactId)
  const pool = getMetadataOrderedPool()
  const windows = fixedLocks.map((lock, index) => {
    if (lock.endTime === undefined) {
      throw new Error(`Locked narrative artifact requires an end time: ${lock.artifactId}`)
    }

    return {
      startTime: index === 0 ? firstLock.startTime : fixedLocks[index - 1].endTime!,
      endTime: lock.startTime,
      lock,
    }
  })

  const timeline: WolvesNarrativeSlot[] = []
  let poolIndex = 0
  let remainingDuration = windows.reduce((sum, window) => sum + window.endTime - window.startTime, 0)

  for (const [index, window] of windows.entries()) {
    const remainingPool = pool.length - poolIndex
    const windowDuration = window.endTime - window.startTime
    const poolCount = index === windows.length - 1
      ? remainingPool
      : Math.round((remainingPool * windowDuration) / remainingDuration)
    const artifacts = pool.slice(poolIndex, poolIndex + poolCount)

    if (index === 0) {
      artifacts.unshift(firstArtifact)
    }

    timeline.push(...createWeightedSlots(artifacts, window.startTime, window.endTime))
    timeline.push({
      artifactId: window.lock.artifactId,
      startTime: window.lock.startTime,
      endTime: window.lock.endTime!,
    })

    poolIndex += poolCount
    remainingDuration -= windowDuration
  }

  return timeline
}

export const wolvesNarrativeTimeline = createNarrativeTimeline()

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
