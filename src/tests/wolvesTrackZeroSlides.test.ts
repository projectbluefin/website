import { describe, expect, it } from 'vitest'
import {
  bluefinGroupSlides,
  jonoBaconSlideId,
  jonoBaconTrackZeroWindow,
  jorgeBluefinSlideId,
  jorgeBluefinTrackZeroWindow,
  hikari2SlideId,
  hikari2TrackZeroWindow,
  hikariSlideId,
  hikariTrackZeroWindow,
  kyleSlideId,
  kyleTrackZeroWindow,
  marinaMooreSlideId,
  marinaMooreTrackZeroWindow,
  pinJonoBaconAtTrackZeroWindow,
  pinTrackZeroHeroSlides,
  shermanM2CompositeSlideId,
  shermanM2CompositeTrackZeroWindow,
  splitTrackZeroFastFinaleSlides,
  trackZeroFastFinalePhotoIds,
} from '../data/wolves-track-zero-slides'

describe('wolves Track 0 slide locks', () => {
  it('moves Jono Bacon to the first People slot without reordering the other slides', () => {
    const jono = { id: 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp' }
    const before = [{ id: 'people-a' }, { id: 'people-b' }, jono, { id: 'people-c' }]

    expect(pinJonoBaconAtTrackZeroWindow(before)).toEqual([
      jono,
      { id: 'people-a' },
      { id: 'people-b' },
      { id: 'people-c' },
    ])
  })

  it('pins Marina Moore and the Bluefin group after Jono Bacon without reordering other slides', () => {
    const jono = { id: 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp' }
    const marina = { id: 'wolves/people/kubecon-55168684055.webp' }
    const shermanM2 = { id: 'wolves/people/sherman-m2.webp' }
    const kyle = { id: 'wolves/people/kyle.jpg' }
    const hikari = { id: 'wolves/people/hikari.JPG' }
    const hikari2 = { id: 'wolves/people/hikari2.JPG' }
    const jorge = { id: 'wolves/people/jorge-bluefin.webp' }
    const before = [{ id: 'people-a' }, marina, hikari, { id: 'people-b' }, jorge, jono, kyle, shermanM2, hikari2, { id: 'people-c' }]

    expect(pinTrackZeroHeroSlides(before)).toEqual([
      jono,
      marina,
      shermanM2,
      kyle,
      hikari,
      hikari2,
      jorge,
      { id: 'people-a' },
      { id: 'people-b' },
      { id: 'people-c' },
    ])
  })

  it('keeps the authored hero locks unique, exact, and contiguous', () => {
    const lockedSlides = [
      { id: jonoBaconSlideId, window: jonoBaconTrackZeroWindow },
      { id: marinaMooreSlideId, window: marinaMooreTrackZeroWindow },
      ...bluefinGroupSlides,
    ]

    expect(lockedSlides.map(slide => slide.id)).toEqual([
      'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp',
      'wolves/people/kubecon-55168684055.webp',
      shermanM2CompositeSlideId,
      kyleSlideId,
      hikariSlideId,
      hikari2SlideId,
      jorgeBluefinSlideId,
    ])
    expect(new Set(lockedSlides.map(slide => slide.id)).size).toBe(lockedSlides.length)
    expect(lockedSlides.map(slide => [slide.window.startTime, slide.window.endTime])).toEqual([
      [167.8, 171.88],
      [171.88, 175.96],
      [175.96, 184.12],
      [184.12, 188.2],
      [188.2, 190.24],
      [190.24, 192.28],
      [192.28, 196.36],
    ])
    for (let i = 1; i < lockedSlides.length; i++) {
      expect(lockedSlides[i].window.startTime).toBe(lockedSlides[i - 1].window.endTime)
    }
  })

  it('orders the Bluefin group sherman+m2, kyle, dual hikari, then jorge', () => {
    expect(bluefinGroupSlides.map(slide => slide.id)).toEqual([
      shermanM2CompositeSlideId,
      kyleSlideId,
      hikariSlideId,
      hikari2SlideId,
      jorgeBluefinSlideId,
    ])
    for (let i = 1; i < bluefinGroupSlides.length; i++) {
      expect(bluefinGroupSlides[i].window.startTime).toBe(bluefinGroupSlides[i - 1].window.endTime)
    }
    expect(bluefinGroupSlides.map(slide => slide.window)).toEqual([
      shermanM2CompositeTrackZeroWindow,
      kyleTrackZeroWindow,
      hikariTrackZeroWindow,
      hikari2TrackZeroWindow,
      jorgeBluefinTrackZeroWindow,
    ])
  })

  it('keeps an already pinned pair stable and tolerates a missing hero slide', () => {
    const jono = { id: 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp' }
    const marina = { id: 'wolves/people/kubecon-55168684055.webp' }
    const shermanM2 = { id: 'wolves/people/sherman-m2.webp' }
    const kyle = { id: 'wolves/people/kyle.jpg' }
    const hikari = { id: 'wolves/people/hikari.JPG' }
    const hikari2 = { id: 'wolves/people/hikari2.JPG' }
    const jorge = { id: 'wolves/people/jorge-bluefin.webp' }
    const regular = { id: 'people-a' }

    expect(pinTrackZeroHeroSlides([jono, marina, shermanM2, kyle, hikari, hikari2, jorge, regular]))
      .toEqual([jono, marina, shermanM2, kyle, hikari, hikari2, jorge, regular])
    expect(pinTrackZeroHeroSlides([marina, regular])).toEqual([marina, regular])
  })

  it('reserves the new people photos for the fast finale without reordering regular slides', () => {
    const newPhoto = { id: 'wolves/people/liz.webp' }
    const regular = [{ id: 'people-a' }, { id: 'people-b' }]
    const { regularSlides, finaleSlides } = splitTrackZeroFastFinaleSlides([
      regular[0],
      newPhoto,
      regular[1],
    ])

    expect(trackZeroFastFinalePhotoIds).toContain(newPhoto.id)
    expect(regularSlides).toEqual(regular)
    expect(finaleSlides).toEqual([newPhoto])
  })
})
