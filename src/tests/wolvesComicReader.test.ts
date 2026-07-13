import type { SoundtrackTrack } from '../data/wolves-soundtrack'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wallpapers } from '../components/wolves/wallpapers-list'
import WolvesComicReader from '../components/wolves/WolvesComicReader.vue'

const source = {
  provider: 'youtube',
  playlistId: '123',
  playlistUrl: 'https://www.youtube.com/playlist?list=123',
  musicUrl: 'https://music.youtube.com/playlist?list=123',
  spotifyUri: null,
}

const coverTrack: SoundtrackTrack = {
  id: 'track0',
  title: 'Cover Track',
  artist: 'Artist 0',
  artwork: 'wolves-artwork/track0.jpg',
  youtubeVideoId: '0',
}

const galleryPhotos = [
  { id: 'photo-a', server: '1', secret: 'a', title: 'Photo A' },
  { id: 'photo-b', server: '2', secret: 'b', title: 'Photo B' },
  { id: 'photo-c', server: '3', secret: 'c', title: 'Photo C' },
]

function mockGalleryData(tracks = [coverTrack], flickrResponse = new Response(JSON.stringify(galleryPhotos))) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('wolves-playlist.json')) {
      return Promise.resolve(new Response(JSON.stringify({ source, tracks })))
    }
    if (url.includes('flickr-photos.json')) {
      return Promise.resolve(flickrResponse.clone())
    }
    return Promise.resolve(new Response(JSON.stringify({})))
  }))
}

function galleryCaption(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('.flickr-caption').text()
}

function galleryCrossfadeDuration(wrapper: ReturnType<typeof mount>) {
  const duration = wrapper.get('.flickr-gallery-wrapper').attributes('data-crossfade-ms')
  expect(duration).toBeDefined()
  return Number(duration)
}

function activeTimelineImage(wrapper: ReturnType<typeof mount>) {
  const activeLayer = wrapper.findAll('.flickr-photo-layer')
    .find(layer => (layer.attributes('style') ?? '').includes('z-index: 2'))
  return activeLayer?.find('.flickr-img').attributes('src')
}

