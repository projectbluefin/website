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
  { artifactId: 'lorem-pursuit-1', startTime: 180, endTime: 220 },
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]

function createWeightedSlots(startIndex: number, endIndex: number, startTime: number, endTime: number) {
  const artifacts = wolvesRelease.artifacts.slice(startIndex, endIndex)
  const totalWeight = artifacts.reduce((sum, artifact) => sum + Math.max(artifact.body.length, 1), 0)
  let currentTime = startTime

  return artifacts.map((artifact, index) => {
    const isLast = index === artifacts.length - 1
    const duration = isLast
      ? endTime - currentTime
      : ((endTime - startTime) * Math.max(artifact.body.length, 1)) / totalWeight
    const slot = { artifactId: artifact.id, startTime: currentTime, endTime: currentTime + duration }
    currentTime = slot.endTime
    return slot
  })
}

function getArtifactIndex(artifactId: string): number {
  const index = wolvesRelease.artifacts.findIndex(artifact => artifact.id === artifactId)
  if (index === -1) {
    throw new Error(`Missing locked narrative artifact: ${artifactId}`)
  }
  return index
}

function createNarrativeTimeline(): WolvesNarrativeSlot[] {
  const [firstLock, ...fixedLocks] = lockedNarrativeSlots
  if (!firstLock) {
    throw new Error('At least one narrative lock is required')
  }

  const timeline: WolvesNarrativeSlot[] = []
  let startIndex = getArtifactIndex(firstLock.artifactId)
  let startTime = firstLock.startTime

  for (const lock of fixedLocks) {
    if (lock.endTime === undefined) {
      throw new Error(`Locked narrative artifact requires an end time: ${lock.artifactId}`)
    }

    const lockIndex = getArtifactIndex(lock.artifactId)
    timeline.push(...createWeightedSlots(startIndex, lockIndex, startTime, lock.startTime))
    timeline.push({
      artifactId: lock.artifactId,
      startTime: lock.startTime,
      endTime: lock.endTime,
    })
    startIndex = lockIndex + 1
    startTime = lock.endTime
  }

  return timeline
}

export const wolvesNarrativeTimeline = createNarrativeTimeline()

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
