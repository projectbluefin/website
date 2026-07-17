import type { SoundtrackTrack } from '../data/wolves-soundtrack'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { wallpapers } from '../components/wolves/wallpapers-list'
import WolvesComicReader from '../components/wolves/WolvesComicReader.vue'
import { trackZeroFastFinalePhotoIds } from '../data/wolves-track-zero-slides'

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
  const img = activeLayer?.find('.flickr-img')
  return img?.exists() ? img.attributes('src') : undefined
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

  it('enforces and codifies the alignment of the heart picture at 5:21', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 321, // Exactly 5:21 on Track 0
      },
    })
    await wrapper.vm.$nextTick()

    // At 321s (5:21), the active slide should correspond to the heart picture (kubecon-55168460993.webp)
    const srcs = wrapper.findAll('.flickr-img').map(el => el.attributes('src') || '')
    expect(srcs.some(src => src.includes('kubecon-55168460993.webp'))).toBe(true)
  })

  it('holds the Maintainer Summit finale image from Become Legend through Track 0 completion', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 408,
      },
    })

    expect(activeTimelineImage(wrapper)).toContain('kubecon-55164466314.webp')

    await wrapper.setProps({ playlistCurrentTime: 422.99 })
    expect(activeTimelineImage(wrapper)).toContain('kubecon-55164466314.webp')
  })

  it('no longer schedules Collapse in the Track 0 wallpaper rotation', () => {
    // bluefin-collapse-day/night.webp moved out of the live rotation and into
    // public/wolves-intro/ for exclusive use by the new Prologue segment.
    const collapse = wallpapers.find(wallpaper => wallpaper.name === 'bluefin-collapse')

    expect(collapse).toBeUndefined()
  })

  it('keeps the first 20 seconds of Track 0 unchanged since the Collapse removal', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 0,
      },
    })

    expect(activeTimelineImage(wrapper)).toContain('bluefin-prey-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 8.4 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-prey-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 14.99 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-tenacious-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 16.8 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-tenacious-day.webp')

    await wrapper.setProps({ playlistCurrentTime: 19.99 })
    expect(activeTimelineImage(wrapper)).toContain('bluefin-tenacious-day.webp')
  })

  it('keeps the authored Jono Bacon, Marina Moore, and Bluefin group Track 0 sequence', async () => {
    const jonoPath = 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp'
    const marinaPath = 'wolves/people/kubecon-55168684055.webp'
    const shermanM2Path = 'wolves/people/sherman-m2.webp'
    const kylePath = 'wolves/people/kyle.jpg'
    const hikariPath = 'wolves/people/hikari.JPG'
    const hikari2Path = 'wolves/people/hikari2.JPG'
    const jorgePath = 'wolves/people/jorge-bluefin.webp'
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 167.8,
      },
    })

    expect(activeTimelineImage(wrapper)).toContain(jonoPath)

    await wrapper.setProps({ playlistCurrentTime: 171.878 })
    expect(activeTimelineImage(wrapper)).toContain(jonoPath)

    await wrapper.setProps({ playlistCurrentTime: 171.879 })
    expect(activeTimelineImage(wrapper)).toContain(marinaPath)
    expect(galleryCaption(wrapper)).toContain('Marina Moore')

    await wrapper.setProps({ playlistCurrentTime: 175.958 })
    expect(activeTimelineImage(wrapper)).toContain(marinaPath)

    await wrapper.setProps({ playlistCurrentTime: 175.959 })
    expect(activeTimelineImage(wrapper)).toContain(shermanM2Path)

    await wrapper.setProps({ playlistCurrentTime: 180.038 })
    expect(activeTimelineImage(wrapper)).toContain(shermanM2Path)

    await wrapper.setProps({ playlistCurrentTime: 180.039 })
    expect(activeTimelineImage(wrapper)).toContain(shermanM2Path)

    await wrapper.setProps({ playlistCurrentTime: 184.118 })
    expect(activeTimelineImage(wrapper)).toContain(shermanM2Path)

    await wrapper.setProps({ playlistCurrentTime: 184.119 })
    expect(activeTimelineImage(wrapper)).toContain(kylePath)

    await wrapper.setProps({ playlistCurrentTime: 188.198 })
    expect(activeTimelineImage(wrapper)).toContain(kylePath)

    await wrapper.setProps({ playlistCurrentTime: 188.199 })
    expect(activeTimelineImage(wrapper)).toContain(hikariPath)

    await wrapper.setProps({ playlistCurrentTime: 190.238 })
    expect(activeTimelineImage(wrapper)).toContain(hikariPath)

    await wrapper.setProps({ playlistCurrentTime: 190.239 })
    expect(activeTimelineImage(wrapper)).toContain(hikari2Path)

    await wrapper.setProps({ playlistCurrentTime: 192.278 })
    expect(activeTimelineImage(wrapper)).toContain(hikari2Path)

    await wrapper.setProps({ playlistCurrentTime: 192.279 })
    expect(activeTimelineImage(wrapper)).toContain(jorgePath)

    await wrapper.setProps({ playlistCurrentTime: 196.358 })
    expect(activeTimelineImage(wrapper)).toContain(jorgePath)

    await wrapper.setProps({ playlistCurrentTime: 196.359 })
    expect(activeTimelineImage(wrapper)).not.toContain(jorgePath)
  })

  it('ignores Track 0 BPM metadata and keeps authored Hikari windows', async () => {
    mockGalleryData([{
      ...coverTrack,
      bpm: 300,
      phraseBeats: 1,
      fadeDuration: 100,
    }])
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 188.199,
      },
    })
    await flushPromises()

    expect(activeTimelineImage(wrapper)).toContain('wolves/people/hikari.JPG')
    expect(galleryCrossfadeDuration(wrapper)).toBeCloseTo(612, 5)

    await wrapper.setProps({ playlistCurrentTime: 190.238 })
    expect(activeTimelineImage(wrapper)).toContain('wolves/people/hikari.JPG')

    await wrapper.setProps({ playlistCurrentTime: 190.239 })
    expect(activeTimelineImage(wrapper)).toContain('wolves/people/hikari2.JPG')
    expect(galleryCrossfadeDuration(wrapper)).toBeCloseTo(612, 5)
  })

  it('renders Jono Bacon’s Cult Psychology title as a theater banner', async () => {
    const wrapper = mount(WolvesComicReader, {
      props: {
        trackIndex: 0,
        playlistCurrentTime: 167.8,
      },
    })

    const banner = wrapper.get('.wallpaper-theater-caption.is-title-only')
    expect(banner.get('.wallpaper-theater-caption-title').text()).toBe('Jono Bacon, Stateshift — "The Cult Psychology of Kubernetes"')
    expect(wrapper.find('.flickr-caption').exists()).toBe(false)

    const archiveWrapper = mount(WolvesComicReader)
    const archiveSlides = (archiveWrapper.vm as any).shuffledWallpapers as Array<{ name?: string }>
    const jonoSlideIndex = archiveSlides.findIndex(slide => slide.name === 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp')
    ;(archiveWrapper.vm as any).page = jonoSlideIndex + 2
    await nextTick()

    expect(archiveWrapper.get('.wallpaper-theater-caption.is-title-only').text()).toContain('The Cult Psychology of Kubernetes')
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
    const reservedPaths = [...trackZeroFastFinalePhotoIds]
    const reservedFirstSeenAt = new Map<string, number>()
    const missingReservedPaths = reservedPaths.filter(path => !wallpapers.some(wallpaper =>
      wallpaper.name === path || wallpaper.dayName === path || wallpaper.nightName === path,
    ))

    for (let time = 0; time < 423; time += 0.1) {
      await wrapper.setProps({ playlistCurrentTime: time })
      const image = activeTimelineImage(wrapper) ?? ''
      if (image !== previousImage) {
        shownImages.push(image)
      }
      const reservedPath = reservedPaths.find(path => image.includes(path))
      if (reservedPath && !reservedFirstSeenAt.has(reservedPath)) {
        reservedFirstSeenAt.set(reservedPath, time)
      }
      previousImage = image
    }

    expect(new Set(shownImages).size).toBe(shownImages.length)
    expect(new Set(shownImages).size).toBe(wallpapers.length + missingReservedPaths.length)
    expect([...reservedFirstSeenAt.keys()].sort()).toEqual(reservedPaths.sort())
    expect([...reservedFirstSeenAt.values()].every(time => time >= 359 && time < 408)).toBe(true)
  })

  it('keeps every photo in a later-track shuffle available only once', async () => {
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
    const secondTrackOnePhoto = galleryCaption(wrapper)
    await wrapper.setProps({ playlistCurrentTime: 0 })
    expect(galleryCaption(wrapper)).toBe(firstTrackStart)

    await wrapper.setProps({ trackIndex: 2, playlistCurrentTime: 10 })
    await flushPromises()
    await wrapper.setProps({ playlistCurrentTime: 0 })
    expect(galleryCaption(wrapper)).toContain('CNCF STREAM //')
    expect(galleryCaption(wrapper)).not.toBe(firstTrackStart)
    expect(galleryCaption(wrapper)).not.toBe(secondTrackOnePhoto)
  })

  it('opens Ghosts In The Mist with the held MN047 Jorge tribute', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const jorgeQuote = [
      'These people inspire me to no end, and a bunch of unknowns created Aurora, Bazzite, Bluefin, Bluebuild, Secureblue, and others. Not a Universal Blue ecosystem, not a bootc ecosystem. A cloud native ecosystem. Sorry about my Titan manners sometimes. In one short weekend you\'ve proven to the world that enthusiasts matter.',
      'Thank you to Chainguard, Microsoft, Red Hat, Edera, for investing in the unknowns from Universal Blue! Need talent? Go cloud native, we\'re a proven Guardian Academy.',
    ]
    mockGalleryData([
      coverTrack,
      {
        id: 'ghosts-in-the-mist',
        title: 'Ghosts In The Mist',
        artist: 'Unleash The Archers',
        artwork: 'wolves-artwork/ghosts.jpg',
        youtubeVideoId: '1',
        bpm: 100,
        phraseBeats: 32,
      },
    ], new Response(JSON.stringify([
      ...galleryPhotos,
      {
        id: '55164222671',
        server: '65535',
        secret: '32d7ace307',
        title: 'KC+CNC_EU_260322_MaintainerSummitBreakouts_MN_047',
      },
    ])))
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    expect(activeTimelineImage(wrapper)).toContain('55164222671_32d7ace307_c.jpg')
    expect(wrapper.find('.flickr-photo-layer[style*="z-index: 2"] .flickr-img').attributes('style')).toContain('object-position: center top')
    expect(wrapper.get('.wallpaper-theater-caption-title').text()).toBe('Jorge Castro')
    expect(wrapper.findAll('.wallpaper-theater-caption-body').map(paragraph => paragraph.text())).toEqual(jorgeQuote)

    await wrapper.setProps({ playlistCurrentTime: 38.399 })
    expect(activeTimelineImage(wrapper)).toContain('55164222671_32d7ace307_c.jpg')

    await wrapper.setProps({ playlistCurrentTime: 38.4 })
    expect(activeTimelineImage(wrapper)).not.toContain('55164222671_32d7ace307_c.jpg')
  })

  it('does not restart a later-track shuffle after its final photo', async () => {
    const photos = [
      { id: 'photo-a', server: '1', secret: 'a', title: 'Photo A' },
      { id: 'photo-b', server: '1', secret: 'b', title: 'Photo B' },
      { id: 'photo-c', server: '1', secret: 'c', title: 'Photo C' },
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
        phraseBeats: 8,
      },
    ], new Response(JSON.stringify(photos)))
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 1, playlistCurrentTime: 0 },
    })
    await flushPromises()

    await wrapper.setProps({ playlistCurrentTime: 16 })
    const finalCaption = galleryCaption(wrapper)

    await wrapper.setProps({ playlistCurrentTime: 24 })
    expect(galleryCaption(wrapper)).toBe(finalCaption)
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

  it('does not show local images for later tracks when Flickr is unavailable', async () => {
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

    expect(wrapper.find('.flickr-caption').exists()).toBe(false)
    expect(wrapper.findAll('.flickr-img')).toHaveLength(0)
  })

  it('switches an active later track to Flickr when the cache finishes loading', async () => {
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

    expect(wrapper.find('.flickr-caption').exists()).toBe(false)

    resolveFlickr(new Response(JSON.stringify(galleryPhotos)))
    await flushPromises()
    expect(galleryCaption(wrapper)).toContain('CNCF STREAM //')

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
    ], new Response(JSON.stringify([
      { id: 'photo-a', server: '1', secret: 'a', title: 'Photo A' },
      { id: 'photo-b', server: '1', secret: 'b', title: 'Photo B' },
      { id: 'photo-c', server: '1', secret: 'c', title: 'Photo C' },
      { id: 'photo-d', server: '1', secret: 'd', title: 'Photo D' },
    ])))
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

  it('flags unusually panoramic wallpapers to render with object-fit: cover instead of letterboxing', () => {
    // These specific assets are far wider than the ~16:9 ratio most wallpapers
    // use, so object-fit: contain (the default) letterboxes them badly. See
    // wideAspectStems in scripts/generate-wallpapers.js.
    const coverWallpapers = [
      wallpapers.find(wp => wp.name === 'wolves/wolves/bluefin-chicken.webp'),
      wallpapers.find(wp => wp.name === 'wolves/wolves/bluefin-huntress.webp'),
      wallpapers.find(wp => wp.name === 'bluefin-duality'),
      wallpapers.find(wp => wp.name === 'wolves/wolves/bluefin-lazy-days.webp'),
    ]
    for (const wallpaper of coverWallpapers) {
      expect(wallpaper, `expected a cover wallpaper`).toBeDefined()
      expect(wallpaper?.fit).toBe('cover')
    }

    // A representative normal-aspect wallpaper should keep the default (no
    // override), preserving the existing letterbox-avoidance behavior.
    const dusk = wallpapers.find(wp => wp.name === 'bluefin-dusk')
    expect(dusk).toBeDefined()
    expect(dusk?.fit).toBeUndefined()
  })

  it('includes authoritative artwork credits in local Bluefin artwork slide titles', () => {
    const expectedCredits = new Map([
      ['wolves/wolves/bluefin-chicken.webp', 'Bluefin by Andy Frazer'],
      ['bluefin-duality', 'Duality (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)'],
      ['bluefin-dusk', 'Dusk by Andy Frazer'],
      ['wolves/wolves/bluefin-eyes.webp', 'Eyes by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)'],
      ['wolves/wolves/bluefin-huntress.webp', 'Huntress by Andy Frazer'],
      ['wolves/wolves/bluefin-lazy-days.webp', 'Lazy Days by Jay Balamurugan'],
      ['bluefin-prey', 'Prey (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)'],
      ['bluefin-tenacious', 'Tenacious Pterosaur (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)'],
    ])

    for (const [name, title] of expectedCredits) {
      expect(wallpapers.find(wp => wp.name === name)?.title).toBe(title)
    }
  })

  it('renders title-only theater captions only for explicitly flagged wallpapers', async () => {
    const wallpapersWithDescription = wallpapers.filter(wp => wp.name.includes('wolves/people/') && wp.description)
    expect(wallpapersWithDescription.length, 'expected no wallpaper to carry a description after simplifying these interview captions').toBe(0)
    const jono = wallpapers.find(wp => wp.name === 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp')
    expect(jono?.theaterTitleOnly).toBe(true)

    // Track 0 (the opening/"guardian" video) is the only rotation that shows local People
    // wallpapers like these; later tracks only rotate remote Flickr photos.
    mockGalleryData([coverTrack])
    const wrapper = mount(WolvesComicReader, {
      props: { trackIndex: 0, playlistCurrentTime: 0 },
    })
    await flushPromises()

    await wrapper.setProps({ playlistCurrentTime: 167.8 })
    expect(wrapper.get('.wallpaper-theater-caption.is-title-only').findAll('.wallpaper-theater-caption-body')).toHaveLength(0)
    expect(wrapper.find('.flickr-caption').exists()).toBe(false)

    await wrapper.setProps({ playlistCurrentTime: 171.879 })
    expect(wrapper.find('.wallpaper-theater-caption').exists()).toBe(false)
    expect(wrapper.find('.flickr-caption').exists()).toBe(true)
  })

  it('keeps long wallpaper page titles visible in the compact archive caption', async () => {
    const wrapper = mount(WolvesComicReader)
    const shuffledWallpapers = (wrapper.vm as any).shuffledWallpapers as Array<{ title?: string }>
    const clydeWallpaper = shuffledWallpapers.find(wp => wp.title?.includes('Clyde Seepersad'))
    expect(clydeWallpaper).toBeDefined()

    ;(wrapper.vm as any).page = shuffledWallpapers.indexOf(clydeWallpaper!) + 2
    await nextTick()

    const caption = wrapper.find('.wallpaper-caption')
    expect(caption.exists()).toBe(true)
    expect(caption.text()).toContain('Clyde Seepersad')
  })
})
