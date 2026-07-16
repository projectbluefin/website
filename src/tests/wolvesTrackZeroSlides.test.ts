import { describe, expect, it } from 'vitest'
import { pinJonoBaconAtTrackZeroWindow } from '../data/wolves-track-zero-slides'

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
})
