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

export const shermanM2CompositeSlideId = 'wolves/people/sherman-m2.webp'
export const shermanM2CompositeTrackZeroWindow = {
  startTime: marinaMooreTrackZeroWindow.endTime,
  endTime: 184.12,
} as const

export const kyleSlideId = 'wolves/people/kyle.jpg'
export const kyleTrackZeroWindow = {
  startTime: shermanM2CompositeTrackZeroWindow.endTime,
  endTime: 188.2,
} as const

export const hikariSlideId = 'wolves/people/hikari.JPG'
export const hikariTrackZeroWindow = {
  startTime: kyleTrackZeroWindow.endTime,
  endTime: 190.24,
} as const

export const hikari2SlideId = 'wolves/people/hikari2.JPG'
export const hikari2TrackZeroWindow = {
  startTime: hikariTrackZeroWindow.endTime,
  endTime: 192.28,
} as const

export const jorgeBluefinSlideId = 'wolves/people/jorge-bluefin.webp'
export const jorgeBluefinTrackZeroWindow = {
  startTime: hikari2TrackZeroWindow.endTime,
  endTime: 196.36,
} as const

/**
 * The Bluefin group: the locked run of Bluefin community photos that plays
 * back-to-back after Marina's window (Sherman + m2 composite -> kyle -> Hikari -> Hikari2 -> Jorge).
 */
export const bluefinGroupSlides = [
  { id: shermanM2CompositeSlideId, window: shermanM2CompositeTrackZeroWindow },
  { id: kyleSlideId, window: kyleTrackZeroWindow },
  { id: hikariSlideId, window: hikariTrackZeroWindow },
  { id: hikari2SlideId, window: hikari2TrackZeroWindow },
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

/**
 * Locked opening run of the post-hero People stretch (starts right after the
 * Bluefin group hands off at 196.36s): Walters -> Tophee -> Kirkland ->
 * 0R0A9083 -> Daily Highlights 052, back-to-back in this exact order.
 */
export const postHeroOpeningSequenceIds = [
  'wolves/people/walters.JPG',
  'wolves/people/flickr-54137782365.webp',
  'wolves/people/kirkland.webp',
  'wolves/people/flickr-55343975781.webp',
  'wolves/people/kubecon-55168545279.webp',
] as const

/**
 * Moves the post-hero opening sequence to the front of the People pool in its
 * locked order, keeping every other slide in the given order. Missing members
 * are skipped so pool drift cannot break the schedule.
 */
export function pinTrackZeroPostHeroOpening<T extends { id: string }>(slides: readonly T[]): T[] {
  const sequenceIds: readonly string[] = postHeroOpeningSequenceIds
  const openingSlides = sequenceIds
    .map(id => slides.find(slide => slide.id === id))
    .filter((slide): slide is T => slide !== undefined)

  return [
    ...openingSlides,
    ...slides.filter(slide => !sequenceIds.includes(slide.id)),
  ]
}

/**
 * The Suncatcher showcase slide is locked to a fixed slot in the Track 0
 * showcase rotation. Index 25 in the seeded showcase shuffle is the
 * established fourth slide of the Heavy Chorus 1 stretch, so the pin preserves
 * that placement as the wallpaper pool grows or shrinks.
 */
export const lockedShowcaseSlideId = 'wolves/showcase/suncatcher.png'
export const lockedShowcaseTrackZeroIndex = 25
/** @deprecated Use the locked showcase names above. */
export const bluefinMicroraptorSlideId = lockedShowcaseSlideId
/** @deprecated Use the locked showcase names above. */
export const bluefinMicroraptorTrackZeroIndex = lockedShowcaseTrackZeroIndex

/**
 * Moves the locked showcase slide to its fixed index in the shuffled
 * showcase pool, keeping every other slide in the given order. A missing
 * slide is skipped so pool drift cannot break the schedule.
 */
export function pinLockedShowcaseSlide<T extends { id: string }>(slides: readonly T[]): T[] {
  const lockedIndex = slides.findIndex(slide => slide.id === lockedShowcaseSlideId)
  if (lockedIndex === -1) {
    return [...slides]
  }

  const rest = slides.filter((_, index) => index !== lockedIndex)
  const insertionIndex = Math.min(lockedShowcaseTrackZeroIndex, rest.length)
  return [
    ...rest.slice(0, insertionIndex),
    slides[lockedIndex],
    ...rest.slice(insertionIndex),
  ]
}

/** @deprecated Use pinLockedShowcaseSlide. */
export const pinBluefinMicroraptorSlide = pinLockedShowcaseSlide

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
