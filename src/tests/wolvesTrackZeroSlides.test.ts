import { describe, expect, it } from 'vitest'
import {
  bluefinGroupSlides,
  pinJonoBaconAtTrackZeroWindow,
  pinTrackZeroHeroSlides,
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
    const sherman = { id: 'wolves/people/sherman.webp' }
    const m2 = { id: 'wolves/people/m2.jpg' }
    const kyle = { id: 'wolves/people/kyle.jpg' }
    const hikari = { id: 'wolves/people/hikari.JPG' }
    const jorge = { id: 'wolves/people/jorge-bluefin.webp' }
    const before = [{ id: 'people-a' }, marina, hikari, { id: 'people-b' }, m2, jorge, jono, kyle, sherman, { id: 'people-c' }]

    expect(pinTrackZeroHeroSlides(before)).toEqual([
      jono,
      marina,
      sherman,
      m2,
      kyle,
      hikari,
      jorge,
      { id: 'people-a' },
      { id: 'people-b' },
      { id: 'people-c' },
    ])
  })

  it('orders the Bluefin group sherman, m2, kyle, hikari with contiguous windows', () => {
    expect(bluefinGroupSlides.map(slide => slide.id)).toEqual([
      'wolves/people/sherman.webp',
      'wolves/people/m2.jpg',
      'wolves/people/kyle.jpg',
      'wolves/people/hikari.JPG',
      'wolves/people/jorge-bluefin.webp',
    ])
    for (let i = 1; i < bluefinGroupSlides.length; i++) {
      expect(bluefinGroupSlides[i].window.startTime).toBe(bluefinGroupSlides[i - 1].window.endTime)
    }
    expect(bluefinGroupSlides[0].window.startTime).toBe(175.96)
    expect(bluefinGroupSlides[4].window.endTime).toBe(196.36)
  })

  it('keeps an already pinned pair stable and tolerates a missing hero slide', () => {
    const jono = { id: 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp' }
    const marina = { id: 'wolves/people/kubecon-55168684055.webp' }
    const sherman = { id: 'wolves/people/sherman.webp' }
    const m2 = { id: 'wolves/people/m2.jpg' }
    const kyle = { id: 'wolves/people/kyle.jpg' }
    const hikari = { id: 'wolves/people/hikari.JPG' }
    const jorge = { id: 'wolves/people/jorge-bluefin.webp' }
    const regular = { id: 'people-a' }

    expect(pinTrackZeroHeroSlides([jono, marina, sherman, m2, kyle, hikari, jorge, regular]))
      .toEqual([jono, marina, sherman, m2, kyle, hikari, jorge, regular])
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
