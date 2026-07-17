export interface WolvesComicHeroShot {
  id: string
  src: string
  label: string
}

export const wolvesComicHeroShots = [
  {
    id: 'chonky-achillibator-pose1-post',
    src: 'characters/chonky-achillibator-pose1-post.webp',
    label: 'Chonky Achillibator Pose1 Post',
  },
  {
    id: 'chonky-achillibator-pose2-post',
    src: 'characters/chonky-achillibator-pose2-post.webp',
    label: 'Chonky Achillibator Pose2 Post',
  },
  {
    id: 'chonky-alamo-blue',
    src: 'characters/chonky-alamo-blue.webp',
    label: 'Chonky Alamo Blue',
  },
  {
    id: 'chonky-alamo-vector',
    src: 'characters/chonky-alamo-vector.webp',
    label: 'Chonky Alamo Vector',
  },
  {
    id: 'chonky-dakosaurus-bluefinskin',
    src: 'characters/chonky-dakosaurus-bluefinskin.webp',
    label: 'Chonky Dakosaurus BlueFinSkin',
  },
  {
    id: 'chonky-dromaeosaurus-bluefin',
    src: 'characters/chonky-dromaeosaurus-bluefin.webp',
    label: 'Chonky Dromaeosaurus Bluefin',
  },
  {
    id: 'bob-torosaurus',
    src: 'characters/bob-torosaurus.webp',
    label: 'Bob Torosaurus',
  },
  {
    id: 'kaslin-torosaurus',
    src: 'characters/kaslin-torosaurus.webp',
    label: 'Kaslin Torosaurus',
  },
  {
    id: 'chonky-utahraptor-bluefinskin',
    src: 'characters/chonky-utahraptor-bluefinskin.webp',
    label: 'Chonky Utahraptor BlueFinSkin',
  },
  {
    id: 'custom-chonk-jorge-concavenator-post1',
    src: 'characters/CustomChonk_Jorge_Concavenator_Post1.webp',
    label: 'Custom Chonk Jorge Concavenator Post1',
  },
  {
    id: 'deinonychus-antirrhopus-and-achillobator-giganticus',
    src: 'characters/Deinonychus_antirrhopus_and_Achillobator_giganticus.webp',
    label: 'Deinonychus Antirrhopus and Achillobator Giganticus',
  },
  {
    id: 'jorge-custom-chonks-intrigued',
    src: 'characters/Jorge_CustomChonks_Intrigued.webp',
    label: 'Jorge Custom Chonks Intrigued',
  },
  {
    id: 'jorge-custom-chonks-kentrosaurus-post1',
    src: 'characters/Jorge_CustomChonks_Kentrosaurus_Post1.webp',
    label: 'Jorge Custom Chonks Kentrosaurus Post1',
  },
  {
    id: 'jorge-custom-chonks-leaping',
    src: 'characters/Jorge_CustomChonks_Leaping.webp',
    label: 'Jorge Custom Chonks Leaping',
  },
  {
    id: 'jorge-custom-chonks-pivotraptor-blmblackgold-post',
    src: 'characters/Jorge_CustomChonks_PivotRaptor_BLMBlackGold_Post.webp',
    label: 'Jorge Custom Chonks PivotRaptor BLM Black Gold Post',
  },
  {
    id: 'youre-holding-it-wrong2-post2',
    src: 'characters/Youre_Holding_It_Wrong2_Post2.webp',
    label: 'You\'re Holding It Wrong 2 Post 2',
  },
  {
    id: 'youre-holding-it-wrong-post1',
    src: 'characters/Youre_Holding_It_Wrong_Post1.webp',
    label: 'Youre Holding It Wrong Post 1',
  },
  {
    id: 'bluefin-nesting',
    src: 'characters/bluefin_nesting.webp',
    label: 'Bluefin Nesting',
  },
  {
    id: 'bluefin-original',
    src: 'characters/bluefin_original.webp',
    label: 'Bluefin Original',
  },
  {
    id: 'bluefin-pride',
    src: 'characters/bluefin_pride.webp',
    label: 'Bluefin Pride',
  },
  {
    id: 'dolly',
    src: 'characters/dolly.webp',
    label: 'Dolly',
  },
  {
    id: 'karl',
    src: 'characters/karl.webp',
    label: 'Karl',
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
