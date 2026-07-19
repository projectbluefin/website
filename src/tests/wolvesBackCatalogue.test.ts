import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import { parseBackCatalogue } from '@/config/experience-manifest'
import { resolveOverallRatioTarget, useCinematicStore, WOLVES_EXPERIENCE } from '@/stores/cinematic'
// @ts-expect-error script module is intentionally plain Node ESM
import * as catalogueGenerator from '../../scripts/update-back-catalogue.js'

const { buildExperience, buildSegments, cleanArtist, cleanTitle, stripArtistPrefix } = catalogueGenerator as typeof catalogueGenerator & {
  cleanArtist: (value: string) => string
  cleanTitle: (value: string) => string
  stripArtistPrefix: (title: string, artist: string) => string
}

const ALBUM = {
  id: 'test-album',
  title: 'Test Album',
  artwork: 'experiences/test-album.jpg',
  segments: [
    { id: 'v1', kind: 'youtube' as const, youtubeId: 'v1', chapter: 'TRACK 1', title: 'One', artist: 'A', artwork: 'x.jpg', durationSeconds: 100 },
    { id: 'v2', kind: 'youtube' as const, youtubeId: 'v2', chapter: 'TRACK 2', title: 'Two', artist: 'B', artwork: 'y.jpg', durationSeconds: 200 },
  ],
}

