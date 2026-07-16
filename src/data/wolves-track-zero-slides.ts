export const jonoBaconSlideId = 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp'
export const jonoBaconTrackZeroWindow = {
  startTime: 167.8,
  endTime: 171.88,
} as const

/**
 * The first People slot is Jono's fixed 167.8s–171.88s Track 0 window.
 * Keep him first even when generated wallpaper input order changes.
 */
export function pinJonoBaconAtTrackZeroWindow<T extends { id: string }>(slides: readonly T[]): T[] {
  const jonoIndex = slides.findIndex(slide => slide.id === jonoBaconSlideId)
  if (jonoIndex <= 0) {
    return [...slides]
  }

  return [
    slides[jonoIndex],
    ...slides.slice(0, jonoIndex),
    ...slides.slice(jonoIndex + 1),
  ]
}
