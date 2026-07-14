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

export const wolvesNarrativeTimeline: readonly WolvesNarrativeSlot[] = [
  { artifactId: 'arthur-c-clarke-4', startTime: 0, endTime: 5.680359435173299 },
  { artifactId: 'arthur-c-clarke-1', startTime: 5.680359435173299, endTime: 14.441591784338897 },
  { artifactId: 'arthur-c-clarke-2', startTime: 14.441591784338897, endTime: 25.41720154043646 },
  { artifactId: 'arthur-c-clarke-3', startTime: 25.41720154043646, endTime: 29.043645699614892 },
  { artifactId: 'ishtar-gardener-and-winnower', startTime: 29.043645699614892, endTime: 36.55327342747112 },
  { artifactId: 'ishtar-flower-game', startTime: 36.55327342747112, endTime: 49.229781771501926 },
  { artifactId: 'ishtar-first-knife', startTime: 49.229781771501926, endTime: 62.51604621309371 },
  { artifactId: 'ishtar-the-wager', startTime: 62.51604621309371, endTime: 77.37483953786906 },
  { artifactId: 'reckoning-of-the-three', startTime: 77.37483953786906, endTime: 85.26957637997432 },
  { artifactId: 'ishtar-patternfall', startTime: 85.26957637997432, endTime: 101.18741976893453 },
  { artifactId: 'committee-report-personal-transmission', startTime: 101.18741976893453, endTime: 109.59563543003851 },
  { artifactId: 'ishtar-cambrian-explosion', startTime: 109.59563543003851, endTime: 124.93581514762516 },
  { artifactId: 'john-bazzite-interview', startTime: 124.93581514762516, endTime: 136.8100128369705 },
  { artifactId: 'ishtar-final-shape', startTime: 136.8100128369705, endTime: 150 },
  { artifactId: 'lorem-pursuit-1', startTime: 150, endTime: 220 },
  { artifactId: 'lorem-awakening-1', startTime: 220, endTime: 226.50144449030128 },
  { artifactId: 'do-not-reply', startTime: 226.50144449030128, endTime: 231.1295914156005 },
  { artifactId: 'quote-unmarked-grave', startTime: 231.1295914156005, endTime: 233.18654560462235 },
  { artifactId: 'quote-third-disciple', startTime: 233.18654560462235, endTime: 236.27197688815517 },
  { artifactId: 'maintenance-window', startTime: 236.27197688815517, endTime: 241.81840693355343 },
  { artifactId: 'quote-berkus', startTime: 241.81840693355343, endTime: 247.10771770532398 },
  { artifactId: 'lorem-prologue-1', startTime: 247.10771770532398, endTime: 256.58439950474616 },
  { artifactId: 'lorem-prologue-2', startTime: 256.58439950474616, endTime: 281.1209244737928 },
  { artifactId: 'forbidden-factory', startTime: 281.1209244737928, endTime: 287.25505571605447 },
  { artifactId: 'jordan-adrian', startTime: 287.25505571605447, endTime: 308.30210482872474 },
  { artifactId: 'quote-childhoods-end-future', startTime: 308.30210482872474, endTime: 309.55096987205945 },
  { artifactId: 'quote-natasha-woods', startTime: 309.55096987205945, endTime: 311.68138671068925 },
  { artifactId: 'childhoods-end-wager', startTime: 311.68138671068925, endTime: 322.6640528270739 },
  { artifactId: 'glorious-eggroll', startTime: 322.6640528270739, endTime: 351.49814279818406 },
  { artifactId: 'project-neptune', startTime: 351.49814279818406, endTime: 357.70573669005364 },
  { artifactId: 'john-seager', startTime: 357.70573669005364, endTime: 398 },
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