describe('back catalogue experiences', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // Module-level timeline state persists across tests; restore the default.
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
    vi.unstubAllGlobals()
  })

  it('loads an album manifest into the shared cinematic runtime', () => {
    const store = useCinematicStore()
    store.loadExperience(ALBUM)

    expect(store.phase).toBe('lobby')
    expect(store.segmentCount).toBe(2)
    expect(store.segment.youtubeId).toBe('v1')

    store.enterCinematic()
    expect(store.segmentDuration).toBe(100)
    expect(store.overallDuration).toBe(300)

    // No authored intro for albums: ratio seeks map straight into the segments.
    expect(resolveOverallRatioTarget(0)).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: 0,
    }))
    expect(resolveOverallRatioTarget(150 / 300)).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: 1,
      segmentElapsed: 50,
    }))
  })

  it('restores the wolves experience with its intro timeline', () => {
    const store = useCinematicStore()
    store.loadExperience(ALBUM)
    store.loadExperience(WOLVES_EXPERIENCE)
    expect(store.segmentCount).toBe(6)
    expect(resolveOverallRatioTarget(0).phase).toBe('intro')
  })

  it('validates catalogue JSON at the fetch boundary', () => {
    expect(() => parseBackCatalogue({})).toThrow('experiences array')
    expect(() => parseBackCatalogue({ experiences: [{ id: 'x' }] })).toThrow('bad experience entry')
    expect(parseBackCatalogue({ experiences: [ALBUM] }).experiences).toHaveLength(1)
  })

  it('maps yt-dlp entries to manifest segments', () => {
    const segments = buildSegments([
      { id: 'abc', title: 'Nightwish - Storytime', duration: 323.4, thumbnails: [{ url: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg?sqp=1' }] },
      { id: 'def', title: 'Untitled', uploader: 'Channel', duration: null },
    ], 'Playlist Title')
    expect(segments[0]).toEqual(expect.objectContaining({
      youtubeId: 'abc',
      chapter: 'Playlist Title',
      title: 'Storytime',
      artist: 'Nightwish',
      artwork: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      durationSeconds: 323,
    }))
    expect(segments[1].artist).toBe('Channel')
    expect(segments.map((segment: { chapter: string }) => segment.chapter)).toEqual(['Playlist Title', 'Playlist Title'])

    const experience = buildExperience(
      { id: 'PL123', title: 'Album', description: 'Sub', playlistUrl: 'u' },
      [{ id: 'abc', title: 'A - B', duration: 10 }],
    )
    expect(experience.artwork).toBe('experiences/PL123.jpg')
    expect(experience.segments).toHaveLength(1)
    expect(experience.segments[0].chapter).toBe('Album')
  })

  it('filters unplayable entries and dedupes repeated recordings', () => {
    const segments = buildSegments([
      { id: 'v1', title: 'Eleine - All Shall Burn (OFFICIAL VIDEO)', duration: 200 },
      { id: 'v1', title: 'Eleine - All Shall Burn (OFFICIAL VIDEO)', duration: 200 },
      { id: 'v2', title: 'ELEINE - All Shall Burn', duration: 200 },
      { id: 'v3', title: '[Private video]', duration: null },
      { id: 'v4', title: '[Deleted video]', duration: null },
      { id: 'v5', title: 'Rammstein - Mein Herz brennt (Piano Instrumental)', duration: 260 },
    ], 'Playlist Title')
    expect(segments.map((s: { youtubeId: string }) => s.youtubeId)).toEqual(['v1', 'v5'])
    expect(segments.map((s: { chapter: string }) => s.chapter)).toEqual(['Playlist Title', 'Playlist Title'])
    expect(segments[0].title).toBe('All Shall Burn')
    expect(segments[1].title).toBe('Mein Herz brennt (Piano Instrumental)')
  })

  it('cleans uploader noise from titles and artists', () => {
    expect(cleanTitle).toBeTypeOf('function')
    expect(cleanArtist).toBeTypeOf('function')
    expect(stripArtistPrefix).toBeTypeOf('function')
    expect(cleanTitle('Wasted Years (2015 Remaster)')).toBe('Wasted Years')
    expect(cleanTitle('Blur The Technicolor (Album Version (Explicit))')).toBe('Blur The Technicolor')
    expect(cleanTitle('JUKE JOINT JEZEBEL | REMASTERED | - Official Music Video')).toBe('JUKE JOINT JEZEBEL')
    expect(cleanTitle('This Is Mongol (Warrior Souls) (feat. William DuVall of Alice In Chains)'))
      .toBe('This Is Mongol (Warrior Souls) (feat. William DuVall of Alice In Chains)')
    expect(cleanTitle('Separate Ways (Worlds Apart)')).toBe('Separate Ways (Worlds Apart)')
    expect(cleanArtist('White Zombie - Topic')).toBe('White Zombie')
    expect(cleanArtist('Rammstein Official')).toBe('Rammstein')
    expect(cleanArtist('EleineOfficial')).toBe('Eleine')
    expect(cleanArtist('Official Arctic Monkeys')).toBe('Arctic Monkeys')
    expect(stripArtistPrefix('BAND-MAID / from now on', 'BAND-MAID')).toBe('from now on')
    expect(stripArtistPrefix('Kelsy Karter & The Heroines "Call Me" (Blondie Cover)', 'Kelsy Karter & The Heroines'))
      .toBe('Call Me (Blondie Cover)')
  })

  it('fixes known source metadata anomalies without broad guesses', () => {
    const segments = buildSegments([
      { id: 'SRXH9AbT280', title: 'The Emptiness Machine (Official Music Video) - Linkin Park', uploader: 'Linkin Park', duration: 190 },
      { id: 'Ma440BTErHw', title: 'Tori Amos I Don\'t Like Mondays', uploader: 'levani vanishvili', duration: 240 },
      { id: 'Z6VpX-feA2M', title: 'Quake 2- Sonic Mayhem - Quad Machine', uploader: 'Ishykawa', duration: 220 },
    ], 'Playlist Title')
    expect(segments.map(({ title, artist }: { title: string, artist: string }) => ({ title, artist }))).toEqual([
      { title: 'The Emptiness Machine', artist: 'Linkin Park' },
      { title: 'I Don\'t Like Mondays', artist: 'Tori Amos' },
      { title: 'Quad Machine', artist: 'Sonic Mayhem' },
    ])
  })

  it('renders the grid from the catalogue and emits launch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ experiences: [ALBUM] }),
    })))

    const wrapper = mount(WolvesBackCatalogue)
    await flushPromises()

    const cards = wrapper.findAll('.wc-back-catalogue-card')
    expect(cards).toHaveLength(1)
    expect(wrapper.text()).toContain('BACK CATALOGUE')
    expect(wrapper.get('.wc-back-catalogue-art').attributes('src')).toContain('experiences/test-album.jpg')

    await cards[0].trigger('click')
    expect(wrapper.emitted('launch')?.[0]?.[0]).toEqual(expect.objectContaining({ id: 'test-album' }))
  })
})
