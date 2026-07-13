import { wolvesRelease } from './wolves-story'

export interface WolvesNarrativeSlot {
  artifactId: string
  startTime: number
  endTime: number
}

const MIDDLE_ARTIFACT_INDEX = 9
const FINAL_ARTIFACT_INDEX = wolvesRelease.artifacts.length - 1
const MIDDLE_START_TIME = 180
const MIDDLE_END_TIME = 220
const FINAL_START_TIME = 398
const TRACK_END_TIME = 425

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

export const wolvesNarrativeTimeline: WolvesNarrativeSlot[] = [
  ...createWeightedSlots(0, MIDDLE_ARTIFACT_INDEX, 0, MIDDLE_START_TIME),
  {
    artifactId: wolvesRelease.artifacts[MIDDLE_ARTIFACT_INDEX].id,
    startTime: MIDDLE_START_TIME,
    endTime: MIDDLE_END_TIME,
  },
  ...createWeightedSlots(MIDDLE_ARTIFACT_INDEX + 1, FINAL_ARTIFACT_INDEX, MIDDLE_END_TIME, FINAL_START_TIME),
  {
    artifactId: wolvesRelease.artifacts[FINAL_ARTIFACT_INDEX].id,
    startTime: FINAL_START_TIME,
    endTime: TRACK_END_TIME,
  },
]

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
