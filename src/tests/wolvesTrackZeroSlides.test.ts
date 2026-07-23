import { describe, expect, it } from 'vitest'
import {
  bluefinGroupSlides,
  bluefinMicroraptorSlideId,
  bluefinMicroraptorTrackZeroIndex,
  hikari2SlideId,
  hikari2TrackZeroWindow,
  hikariSlideId,
  hikariTrackZeroWindow,
  jonoBaconSlideId,
  jonoBaconTrackZeroWindow,
  jorgeBluefinSlideId,
  jorgeBluefinTrackZeroWindow,
  kyleSlideId,
  kyleTrackZeroWindow,
  marinaMooreSlideId,
  marinaMooreTrackZeroWindow,
  pinBluefinMicroraptorSlide,
  pinJonoBaconAtTrackZeroWindow,
  pinTrackZeroHeroSlides,
  pinTrackZeroPostHeroOpening,
  postHeroOpeningSequenceIds,
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
    const kyle = { id: 'wolves/people/NOT John Bazzite.jpg' }
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
    const kyle = { id: 'wolves/people/NOT John Bazzite.jpg' }
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

  it('locks the post-hero opening run in order: walters, tophee, kirkland, 0R0A9083, 052', () => {
    expect(postHeroOpeningSequenceIds).toEqual([
      'wolves/people/walters.JPG',
      'wolves/people/flickr-54137782365.webp',
      'wolves/people/kirkland.webp',
      'wolves/people/flickr-55343975781.webp',
      'wolves/people/kubecon-55168545279.webp',
    ])

    const sequence = postHeroOpeningSequenceIds.map(id => ({ id }))
    const scrambled = [
      { id: 'people-a' },
      sequence[3],
      sequence[0],
      { id: 'people-b' },
      sequence[4],
      sequence[1],
      sequence[2],
    ]

    expect(pinTrackZeroPostHeroOpening(scrambled)).toEqual([
      ...sequence,
      { id: 'people-a' },
      { id: 'people-b' },
    ])
  })

  it('skips missing post-hero opening members without breaking the pool', () => {
    const walters = { id: 'wolves/people/walters.JPG' }
    const regular = { id: 'people-a' }

    expect(pinTrackZeroPostHeroOpening([regular, walters])).toEqual([walters, regular])
    expect(pinTrackZeroPostHeroOpening([regular])).toEqual([regular])
  })

  it('locks the Bluefin Microraptor to its fixed showcase slot regardless of shuffle order', () => {
    const microraptor = { id: bluefinMicroraptorSlideId }
    const pool = Array.from({ length: 34 }, (_, index) => ({ id: `showcase-${index}` }))

    const fromFront = pinBluefinMicroraptorSlide([microraptor, ...pool])
    expect(fromFront[bluefinMicroraptorTrackZeroIndex]).toEqual(microraptor)
    expect(fromFront.filter(slide => slide.id === bluefinMicroraptorSlideId)).toHaveLength(1)

    const fromBack = pinBluefinMicroraptorSlide([...pool, microraptor])
    expect(fromBack[bluefinMicroraptorTrackZeroIndex]).toEqual(microraptor)
    // Every other slide keeps its relative order.
    expect(fromBack.filter(slide => slide.id !== bluefinMicroraptorSlideId)).toEqual(pool)
  })

  it('clamps the Microraptor lock into small pools and skips it when the slide is missing', () => {
    const microraptor = { id: bluefinMicroraptorSlideId }
    const small = [{ id: 'showcase-a' }, microraptor, { id: 'showcase-b' }]

    const pinnedSmall = pinBluefinMicroraptorSlide(small)
    expect(pinnedSmall[pinnedSmall.length - 1]).toEqual(microraptor)
    expect(pinBluefinMicroraptorSlide([{ id: 'showcase-a' }])).toEqual([{ id: 'showcase-a' }])
  })
})
