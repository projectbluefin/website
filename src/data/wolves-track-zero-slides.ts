export const jonoBaconSlideId = 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp'
export const jonoBaconTrackZeroWindow = {
  startTime: 167.8,
  endTime: 171.88,
} as const

export const marinaMooreSlideId = 'wolves/people/kubecon-55168684055.webp'
export const marinaMooreTrackZeroWindow = {
  startTime: jonoBaconTrackZeroWindow.endTime,
  endTime: 175.96,
} as const

export const shermanSlideId = 'wolves/people/sherman.webp'
export const shermanTrackZeroWindow = {
  startTime: marinaMooreTrackZeroWindow.endTime,
  endTime: 180.04,
} as const

export const m2SlideId = 'wolves/people/m2.jpg'
export const m2TrackZeroWindow = {
  startTime: shermanTrackZeroWindow.endTime,
  endTime: 184.12,
} as const

export const kyleSlideId = 'wolves/people/kyle.jpg'
export const kyleTrackZeroWindow = {
  startTime: m2TrackZeroWindow.endTime,
  endTime: 188.2,
} as const

export const hikariSlideId = 'wolves/people/hikari.JPG'
export const hikariTrackZeroWindow = {
  startTime: kyleTrackZeroWindow.endTime,
  endTime: 192.28,
} as const

export const jorgeBluefinSlideId = 'wolves/people/jorge-bluefin.webp'
export const jorgeBluefinTrackZeroWindow = {
  startTime: hikariTrackZeroWindow.endTime,
  endTime: 196.36,
} as const

/**
 * The Bluefin group: the locked run of Bluefin community photos that plays
 * back-to-back after Marina's window (sherman -> m2 -> kyle -> hikari -> jorge).
 */
export const bluefinGroupSlides = [
  { id: shermanSlideId, window: shermanTrackZeroWindow },
  { id: m2SlideId, window: m2TrackZeroWindow },
  { id: kyleSlideId, window: kyleTrackZeroWindow },
  { id: hikariSlideId, window: hikariTrackZeroWindow },
  { id: jorgeBluefinSlideId, window: jorgeBluefinTrackZeroWindow },
] as const

export const bluefinGroupSlideIds = bluefinGroupSlides.map(slide => slide.id)

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

export function pinTrackZeroHeroSlides<T extends { id: string }>(slides: readonly T[]): T[] {
  const heroSlideIds = [jonoBaconSlideId, marinaMooreSlideId, ...bluefinGroupSlideIds]
  const heroSlides = heroSlideIds
    .map(id => slides.find(slide => slide.id === id))
    .filter((slide): slide is T => slide !== undefined)

  return [
    ...heroSlides,
    ...slides.filter(slide => !heroSlideIds.includes(slide.id)),
  ]
}

// Explicit reservation of ten user-supplied People photos for the fast finale.
export const trackZeroFastFinalePhotoIds: ReadonlySet<string> = new Set([
  'wolves/people/20260709-osc26-distrobox-1.webp',
  'wolves/people/abigailcabunoc30360.web_.webp',
  'wolves/people/amberleighruth_reference.webp',
  'wolves/people/ashleymcnamara35365.webp',
  'wolves/people/dirkhohndel.faces21994.web_.webp',
  'wolves/people/faces.jessiefrazella25358.web_.webp',
  'wolves/people/liz.webp',
  'wolves/people/rikkiendsley28095-2.webp',
  'wolves/people/stormy.faces23764.web_.webp',
  'wolves/people/vmbrasseur.webp',
] as const)

export function splitTrackZeroFastFinaleSlides<T extends { id: string }>(slides: readonly T[]) {
  const finaleSlides = slides.filter(slide => trackZeroFastFinalePhotoIds.has(slide.id))
  const regularSlides = slides.filter(slide => !trackZeroFastFinalePhotoIds.has(slide.id))
  return { regularSlides, finaleSlides }
}