describe('wolvesComicReader', () => {
  beforeEach(() => {
    mockGalleryData()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the static cover before the soundtrack starts', () => {
    const wrapper = mount(WolvesComicReader)

    expect(wrapper.find('.cover-container img').attributes('src')).toContain('color-with-bluefin-cover.webp')
  })

  it('does not render manual page navigation', () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 180,
      },
    })

    expect(wrapper.find('button[aria-label="Previous page"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Next page"]').exists()).toBe(false)
  })

  it('enforces and codifies the alignment of jorge and bketelsen images during the thesis sequence', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 346, // "We've got your back." phase (Jorge Castro)
      },
    })

    // At 346s, the active slide should correspond to Jorge Castro (kubecon-54927705495.webp)
    expect(wrapper.find('.flickr-img').attributes('src')).toContain('kubecon-54927705495.webp')

    // Set time to 351s, the active slide should correspond to bketelsen.webp
    await wrapper.setProps({ playlistCurrentTime: 351 }) // "We are Universal Blue." phase

    // Check that one of the buffered/visible layers contains bketelsen.webp
    const srcs = wrapper.findAll('.flickr-img').map(el => el.attributes('src') || '')
    expect(srcs.some(src => src.includes('bketelsen.webp'))).toBe(true)
  })

  it('enforces and codifies the alignment of the heart picture at 5:19', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 319, // Exactly 5:19 on Track 0
      },
    })
    await wrapper.vm.$nextTick()

    // At 319s (5:19), the active slide should correspond to the heart picture (kubecon-55168460993.webp)
    const srcs = wrapper.findAll('.flickr-img').map(el => el.attributes('src') || '')
    expect(srcs.some(src => src.includes('kubecon-55168460993.webp'))).toBe(true)
  })

  it('maps Collapse from its brighter visual day to its darker visual night', () => {
    const collapse = wallpapers.find(wallpaper => wallpaper.name === 'bluefin-collapse')

    expect(collapse).toMatchObject({
      type: 'daynight',
      dayName: 'wolves/wolves/bluefin-collapse-night.webp',
      nightName: 'wolves/wolves/bluefin-collapse-day.webp',
    })
  })

  it('keeps the first 20 seconds of Track 0 unchanged', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 0,
      },
    })

    expect(activeTimelineImage(wrapper)).toContain('bluefin-collapse-night.webp')

    await wrapper.setProps({ playlistCurrentTime: 8.4 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-prey-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 14.99 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-prey-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 16.8 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-dusk-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 19.99 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-dusk-day.webp')
  })

  it('uses each Track 0 wallpaper once', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 0,
      },
    })
    const shownImages: string[] = []
    let previousImage = ''

    for (let time = 0; time < 423; time += 0.5) {
      await wrapper.setProps({ playlistCurrentTime: time })
      const image = activeTimelineImage(wrapper) ?? ''
      if (image !== previousImage) {
        shownImages.push(image)
      }
      previousImage = image
    }

    expect(new Set(shownImages).size).toBe(shownImages.length)
    expect(new Set(shownImages).size).toBe(wallpapers.length)
  })

  it('keeps each later-track Flickr sequence stable and refreshes it for the next track', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockGalleryData([
      coverTrack,
      {
        id: 'later-track-one',
        title: 'Later Track One',
        artist: 'Artist 1',
        artwork: 'wolves-artwork/later-track-one.jpg',
        youtubeVideoId: '1',
        bpm: 120,
        phraseBeats: 8,
      },
      {
        id: 'later-track-two',
        title: 'Later Track Two',
        artist: 'Artist 2',
        artwork: 'wolves-artwork/later-track-two.jpg',
        youtubeVideoId: '2',
        bpm: 120,
        phraseBeats: 8,
      },
    ])
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 0, playlistCurrentTime: 0 },
    })
    await flushPromises()
    await wrapper.setProps({ trackIndex: 1, playlistCurrentTime: 0 })

    const firstTrackStart = galleryCaption(wrapper)
    expect(firstTrackStart).toContain('CNCF STREAM //')

    await wrapper.setProps({ playlistCurrentTime: 10 })
    await wrapper.setProps({ playlistCurrentTime: 0 })
    expect(galleryCaption(wrapper)).toBe(firstTrackStart)

    await wrapper.setProps({ trackIndex: 2, playlistCurrentTime: 0 })
    await flushPromises()
    expect(galleryCaption(wrapper)).toContain('CNCF STREAM //')
    expect(galleryCaption(wrapper)).not.toBe(firstTrackStart)
  })

  it('uses separate Flickr photo segments for all later tracks', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const photos = Array.from({ length: 600 }, (_, index) => ({
      id: `photo-${index}`,
      server: '1',
      secret: String(index),
      title: `Photo ${index}`,
    }))
    const tracks = [
      coverTrack,
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `later-track-${index + 1}`,
        title: `Later Track ${index + 1}`,
        artist: 'Artist',
        artwork: `wolves-artwork/later-track-${index + 1}.jpg`,
        youtubeVideoId: String(index + 1),
        bpm: 120,
        phraseBeats: 5,
      })),
    ]
    mockGalleryData(tracks, new Response(JSON.stringify(photos)))
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 0, playlistCurrentTime: 0 },
    })
    await flushPromises()
    await wrapper.setProps({ trackIndex: 1, playlistCurrentTime: 0 })

    const captionsForTrack = async () => {
      const captions = new Set<string>()
      for (const second of Array.from({ length: 10 }, (_, index) => index * 10)) {
        await wrapper.setProps({ playlistCurrentTime: second })
        captions.add(galleryCaption(wrapper))
      }
      return captions
    }

    const shownCaptions = new Set<string>()
    for (const trackIndex of [1, 2, 3, 4, 5, 6]) {
      await wrapper.setProps({ trackIndex, playlistCurrentTime: 0 })
      const captions = await captionsForTrack()
      expect([...captions].some(caption => shownCaptions.has(caption))).toBe(false)
      captions.forEach(caption => shownCaptions.add(caption))
    }
  })

  it('excludes Track 0 People Flickr photos from later tracks', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const trackZeroPhoto = wallpapers.find(wallpaper =>
      wallpaper.name?.startsWith('wolves/people/') && /\d{8,}/.test(wallpaper.name),
    )
    const trackZeroPhotoId = trackZeroPhoto?.name?.match(/\d{8,}/)?.[0]
    if (!trackZeroPhotoId) {
      throw new Error('Expected a Track 0 Flickr-backed People photo')
    }

    const photos = [
      {
        id: 'new-photo-0',
        server: '1',
        secret: '0',
        title: 'New photo 0',
      },
      {
        id: trackZeroPhotoId,
        server: '1',
        secret: 'duplicate',
        title: 'Track 0 duplicate',
      },
      ...Array.from({ length: 99 }, (_, index) => ({
        id: `new-photo-${index + 1}`,
        server: '1',
        secret: String(index + 1),
        title: `New photo ${index + 1}`,
      })),
    ]
    mockGalleryData([
      coverTrack,
      {
        id: 'later-track',
        title: 'Later Track',
        artist: 'Artist',
        artwork: 'wolves-artwork/later-track.jpg',
        youtubeVideoId: '1',
        bpm: 120,
        phraseBeats: 5,
      },
    ], new Response(JSON.stringify(photos)))
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 0, playlistCurrentTime: 0 },
    })
    await flushPromises()
    await wrapper.setProps({ trackIndex: 1, playlistCurrentTime: 0 })

    expect(galleryCaption(wrapper)).not.toContain('Track 0 duplicate')
  })

  it('uses local images for later tracks only when the Flickr feed is unavailable', async () => {
    mockGalleryData(
      [
        coverTrack,
        {
          id: 'later-track',
          title: 'Later Track',
          artist: 'Artist',
          artwork: 'wolves-artwork/later-track.jpg',
          youtubeVideoId: '1',
          bpm: 120,
          phraseBeats: 8,
        },
      ],
      new Response('Flickr unavailable', { status: 503 }),
    )
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    expect(galleryCaption(wrapper)).toContain('BLUEFIN SHOWCASE //')
  })

  it('keeps a later track fallback snapshot when Flickr finishes loading', async () => {
    const tracks = [
      coverTrack,
      {
        id: 'later-track-one',
        title: 'Later Track One',
        artist: 'Artist 1',
        artwork: 'wolves-artwork/later-track-one.jpg',
        youtubeVideoId: '1',
      },
      {
        id: 'later-track-two',
        title: 'Later Track Two',
        artist: 'Artist 2',
        artwork: 'wolves-artwork/later-track-two.jpg',
        youtubeVideoId: '2',
      },
    ]
    let resolveFlickr!: (response: Response) => void
    const flickrResponse = new Promise<Response>((resolve) => {
      resolveFlickr = resolve
    })
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('wolves-playlist.json')) {
        return Promise.resolve(new Response(JSON.stringify({ source, tracks })))
      }
      if (url.includes('flickr-photos.json')) {
        return flickrResponse
      }
      return Promise.resolve(new Response(JSON.stringify({})))
    }))

    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const fallbackCaption = galleryCaption(wrapper)
    expect(fallbackCaption).toContain('BLUEFIN SHOWCASE //')

    resolveFlickr(new Response(JSON.stringify(galleryPhotos)))
    await flushPromises()
    expect(galleryCaption(wrapper)).toBe(fallbackCaption)

    await wrapper.setProps({ trackIndex: 2, playlistCurrentTime: 0 })
    expect(galleryCaption(wrapper)).toContain('CNCF STREAM //')
  })

  it('doubles short BPM beat groups to a 10-second hold', async () => {
    mockGalleryData([
      coverTrack,
      {
        id: 'fast-phrases',
        title: 'Fast Phrases',
        artist: 'Artist',
        artwork: 'wolves-artwork/fast-phrases.jpg',
        youtubeVideoId: '1',
        bpm: 120,
        phraseBeats: 5,
        fadeDuration: 1500,
      },
    ])
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const firstCaption = galleryCaption(wrapper)
    expect(firstCaption).toContain('//')
    await wrapper.setProps({ playlistCurrentTime: 9.99 })
    expect(galleryCaption(wrapper)).toBe(firstCaption)
    await wrapper.setProps({ playlistCurrentTime: 10 })
    expect(galleryCaption(wrapper)).not.toBe(firstCaption)
  })

  it('halves long BPM beat groups to a 6-second hold', async () => {
    mockGalleryData([
      coverTrack,
      {
        id: 'slow-phrases',
        title: 'Slow Phrases',
        artist: 'Artist',
        artwork: 'wolves-artwork/slow-phrases.jpg',
        youtubeVideoId: '2',
        bpm: 120,
        phraseBeats: 48,
        fadeDuration: 3000,
      },
    ])
    const slowWrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const firstCaption = galleryCaption(slowWrapper)
    expect(firstCaption).toContain('//')
    await slowWrapper.setProps({ playlistCurrentTime: 5.99 })
    expect(galleryCaption(slowWrapper)).toBe(firstCaption)
    await slowWrapper.setProps({ playlistCurrentTime: 6 })
    expect(galleryCaption(slowWrapper)).not.toBe(firstCaption)
  })

  it('changes slides at the non-clamped boundary derived from BPM metadata', async () => {
    mockGalleryData([
      coverTrack,
      {
        id: 'metadata-paced',
        title: 'Metadata Paced',
        artist: 'Artist',
        artwork: 'wolves-artwork/metadata-paced.jpg',
        youtubeVideoId: '3',
        bpm: 100,
        phraseBeats: 12,
      },
    ])
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const firstCaption = galleryCaption(wrapper)
    expect(firstCaption).toContain('//')
    await wrapper.setProps({ playlistCurrentTime: 7.19 })
    expect(galleryCaption(wrapper)).toBe(firstCaption)
    await wrapper.setProps({ playlistCurrentTime: 7.2 })
    expect(galleryCaption(wrapper)).not.toBe(firstCaption)
  })

  it.each([
    {
      id: 'fast-phrases',
      bpm: 120,
      phraseBeats: 5,
      fadeDuration: 1500,
      hold: 10,
    },
    {
      id: 'slow-phrases',
      bpm: 120,
      phraseBeats: 48,
      fadeDuration: 3000,
      hold: 6,
    },
    {
      id: 'metadata-paced',
      bpm: 100,
      phraseBeats: 12,
      fadeDuration: undefined,
      hold: 7.2,
    },
  ])('keeps the $id crossfade within one quarter of its BPM-derived hold', async ({ id, bpm, phraseBeats, fadeDuration, hold }) => {
    mockGalleryData([
      coverTrack,
      {
        id,
        title: id,
        artist: 'Artist',
        artwork: `wolves-artwork/${id}.jpg`,
        youtubeVideoId: '1',
        bpm,
        phraseBeats,
        fadeDuration,
      },
    ])
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const firstCaption = galleryCaption(wrapper)
    expect(firstCaption).toContain('//')
    await wrapper.setProps({ playlistCurrentTime: hold - 0.01 })
    expect(galleryCaption(wrapper)).toBe(firstCaption)
    await wrapper.setProps({ playlistCurrentTime: hold })
    expect(galleryCaption(wrapper)).not.toBe(firstCaption)
    expect(galleryCrossfadeDuration(wrapper)).toBeLessThanOrEqual(hold * 1000 * 0.25)
  })

  it('uses the same permitted fallback cadence across equivalent mounts and subsequent slides without BPM metadata', async () => {
    mockGalleryData([
      coverTrack,
      {
        id: 'fallback-tempo',
        title: 'Fallback Tempo',
        artist: 'Artist',
        artwork: 'wolves-artwork/fallback-tempo.jpg',
        youtubeVideoId: '1',
      },
    ])
    const firstRun = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    const firstCaption = galleryCaption(firstRun)
    expect(firstCaption).toContain('//')

    async function findFallbackHold(wrapper: ReturnType<typeof mount>, initialCaption: string) {
      for (const hold of [7, 8, 10]) {
        await wrapper.setProps({ playlistCurrentTime: hold - 0.01 })
        const captionBeforeBoundary = galleryCaption(wrapper)
        await wrapper.setProps({ playlistCurrentTime: hold })

        if (captionBeforeBoundary === initialCaption && galleryCaption(wrapper) !== initialCaption) {
          return hold
        }
      }

      return undefined
    }

    const firstRunHold = await findFallbackHold(firstRun, firstCaption)
    expect(firstRunHold).toBeDefined()
    expect([7, 8, 10]).toContain(firstRunHold)

    const secondRun = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()
    const secondRunHold = await findFallbackHold(secondRun, galleryCaption(secondRun))
    expect(secondRunHold).toBe(firstRunHold)

    for (const slideNumber of [2, 3]) {
      await firstRun.setProps({ playlistCurrentTime: firstRunHold! * slideNumber - 0.01 })
      const captionBeforeBoundary = galleryCaption(firstRun)
      await firstRun.setProps({ playlistCurrentTime: firstRunHold! * slideNumber })
      expect(galleryCaption(firstRun)).not.toBe(captionBeforeBoundary)
    }
  })
})
