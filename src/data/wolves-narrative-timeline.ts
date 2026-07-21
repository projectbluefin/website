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

export const wolvesNarrativeTimeline: readonly WolvesNarrativeSlot[] = [
  { artifactId: 'arthur-c-clarke-1', startTime: 0, endTime: 14.441591784338897 },
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
  { artifactId: 'lorem-awakening-1', startTime: 220, endTime: 224.399809 },
  { artifactId: 'do-not-reply', startTime: 224.399809, endTime: 228.112018 },
  { artifactId: 'quote-unmarked-grave', startTime: 228.112018, endTime: 231.112018 },
  { artifactId: 'quote-third-disciple', startTime: 231.112018, endTime: 234.143025 },
  { artifactId: 'maintenance-window', startTime: 234.143025, endTime: 238.206856 },
  { artifactId: 'quote-berkus', startTime: 238.206856, endTime: 242.175375 },
  { artifactId: 'lorem-prologue-1', startTime: 242.175375, endTime: 247.594 },
  { artifactId: 'lorem-prologue-2', startTime: 247.594, endTime: 256.03479 },
  { artifactId: 'forbidden-factory', startTime: 256.03479, endTime: 260.308503 },
  { artifactId: 'jordan-adrian', startTime: 260.308503, endTime: 268.224845 },
  { artifactId: 'quote-childhoods-end-future', startTime: 268.224845, endTime: 271.224845 },
  { artifactId: 'quote-natasha-woods', startTime: 271.224845, endTime: 274.224845 },
  { artifactId: 'childhoods-end-wager', startTime: 274.224845, endTime: 279.943353 },
  { artifactId: 'glorious-eggroll', startTime: 279.943353, endTime: 289.203231 },
  { artifactId: 'project-neptune', startTime: 289.203231, endTime: 293.502459 },
  { artifactId: 'john-seager', startTime: 293.502459, endTime: 304.455899 },
  { artifactId: 'laura-sherman-robert', startTime: 310.306754, endTime: 320.150583 },
  { artifactId: 'natali-kat-mario', startTime: 320.150583, endTime: 327.327826 },
  { artifactId: 'fyra-fyre-redactions', startTime: 327.327826, endTime: 331.098499 },
  { artifactId: 'jordan-andy-model', startTime: 331.098499, endTime: 343.923904 },
  { artifactId: 'preethi-lakshmi', startTime: 343.923904, endTime: 354.947016 },
  { artifactId: 'andy-krook-kubesteller', startTime: 354.947016, endTime: 363.339493 },
  { artifactId: 'openssf-reinforcements', startTime: 363.339493, endTime: 373.315756 },
  { artifactId: 'ambers-garage-cloud-native-series', startTime: 373.315756, endTime: 380.400979 },
  { artifactId: 'katie-neomuna', startTime: 380.400979, endTime: 389.243991 },
  { artifactId: 'rafael-bluefin', startTime: 389.243991, endTime: 398 },
  { artifactId: 'blue-universal-acquires-wayland-yutani', startTime: 398, endTime: 425 },
]

export function getNarrativeSlotForTime(time: number): WolvesNarrativeSlot {
  const normalizedTime = Math.max(0, time)
  return wolvesNarrativeTimeline.find(slot => normalizedTime < slot.endTime)
    ?? wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1]
}
