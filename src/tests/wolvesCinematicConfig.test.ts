import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_SEGMENTS,
  DEFAULT_CROSSFADE_MS,
  PRE_END_THRESHOLD_S,
  segmentCrossfadeMs,
} from '@/config/wolves-cinematic'

describe('wolves cinematic config', () => {
  it('defines the seven musical parts with 7 Days first', () => {
    expect(CINEMATIC_SEGMENTS).toHaveLength(7)
    expect(CINEMATIC_SEGMENTS[0].title).toBe('7 Days to the Wolves')
    expect(CINEMATIC_SEGMENTS[0].chapter).toBe('PART I')
  })

  it('mounts the seven-days immersive experience only on the 7 Days segment', () => {
    const flagged = CINEMATIC_SEGMENTS.filter(segment => segment.trackZeroExperience)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].youtubeId).toBe('LASru9j0oIc')
  })

  it('has unique, well-formed YouTube ids and complete metadata', () => {
    const ids = new Set<string>()
    for (const segment of CINEMATIC_SEGMENTS) {
      expect(segment.youtubeId).toMatch(/^[\w-]{11}$/)
      expect(segment.chapter.length).toBeGreaterThan(0)
      expect(segment.title.length).toBeGreaterThan(0)
      expect(segment.artist.length).toBeGreaterThan(0)
      expect(segment.artwork.length).toBeGreaterThan(0)
      ids.add(segment.youtubeId)
    }
    expect(ids.size).toBe(CINEMATIC_SEGMENTS.length)
  })

  it('has a unique stable id for every segment', () => {
    expect(new Set(CINEMATIC_SEGMENTS.map(segment => segment.id)).size)
      .toBe(CINEMATIC_SEGMENTS.length)
  })

  it('resolves per-segment crossfades with a default fallback', () => {
    expect(segmentCrossfadeMs(0)).toBe(DEFAULT_CROSSFADE_MS)
    expect(segmentCrossfadeMs(1)).toBe(1500)
    expect(segmentCrossfadeMs(999)).toBe(DEFAULT_CROSSFADE_MS)
  })

  it('keeps the pre-end threshold small enough to not cut content', () => {
    expect(PRE_END_THRESHOLD_S).toBeGreaterThan(0)
    expect(PRE_END_THRESHOLD_S).toBeLessThan(1)
  })

  it('assigns the exact authored deployment chat to the first five transitions and keeps the sixth on default terminal fallback', () => {
    expect(CINEMATIC_SEGMENTS[1].transitionLore).toEqual([
      { kind: 'speaker', speaker: 'krook', text: 'Ok let\'s do this one by the books, intel in your feeds. Remember, prioritize all Maintainer-Guardian workflows, they\'re depending on us.' },
      { kind: 'speaker', speaker: 'sabot-6', text: 'Practioner-Guardian efficiency is — what? Seven percent? That\'s —' },
      { kind: 'speaker', speaker: 'jeefy', text: 'Detroit Lions numbers kids —' },
      { kind: 'speaker', speaker: 'mrbobbytables', text: 'I told you it wasn\'t going to work, with 7 reference architectures, seven percent. I know you didn\'t read the docs don\'t bother slopping your way out of this one' },
      { kind: 'speaker', speaker: 'nate', text: 'About that —' },
    ])

    expect(CINEMATIC_SEGMENTS[2].transitionLore).toEqual([
      { kind: 'speaker', speaker: 'krook', text: 'ok tighten it up folks, ihor bring her in low —' },
      { kind: 'speaker', speaker: 'ihord', text: 'locked in the pipe, five by five — good hunting —' },
    ])

    expect(CINEMATIC_SEGMENTS[3].transitionLore).toEqual([
      { kind: 'speaker', speaker: 'krook', text: 'Well done team, next group of Guardians needs help, line em up, resources are low and we don\'t want any' },
      { kind: 'static', text: '-- static --', effect: 'static' },
      { kind: 'speaker', speaker: 'K', text: 'Hello boys, about time you showed up, link up.' },
      { kind: 'speaker', speaker: 'sabot-6', text: 'Oh yay adult supervision' },
      { kind: 'speaker', speaker: 'krook', text: 'damnit jorge we talked about this' },
      { kind: 'speaker', speaker: 'K', text: 'Keep up kids you\'re down three minutes, you\'re not going to keep up with basic maturity guidelines, and you know what they say, trust but verify.' },
      { kind: 'speaker', speaker: 'Carl George (Royal Guard)', text: 'I love it when you tell them that, how ya been eltee do you miss me I\'ve been promoted! Love coming into town to farm with the basics.' },
      { kind: 'speaker', speaker: 'Emily Fox (Royal Guard)', text: 'Especially the angry one look how mad he gets. He left the entire security booster kit unread, metrics don\'t lie, you owe me twenty bucks' },
    ])

    expect(CINEMATIC_SEGMENTS[4].transitionLore).toEqual([
      { kind: 'speaker', speaker: 'Karena', text: 'Insertion approved, good hunting' },
      { kind: 'speaker', speaker: 'Krook', text: 'Inbound in twelve' },
      { kind: 'speaker', speaker: 'jeefy', text: 'See ya down there.' },
      { kind: 'cue', text: '* knock the pod door *' },
      { kind: 'sfx', text: '[Use one dramatic metal bulkhead knock here.]', effect: 'bulkhead-knock' },
      { kind: 'speaker', speaker: 'sabot-6' },
      { kind: 'sfx', text: '* knock * * knock *', effect: 'bulkhead-response' },
      { kind: 'cue', text: '[Use two dramatic metal bulkhead knocks here.]' },
    ])

    expect(CINEMATIC_SEGMENTS[5].transitionLore).toEqual([
      { kind: 'speaker', speaker: 'angie', text: 'AAIF-7 on the net, someone need guidance?' },
      { kind: 'speaker', speaker: 'stacyp', text: 'SSF-7 here, howdy folks, deploying SIVA Nanites. For you New Lights that\'s our OpenSSF standard deployment kit for Guardians. Security - Inventory - Verification - Attestation) Nanites, but people say Asskicking for the A.' },
      { kind: 'speaker', speaker: 'krook', text: 'Oh yeah and I called for reinforcements' },
      { kind: 'speaker', speaker: 'natali', text: 'They put Asskicking in the brand name? Great marketing. Oh and look. Hey look everyone, their docs are spectacular. What did I tell you about good taste. This story just writes itself.' },
      { kind: 'speaker', speaker: 'AN4-ChK-12', text: 'Blue Universal recommendation, sell ad space on your fists.' },
      { kind: 'speaker', speaker: 'kat', text: 'maybe we should keep it around and then just punch it when it eventually hallucinates.' },
      { kind: 'speaker', speaker: 'AN4-ChK-12', text: 'Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes!' },
      { kind: 'sfx', text: '*** explosion sound', effect: 'explosion' },
    ])

    expect(CINEMATIC_SEGMENTS[6].transitionLore).toBeUndefined()
  })
})
