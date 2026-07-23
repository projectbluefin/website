import { loadAllLoreRecords } from './wolves-lore-records'
import { wolvesRelease } from './wolves-story'
import { allocateLoreSlots } from './wolves-lore-timing'

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
  { artifactId: 'arthur-c-clarke-1', startTime: 0 },
  { artifactId: 'lorem-pursuit-1', startTime: 150, endTime: 220 },
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]

const authoredArtifactIds = wolvesRelease.artifacts.map(artifact => artifact.id)
const recordsById = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))
function timingInput(id: string) {
  const record = recordsById.get(id)
  return {
    id,
    kind: record?.kind === 'chatlog' ? 'chatlog' as const : 'quote' as const,
    body: record?.body ?? id,
    attribution: record?.metadata.attribution ?? record?.metadata.sender,
  }
}
function allocateRange(ids: readonly string[], startTime: number, endTime: number): WolvesNarrativeSlot[] {
  return allocateLoreSlots(ids.map(timingInput), startTime, endTime).map(slot => ({ artifactId: slot.id, startTime: slot.startTime, endTime: slot.endTime }))
}
const pursuitIndex = authoredArtifactIds.indexOf('lorem-pursuit-1')
const finalIndex = authoredArtifactIds.indexOf('blue-universal-acquires-wayland-yutani')
const opening = authoredArtifactIds.slice(0, pursuitIndex).filter(id => id !== 'arthur-c-clarke-1')
const middle = authoredArtifactIds.slice(pursuitIndex + 1, finalIndex)
export const wolvesNarrativeTimeline: readonly WolvesNarrativeSlot[] = [
  { artifactId: 'arthur-c-clarke-1', startTime: 0, endTime: 14.441591784338897 },
  ...allocateRange(opening, 14.441591784338897, 150),
  { artifactId: 'lorem-pursuit-1', startTime: 150, endTime: 220 },
  ...allocateRange(middle, 220, 398),
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]


export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
