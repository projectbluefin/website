export interface WolvesComicHeroShot {
  id: string
  src: string
  label: string
}

// Hand-spread rotation order: the Jorge hero shots bookend the run and no
// character or species repeats back-to-back, so the fast title-card cycle
// never looks like one dinosaur jumping between poses.
export const wolvesComicHeroShots = [
  {
    id: 'youre-holding-it-wrong-post1',
    src: 'characters/Youre_Holding_It_Wrong_Post1.webp',
    label: 'Youre Holding It Wrong Post 1',
  },
  {
    id: 'chonky-achillibator-pose1-post',
    src: 'characters/chonky-achillibator-pose1-post.webp',
    label: 'Chonky Achillibator Pose1 Post',
  },
  {
    id: 'bluefin-original',
    src: 'characters/bluefin_original.webp',
    label: 'Bluefin Original',
  },
  {
    id: 'chonky-dakosaurus-bluefinskin',
    src: 'characters/chonky-dakosaurus-bluefinskin.webp',
    label: 'Chonky Dakosaurus BlueFinSkin',
  },
  {
    id: 'jorge-custom-chonks-kentrosaurus-post1',
    src: 'characters/Jorge_CustomChonks_Kentrosaurus_Post1.webp',
    label: 'Jorge Custom Chonks Kentrosaurus Post1',
  },
  {
    id: 'chonky-dromaeosaurus-bluefin',
    src: 'characters/chonky-dromaeosaurus-bluefin.webp',
    label: 'Chonky Dromaeosaurus Bluefin',
  },
  {
    id: 'dolly',
    src: 'characters/dolly.webp',
    label: 'Dolly',
  },
  {
    id: 'custom-chonk-jorge-concavenator-post1',
    src: 'characters/CustomChonk_Jorge_Concavenator_Post1.webp',
    label: 'Custom Chonk Jorge Concavenator Post1',
  },
  {
    id: 'chonky-utahraptor-bluefinskin',
    src: 'characters/chonky-utahraptor-bluefinskin.webp',
    label: 'Chonky Utahraptor BlueFinSkin',
  },
  {
    id: 'chonky-achillibator-pose2-post',
    src: 'characters/chonky-achillibator-pose2-post.webp',
    label: 'Chonky Achillibator Pose2 Post',
  },
  {
    id: 'deinonychus-antirrhopus-and-achillobator-giganticus',
    src: 'characters/Deinonychus_antirrhopus_and_Achillobator_giganticus.webp',
    label: 'Deinonychus Antirrhopus and Achillobator Giganticus',
  },
  {
    id: 'achillobator',
    src: 'characters/achillobator.webp',
    label: 'Achillobator',
  },
  {
    id: 'angry',
    src: 'characters/angry.webp',
    label: 'Angry',
  },
  {
    id: 'dakota',
    src: 'characters/dakota.webp',
    label: 'Dakota',
  },
  {
    id: 'devs',
    src: 'characters/devs.webp',
    label: 'Devs',
  },
  {
    id: 'intrigued',
    src: 'characters/intrigued.webp',
    label: 'Intrigued',
  },
  {
    id: 'leaping',
    src: 'characters/leaping.webp',
    label: 'Leaping',
  },
  {
    id: 'nest',
    src: 'characters/nest.webp',
    label: 'Nest',
  },
  {
    id: 'pride',
    src: 'characters/pride.webp',
    label: 'Pride',
  },
  {
    id: 'roaring',
    src: 'characters/roaring.webp',
    label: 'Roaring',
  },
  {
    id: 'utah',
    src: 'characters/utah.webp',
    label: 'Utah',
  },
  {
    id: 'jorge-custom-chonks-pivotraptor-post1',
    src: 'characters/Jorge_CustomChonks_PivotRaptor_Post1.webp',
    label: 'Jorge Custom Chonks PivotRaptor Post1',
  },
  {
    id: 'youre-holding-it-wrong2-post2',
    src: 'characters/Youre_Holding_It_Wrong2_Post2.webp',
    label: 'You\'re Holding It Wrong 2 Post 2',
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
