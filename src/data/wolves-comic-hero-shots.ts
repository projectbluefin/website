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
