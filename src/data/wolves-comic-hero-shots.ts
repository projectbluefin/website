export interface WolvesComicHeroShot {
  id: string
  src: string
  label: string
  contentFrame: {
    width: number
    left: number
    top: number
  }
}

// Hand-spread rotation order: the Jorge hero shots bookend the run and no
// character or species repeats back-to-back, so the fast title-card cycle
// never looks like one dinosaur jumping between poses.
export const wolvesComicHeroShots = [
  {
    id: 'youre-holding-it-wrong-post1',
    src: 'characters/Youre_Holding_It_Wrong_Post1.webp',
    label: 'Youre Holding It Wrong Post 1',
    contentFrame: { width: 97.01, left: -2.68, top: -0.17 },
  },
  {
    id: 'chonky-achillibator-pose1-post',
    src: 'characters/chonky-achillibator-pose1-post.webp',
    label: 'Chonky Achillibator Pose1 Post',
    contentFrame: { width: 114.74, left: -5.59, top: -3.32 },
  },
  {
    id: 'bluefin',
    src: 'characters/bluefin.webp',
    label: 'Bluefin',
    contentFrame: { width: 93.28, left: 6.44, top: -2.2 },
  },
  {
    id: 'chonky-dakosaurus-bluefinskin',
    src: 'characters/chonky-dakosaurus-bluefinskin.webp',
    label: 'Chonky Dakosaurus BlueFinSkin',
    contentFrame: { width: 103.45, left: 0.34, top: -0.92 },
  },
  {
    id: 'jorge-custom-chonks-kentrosaurus-post1',
    src: 'characters/Jorge_CustomChonks_Kentrosaurus_Post1.webp',
    label: 'Jorge Custom Chonks Kentrosaurus Post1',
    contentFrame: { width: 83.88, left: 6.12, top: 8.22 },
  },
  {
    id: 'chonky-dromaeosaurus-bluefin',
    src: 'characters/chonky-dromaeosaurus-bluefin.webp',
    label: 'Chonky Dromaeosaurus Bluefin',
    contentFrame: { width: 98.5, left: -4.83, top: -1.52 },
  },
  {
    id: 'dolly',
    src: 'characters/dolly.webp',
    label: 'Dolly',
    contentFrame: { width: 110.42, left: -3.38, top: 1.48 },
  },
  {
    id: 'custom-chonk-jorge-concavenator-post1',
    src: 'characters/CustomChonk_Jorge_Concavenator_Post1.webp',
    label: 'Custom Chonk Jorge Concavenator Post1',
    contentFrame: { width: 87.65, left: 7.57, top: -0.83 },
  },
  {
    id: 'chonky-utahraptor-bluefinskin',
    src: 'characters/chonky-utahraptor-bluefinskin.webp',
    label: 'Chonky Utahraptor BlueFinSkin',
    contentFrame: { width: 86.64, left: 6.77, top: 3.6 },
  },
  {
    id: 'chonky-achillibator-pose2-post',
    src: 'characters/chonky-achillibator-pose2-post.webp',
    label: 'Chonky Achillibator Pose2 Post',
    contentFrame: { width: 93.93, left: 4.73, top: 4.23 },
  },
  {
    id: 'deinonychus-antirrhopus-and-achillobator-giganticus',
    src: 'characters/Deinonychus_antirrhopus_and_Achillobator_giganticus.webp',
    label: 'Deinonychus Antirrhopus and Achillobator Giganticus',
    contentFrame: { width: 83.01, left: 7.85, top: 9.39 },
  },
  {
    id: 'achillobator',
    src: 'characters/achillobator.webp',
    label: 'Achillobator',
    contentFrame: { width: 78.92, left: 10.45, top: 9.46 },
  },
  {
    id: 'angry',
    src: 'characters/angry.webp',
    label: 'Angry',
    contentFrame: { width: 80, left: 10, top: 23.67 },
  },
  {
    id: 'dakota',
    src: 'characters/dakota.webp',
    label: 'Dakota',
    contentFrame: { width: 80.37, left: 9.82, top: 19.22 },
  },
  {
    id: 'karl',
    src: 'characters/karl.webp',
    label: 'Karl',
    contentFrame: { width: 106.67, left: -5, top: -0.42 },
  },
  {
    id: 'intrigued',
    src: 'characters/intrigued.webp',
    label: 'Intrigued',
    contentFrame: { width: 80, left: 10, top: 10.58 },
  },
  {
    id: 'leaping',
    src: 'characters/leaping.webp',
    label: 'Leaping',
    contentFrame: { width: 80, left: 10, top: 15.71 },
  },
  {
    id: 'nest',
    src: 'characters/nest.webp',
    label: 'Nest',
    contentFrame: { width: 93.32, left: 5.61, top: -0.87 },
  },
  {
    id: 'pride',
    src: 'characters/pride.webp',
    label: 'Pride',
    contentFrame: { width: 80.44, left: 10, top: 25.35 },
  },
  {
    id: 'roaring',
    src: 'characters/roaring.webp',
    label: 'Roaring',
    contentFrame: { width: 75.88, left: 11.72, top: 9.59 },
  },
  {
    id: 'utah',
    src: 'characters/utah.webp',
    label: 'Utah',
    contentFrame: { width: 80.55, left: 9.63, top: 23.36 },
  },
  {
    id: 'jorge-custom-chonks-pivotraptor-post1',
    src: 'characters/Jorge_CustomChonks_PivotRaptor_Post1.webp',
    label: 'Jorge Custom Chonks PivotRaptor Post1',
    contentFrame: { width: 104.2, left: 1.16, top: -2.1 },
  },
  {
    id: 'youre-holding-it-wrong2-post2',
    src: 'characters/Youre_Holding_It_Wrong2_Post2.webp',
    label: 'You\'re Holding It Wrong 2 Post 2',
    contentFrame: { width: 80.03, left: 10, top: 15.5 },
  },
] as const satisfies readonly WolvesComicHeroShot[]

export function getComicHeroShotIndex(
  currentTime: number,
  startTime: number,
  endTime: number,
  shotCount: number,
): number {
  if (shotCount <= 0 || endTime <= startTime || currentTime < startTime || currentTime >= endTime) {
    return -1
  }

  const duration = endTime - startTime
  const slotDuration = duration / shotCount
  const elapsed = Math.min(currentTime - startTime, duration - Number.EPSILON)
  return Math.min(shotCount - 1, Math.floor(elapsed / slotDuration))
}

export function getActiveComicHeroShot(
  currentTime: number,
  cue: { start: number, end: number },
  shots: readonly WolvesComicHeroShot[] = wolvesComicHeroShots,
): WolvesComicHeroShot | undefined {
  const index = getComicHeroShotIndex(currentTime, cue.start, cue.end, shots.length)
  return index === -1 ? undefined : shots[index]
}
