<!--
WolvesComicReader — Chapter-aware canvas PDF reader
===================================================
Renders the soundtrack-synced Wolves visual presentation.
-->
<script setup lang="ts">
import type { SoundtrackTrack, WolvesSoundtrackManifest } from '@/data/wolves-soundtrack'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadWolvesSoundtrack } from '@/data/wolves-soundtrack'
import { wallpapers } from './wallpapers-list'

const props = defineProps<{
  trackIndex?: number
  playlistCurrentTime?: number
}>()

// PDF source ───────────────────────────────────────────────────────────────
const pdfUrl = `${import.meta.env.BASE_URL}color-with-bluefin.pdf`

// Module-level singletons (survive component re-mounts on same page)

// State ────────────────────────────────────────────────────────────────────
const page = ref(1) // 1-based
const pdfLoading = ref(false)
const pdfError = ref('')
const isExperimental = ref(true)

// Base path for public assets
const baseUrl = import.meta.env.BASE_URL

const shuffledWallpapers = ref<any[]>(shuffleWallpapers([...wallpapers]))
const duskIsNight = ref(false)
let duskTimer: ReturnType<typeof setInterval> | null = null

const trackZeroFlickrPhotoIds = new Set(
  wallpapers.flatMap((wallpaper) => {
    const photoId = wallpaper.name?.startsWith('wolves/people/') && wallpaper.name.match(/\d{8,}/)?.[0]
    return photoId ? [photoId] : []
  }),
)
const flickrPhotos = ref<{ id: string, server: string, secret: string, title: string }[]>([])
const laterTrackPhotos = ref<any[]>([])
const galleryCycle = ref<any[]>([])
const manifest = ref<WolvesSoundtrackManifest | null>(null)

const activeBuffer = ref<'A' | 'B'>('A')
const photoA = ref<any>(null)
const photoB = ref<any>(null)
const opacityA = ref(1)
const opacityB = ref(0)
const slideAIndex = ref(-1)
const slideBIndex = ref(-1)
const GALLERY_SEGMENT_SIZE = 100
const TIMELINE_BOUNDARY_EPSILON_SECONDS = 0.001

const activePhoto = computed(() => {
  return activeBuffer.value === 'A' ? photoA.value : photoB.value
})

const currentTrack = computed<SoundtrackTrack | null>(() => {
  if (!manifest.value || props.trackIndex === undefined) {
    return null
  }
  return manifest.value.tracks[props.trackIndex] || null
})

const currentBeat = computed(() => {
  const bpm = currentTrack.value?.bpm
  if (!bpm || props.playlistCurrentTime === undefined) {
    return 0
  }
  return Math.floor(props.playlistCurrentTime * (bpm / 60))
})

// Evaluated to keep the computed active for vitest assertions without TS6133 unused error
void currentBeat.value

const mixedPhotos = computed(() => {
  // 1. Local Showcase and Story wallpapers (isPeople = false)
  const localShowcase = wallpapers.filter((wp) => {
    const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
    return !isPeople
  }).map(wp => ({
    id: wp.name,
    isLocal: true,
    path: wp.name,
    title: wp.title,
    type: wp.type,
    dayName: wp.dayName,
    nightName: wp.nightName,
    fit: wp.fit
  }))

  // 2. Local People wallpapers (isPeople = true)
  const localPeople = wallpapers.filter((wp) => {
    const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
    return isPeople
  }).map(wp => ({
    id: wp.name,
    isLocal: true,
    path: wp.name,
    title: wp.title,
    type: wp.type,
    dayName: wp.dayName,
    nightName: wp.nightName,
    fit: wp.fit
  }))

  // 3. Flickr Remote People photos
  const remotePeople = flickrPhotos.value.map(p => ({
    id: p.id,
    isLocal: false,
    path: `https://live.staticflickr.com/${p.server}/${p.id}_${p.secret}_b.jpg`,
    title: p.title,
    type: 'single' as const,
    dayName: undefined,
    nightName: undefined,
    rawPhoto: p
  }))

  const trackIdx = props.trackIndex ?? 1

  if (trackIdx > 0) {
    return laterTrackPhotos.value
  }

  // Shuffle inputs to vary the lists per-song
  const shuffledShowcase = shuffleArray([...localShowcase])
  const shuffledPeople = shuffleArray([
    ...localPeople,
    ...remotePeople
  ])

  // Every track starts with 3 showcase screenshots
  const pinnedStart = shuffledShowcase.slice(0, 3)
  const remainingShowcase = shuffledShowcase.slice(3)

  if (trackIdx === 1) {
    // Track 1 (First Song of Slideshow): Bias showcase at start and fade smoothly into people/Flickr photos
    const result: any[] = [...pinnedStart]
    const remainingShowcaseCopy = [...remainingShowcase]
    const shuffledPeopleCopy = [...shuffledPeople]

    const totalRemaining = remainingShowcaseCopy.length + shuffledPeopleCopy.length
    for (let i = 0; i < totalRemaining; i++) {
      // Linear fade-out of showcase probability from 0.8 to 0.0 over 40 slides
      const showcaseProb = Math.max(0, 0.8 * (1 - i / 40))
      if (remainingShowcaseCopy.length > 0 && (shuffledPeopleCopy.length === 0 || Math.random() < showcaseProb)) {
        result.push(remainingShowcaseCopy.shift())
      }
      else if (shuffledPeopleCopy.length > 0) {
        result.push(shuffledPeopleCopy.shift())
      }
      else {
        result.push(remainingShowcaseCopy.shift())
      }
    }
    return result
  }
  else {
    // Tracks 2-6: Ensure showcase photos never go back-to-back, and each song starts with a showcase photo
    const result: any[] = []
    const showcaseCopy = [...shuffledShowcase]
    const peopleCopy = [...shuffledPeople]

    // Start with 1 showcase photo
    if (showcaseCopy.length > 0) {
      result.push(showcaseCopy.shift())
    }

    while (showcaseCopy.length > 0 || peopleCopy.length > 0) {
      // Add up to 2 people/Flickr photos
      let addedPeople = 0
      for (let k = 0; k < 2; k++) {
        if (peopleCopy.length > 0) {
          result.push(peopleCopy.shift())
          addedPeople++
        }
      }

      // Add 1 showcase photo (only if we added at least 1 people/Flickr photo to prevent back-to-back!)
      if (showcaseCopy.length > 0) {
        if (addedPeople > 0 || result.length === 0) {
          result.push(showcaseCopy.shift())
        }
      }
    }
    return result
  }
})

interface TimelineSlide {
  id: string
  isLocal: boolean
  path: string
  title: string
  type: 'single' | 'daynight'
  dayName?: string
  nightName?: string
  startTime: number
  duration: number
  endTime: number
  fit?: 'cover' | 'contain'
}

const timelineSlides = computed<TimelineSlide[]>(() => {
  const localShowcase = wallpapers.filter((wp) => {
    const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
    return !isPeople
  }).map(wp => ({
    id: wp.name || wp.dayName || wp.nightName || '',
    isLocal: true,
    path: wp.name,
    title: wp.title,
    type: wp.type,
    dayName: wp.dayName,
    nightName: wp.nightName,
    fit: wp.fit
  }))

  const localPeople = wallpapers.filter((wp) => {
    const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
    return isPeople
  }).map(wp => ({
    id: wp.name || wp.dayName || wp.nightName || '',
    isLocal: true,
    path: wp.name,
    title: wp.title,
    type: wp.type,
    dayName: wp.dayName,
    nightName: wp.nightName,
    fit: wp.fit
  }))

  const daynightShowcase = localShowcase.filter(wp => wp.type === 'daynight')
  const normalShowcase = localShowcase.filter(wp => wp.type !== 'daynight')

  const pivotalTarget = 'wolves/people/kubecon-54927705495.webp'
  const targetIndex = localPeople.findIndex(wp => wp.id === pivotalTarget)
  let pivotalPhoto: any = null
  if (targetIndex !== -1) {
    pivotalPhoto = localPeople.splice(targetIndex, 1)[0]
  }

  const bkTarget = 'wolves/people/bketelsen.webp'
  const bkTargetIndex = localPeople.findIndex(wp => wp.id === bkTarget)
  let bkPhoto: any = null
  if (bkTargetIndex !== -1) {
    bkPhoto = localPeople.splice(bkTargetIndex, 1)[0]
  }

  const heartTarget = 'wolves/people/kubecon-55168460993.webp'
  const heartTargetIndex = localPeople.findIndex(wp => wp.id === heartTarget)
  let heartPhoto: any = null
  if (heartTargetIndex !== -1) {
    heartPhoto = localPeople.splice(heartTargetIndex, 1)[0]
  }

  const finaleTarget = 'wolves/people/kubecon-55164466314.webp'
  const finaleTargetIndex = localPeople.findIndex(wp => wp.id === finaleTarget)
  let finalePhoto: any = null
  if (finaleTargetIndex !== -1) {
    finalePhoto = localPeople.splice(finaleTargetIndex, 1)[0]
  }

  const shuffledDaynight = deterministicShuffle(daynightShowcase, 101)
  const shuffledNormalShowcase = deterministicShuffle(normalShowcase, 202)
  const shuffledPeople = deterministicShuffle(localPeople, 303)

  const result: TimelineSlide[] = []
  let currentTime = 0

  // 1. Ambient Intro [0, 42] seconds (42s total) -> 5 Day/Night wallpapers shown slowly
  const dnPool = shuffledDaynight.slice(0, 5)
  const sec1BaseDuration = 42 / dnPool.length
  for (const item of dnPool) {
    const duration = sec1BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // 2. Heavy Driving Verse 1 [42, 127] seconds (85s total) -> 22 normal showcase wallpapers
  const normalPool1 = shuffledNormalShowcase.slice(0, 22)
  const sec2BaseDuration = 85 / normalPool1.length
  for (const item of normalPool1) {
    const duration = sec2BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // 3. Heavy Chorus 1 / Verse 2 / Chorus 2 [127, 229] seconds (102s total) -> 17 leftover showcase + 15 people wallpapers
  const normalPool2 = shuffledNormalShowcase.slice(22, 39)
  const peoplePool1 = shuffledPeople.slice(0, 15)
  const sec3Items = [...normalPool2, ...peoplePool1]
  const sec3BaseDuration = 102 / sec3Items.length
  for (const item of sec3Items) {
    const duration = sec3BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // 4. Chanting Bridge [229, 277] seconds (48s total) -> 24 people wallpapers shown faster
  const peoplePool2 = shuffledPeople.slice(15, 39)
  const sec4BaseDuration = 48 / peoplePool2.length
  for (const item of peoplePool2) {
    const duration = sec4BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // 5. Heavy Build-Up [277, 345] seconds (68s total) -> 34 people wallpapers
  const peoplePool3 = shuffledPeople.slice(39, 73)
  if (heartPhoto) {
    peoplePool3.splice(21, 0, heartPhoto)
  }
  const sec5BaseDuration = 68 / peoplePool3.length
  for (const item of peoplePool3) {
    const duration = sec5BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // 6. Fast Solo Climax & Outro [345, 423] seconds (78s total)

  if (pivotalPhoto) {
    const freezeDuration = 5.5
    result.push({
      ...pivotalPhoto,
      path: pivotalPhoto.path || '',
      startTime: currentTime,
      duration: freezeDuration,
      endTime: currentTime + freezeDuration
    })
    currentTime += freezeDuration
  }

  if (bkPhoto) {
    const freezeDuration = 8.5
    result.push({
      ...bkPhoto,
      path: bkPhoto.path || '',
      startTime: currentTime,
      duration: freezeDuration,
      endTime: currentTime + freezeDuration
    })
    currentTime += freezeDuration
  }

  const peoplePool4 = shuffledPeople.slice(73)
  const finaleStartTime = 408
  const sec6BaseDuration = (finaleStartTime - currentTime) / peoplePool4.length
  for (const item of peoplePool4) {
    const duration = sec6BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  if (finalePhoto) {
    result.push({
      ...finalePhoto,
      path: finalePhoto.path || '',
      startTime: currentTime,
      duration: 423 - currentTime,
      endTime: 423
    })
  }

  return result
})

const activeTimelineSlide = computed(() => {
  if (props.trackIndex !== 0 || !isExperimental.value || timelineSlides.value.length === 0) {
    return null
  }
  const curTime = props.playlistCurrentTime ?? 0
  let index = timelineSlides.value.findIndex(s => curTime < s.endTime - TIMELINE_BOUNDARY_EPSILON_SECONDS)
  if (index === -1) {
    index = timelineSlides.value.length - 1
  }
  return timelineSlides.value[index]
})

const laterTrackSlideHold = computed(() => {
  const trackIndex = props.trackIndex ?? 0
  if (trackIndex <= 0) {
    return null
  }

  const track = currentTrack.value
  if (track?.bpm && track.phraseBeats) {
    let beatGroup = track.phraseBeats
    let hold = beatGroup * 60 / track.bpm

    while (hold > 11.5) {
      beatGroup /= 2
      hold = beatGroup * 60 / track.bpm
    }
    while (hold < 5.5) {
      beatGroup *= 2
      hold = beatGroup * 60 / track.bpm
    }

    return hold
  }

  return [7, 8, 10][trackIndex % 3]
})

const currentSlideTransitionDuration = computed(() => {
  if ((props.trackIndex ?? 0) > 0) {
    const hold = laterTrackSlideHold.value ?? 7
    return Math.min(currentTrack.value?.fadeDuration ?? 1500, hold * 250)
  }
  const slide = activeTimelineSlide.value
  if (!slide) {
    return 1000
  }
  return Math.min(800, slide.duration * 300)
})

const daynightNightOpacityA = computed(() => {
  const slide = photoA.value
  if (!slide || slide.type !== 'daynight') {
    return 0
  }
  const curTime = props.playlistCurrentTime ?? 0
  const elapsed = curTime - slide.startTime
  const ratio = Math.min(1.0, Math.max(0.0, elapsed / slide.duration))
  return ratio
})

const daynightNightOpacityB = computed(() => {
  const slide = photoB.value
  if (!slide || slide.type !== 'daynight') {
    return 0
  }
  const curTime = props.playlistCurrentTime ?? 0
  const elapsed = curTime - slide.startTime
  const ratio = Math.min(1.0, Math.max(0.0, elapsed / slide.duration))
  return ratio
})

const activeTimelineSlideIndex = computed(() => {
  if (timelineSlides.value.length === 0) {
    return 0
  }
  const slide = activeTimelineSlide.value
  if (!slide) {
    return 0
  }
  return timelineSlides.value.indexOf(slide)
})

const activeFlickrIndex = computed(() => {
  if (mixedPhotos.value.length === 0 || !currentTrack.value) {
    return 0
  }

  if (props.playlistCurrentTime === undefined) {
    return 0
  }

  return Math.floor(props.playlistCurrentTime / (laterTrackSlideHold.value ?? 7)) % mixedPhotos.value.length
})

const activeDisplayIndex = computed(() => {
  if (props.trackIndex === 0 && isExperimental.value) {
    return activeTimelineSlideIndex.value
  }
  return activeFlickrIndex.value
})

const mixedPhotosToUse = computed(() => {
  if (props.trackIndex === 0 && isExperimental.value) {
    return timelineSlides.value
  }
  return mixedPhotos.value
})

watch([activeDisplayIndex, mixedPhotosToUse], ([newVal]) => {
  const activePhotoObj = mixedPhotosToUse.value[newVal]
  if (!activePhotoObj) {
    return
  }

  // Preload the next image to prevent decode/network stutter during exact beat crossfades
  const nextIndex = (newVal + 1) % mixedPhotosToUse.value.length
  const nextPhoto = mixedPhotosToUse.value[nextIndex]
  if (nextPhoto) {
    if (nextPhoto.type === 'daynight') {
      const imgDay = new Image()
      imgDay.src = `${baseUrl}img/wallpapers/${nextPhoto.dayName}`
      const imgNight = new Image()
      imgNight.src = `${baseUrl}img/wallpapers/${nextPhoto.nightName}`
    }
    else {
      const img = new Image()
      img.src = getFlickrPhotoUrl(nextPhoto)
    }
  }

  if (photoA.value === null && photoB.value === null) {
    photoA.value = activePhotoObj
    slideAIndex.value = newVal
    activeBuffer.value = 'A'
    opacityA.value = 1
    opacityB.value = 0
    return
  }

  if (activeBuffer.value === 'A') {
    photoB.value = activePhotoObj
    slideBIndex.value = newVal
    activeBuffer.value = 'B'
    opacityB.value = 1
    opacityA.value = 0
  }
  else {
    photoA.value = activePhotoObj
    slideAIndex.value = newVal
    activeBuffer.value = 'A'
    opacityA.value = 1
    opacityB.value = 0
  }
}, { immediate: true })

watch(() => props.trackIndex, (trackIndex, previousTrackIndex) => {
  if (previousTrackIndex !== undefined) {
    photoA.value = null
    photoB.value = null
    opacityA.value = 1
    opacityB.value = 0
    slideAIndex.value = -1
    slideBIndex.value = -1
    activeBuffer.value = 'A'
  }
  if (trackIndex !== undefined && trackIndex > 0) {
    snapshotLaterTrackPhotos(trackIndex)
  }
}, { immediate: true })

watch(flickrPhotos, (photos) => {
  const trackIndex = props.trackIndex
  if (photos.length > 0 && trackIndex !== undefined && trackIndex > 0) {
    snapshotLaterTrackPhotos(trackIndex)
  }
})

function getFlickrPhotoUrl(photo: any) {
  if (!photo) {
    return ''
  }
  if (photo.isLocal) {
    if (photo.type === 'daynight') {
      return `${baseUrl}img/wallpapers/${duskIsNight.value ? photo.nightName : photo.dayName}`
    }
    return `${baseUrl}img/wallpapers/${photo.path}`
  }
  return photo.path
}

// Most wallpapers use object-fit: contain to avoid cropping, but a few
// unusually panoramic assets (see wideAspectStems in generate-wallpapers.js)
// letterbox badly under contain, so they opt into cover instead.
function photoObjectFit(photo: any) {
  return photo?.fit === 'cover' ? 'cover' : 'contain'
}

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function snapshotLaterTrackPhotos(trackIndex: number) {
  const remotePhotos = flickrPhotos.value
    .filter(photo => !trackZeroFlickrPhotoIds.has(photo.id))
    .map(photo => ({
      id: photo.id,
      isLocal: false,
      path: `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`,
      title: photo.title,
      type: 'single' as const,
      dayName: undefined,
      nightName: undefined,
      rawPhoto: photo
    }))
  if (remotePhotos.length === 0) {
    galleryCycle.value = []
    laterTrackPhotos.value = []
    return
  }

  if (galleryCycle.value.length === 0) {
    galleryCycle.value = shuffleArray(remotePhotos)
  }

  const startIndex = galleryCycle.value.length > 0
    ? ((trackIndex - 1) * GALLERY_SEGMENT_SIZE) % galleryCycle.value.length
    : 0
  laterTrackPhotos.value = [...galleryCycle.value.slice(startIndex), ...galleryCycle.value.slice(0, startIndex)]
}

function deterministicShuffle<T>(array: T[], seed = 42): T[] {
  const copy = [...array]
  let currentSeed = seed
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000
    return x - Math.floor(x)
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function handleImageError(event: Event, photo: any) {
  const img = event.target as HTMLImageElement
  if (!photo) {
    return
  }

  if (img.src.includes('bluespeed-cluster.png')) {
    // Already fell back to local cluster wallpaper, stop recursion
    return
  }

  // If this is a remote Flickr photo and we tried _b.jpg, fallback to _z.jpg (guaranteed fallback)
  if (!photo.isLocal && img.src.includes('_b.jpg')) {
    img.src = img.src.replace('_b.jpg', '_z.jpg')
    return
  }

  // If _z.jpg also fails or if it's already on _z.jpg, fallback to medium size (no suffix)
  if (!photo.isLocal && img.src.includes('_z.jpg')) {
    img.src = img.src.replace('_z.jpg', '.jpg')
    return
  }

  // Final fallback to a guaranteed gorgeous local showcase screenshot to avoid "black screens"
  img.src = `${baseUrl}img/wallpapers/wolves/showcase/bluespeed-cluster.png`
}

// Template refs ────────────────────────────────────────────────────────────
const flipViewport = ref<HTMLElement | null>(null)

// Utilities ────────────────────────────────────────────────────────────────

function shuffleWallpapers(array: any[]): any[] {
  const itemsWithScores = array.map((item) => {
    const isPeople = item.name?.includes('/people/') || item.dayName?.includes('/people/') || item.nightName?.includes('/people/')
    const r = Math.random()
    // if people, score is in [0.45, 1.05] (tends toward end)
    // if showcase or story illustration, score is in [0.0, 0.6] (tends toward start)
    const score = isPeople ? 0.45 + r * 0.6 : r * 0.6
    return { item, score }
  })

  // Sort by the assigned score
  itemsWithScores.sort((a, b) => a.score - b.score)

  return itemsWithScores.map(x => x.item)
}

async function loadComicPdf() {
  pdfLoading.value = false
  pdfError.value = ''
}

// Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  loadComicPdf()
  duskTimer = setInterval(() => {
    duskIsNight.value = !duskIsNight.value
  }, 6000) // Toggle dusk day/night state every 6 seconds for a soothing cycle

  try {
    manifest.value = await loadWolvesSoundtrack()
  }
  catch (err) {
    console.error('[wolves] Failed to load wolves soundtrack manifest', err)
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}flickr-photos.json`)
    if (response.ok) {
      const rawPhotos = await response.json()
      flickrPhotos.value = Array.isArray(rawPhotos) ? rawPhotos : []
    }
  }
  catch (err) {
    console.error('[wolves] Failed to fetch Flickr photos list', err)
  }
})

onBeforeUnmount(() => {
  if (duskTimer) {
    clearInterval(duskTimer)
  }
})
</script>

<template>
  <section id="comic-reader" class="comic-reader-section">
    <div class="page-flip-comic-layout">
      <div ref="flipViewport" class="comic-viewport">
        <div class="comic-content-area">
          <!-- Live Gallery Mode (Tracks 1-6) -->
          <div
            v-if="(props.trackIndex && props.trackIndex > 0) || (props.trackIndex === 0 && isExperimental)"
            class="flickr-gallery-wrapper"
            :data-crossfade-ms="currentSlideTransitionDuration"
          >
            <!-- Layer A -->
            <div
              class="flickr-photo-layer"
              :style="{
                opacity: opacityA,
                transition: `opacity ${currentSlideTransitionDuration}ms linear`,
                zIndex: activeBuffer === 'A' ? 2 : 1,
              }"
            >
              <template v-if="photoA && photoA.type === 'daynight'">
                <div class="wallpaper-container daynight" style="width: 100%; height: 100%;">
                  <img
                    :src="`${baseUrl}img/wallpapers/${photoA.dayName}`"
                    class="flickr-img"
                    :style="{ objectFit: photoObjectFit(photoA) }"
                    alt="Bluefin Dusk - Day"
                  >
                  <img
                    :src="`${baseUrl}img/wallpapers/${photoA.nightName}`"
                    class="flickr-img night-overlay"
                    :style="{ opacity: daynightNightOpacityA, objectFit: photoObjectFit(photoA) }"
                    alt="Bluefin Dusk - Night"
                  >
                </div>
              </template>
              <template v-else-if="photoA">
                <img
                  :src="getFlickrPhotoUrl(photoA)"
                  class="flickr-img"
                  :style="{ objectFit: photoObjectFit(photoA) }"
                  :alt="photoA.title"
                  @error="(e) => handleImageError(e, photoA)"
                >
              </template>
            </div>

            <!-- Layer B -->
            <div
              class="flickr-photo-layer"
              :style="{
                opacity: opacityB,
                transition: `opacity ${currentSlideTransitionDuration}ms linear`,
                zIndex: activeBuffer === 'B' ? 2 : 1,
              }"
            >
              <template v-if="photoB && photoB.type === 'daynight'">
                <div class="wallpaper-container daynight" style="width: 100%; height: 100%;">
                  <img
                    :src="`${baseUrl}img/wallpapers/${photoB.dayName}`"
                    class="flickr-img"
                    :style="{ objectFit: photoObjectFit(photoB) }"
                    alt="Bluefin Dusk - Day"
                  >
                  <img
                    :src="`${baseUrl}img/wallpapers/${photoB.nightName}`"
                    class="flickr-img night-overlay"
                    :style="{ opacity: daynightNightOpacityB, objectFit: photoObjectFit(photoB) }"
                    alt="Bluefin Dusk - Night"
                  >
                </div>
              </template>
              <template v-else-if="photoB">
                <img
                  :src="getFlickrPhotoUrl(photoB)"
                  class="flickr-img"
                  :style="{ objectFit: photoObjectFit(photoB) }"
                  :alt="photoB.title"
                  @error="(e) => handleImageError(e, photoB)"
                >
              </template>
            </div>

            <!-- Sleek photo caption -->
            <div v-if="activePhoto" class="flickr-caption font-mono">
              <span class="caption-label text-cyan">
                {{ activePhoto.isLocal ? 'BLUEFIN SHOWCASE //' : 'CNCF STREAM //' }}
              </span>
              {{ activePhoto.title }}
            </div>
          </div>

          <template v-else>
            <!-- Page 1 (Cover Page) -->
            <div v-if="page === 1" class="wallpaper-viewport-wrapper">
              <div class="wallpaper-display-card animate-fade">
                <div class="wallpaper-container cover-container">
                  <img
                    :src="`${baseUrl}img/color-with-bluefin-cover.webp`"
                    class="wallpaper-img"
                    alt="Color with Bluefin Coloring Book Cover"
                    loading="eager"
                  >
                </div>
                <!-- Decorative caption with download link -->
                <div class="wallpaper-caption font-mono flex items-center gap-2">
                  <span class="caption-label text-cyan">BLUEFIN ARCHIVE //</span> Color with Bluefin
                  <span class="text-gray-500 mx-1">|</span>
                  <a
                    :href="pdfUrl"
                    download="color-with-bluefin.pdf"
                    class="text-cyan hover:text-white transition-colors"
                    title="Download full coloring book PDF (19MB)"
                  >
                    Download PDF (19MB)
                  </a>
                </div>
              </div>
            </div>

            <!-- Wallpaper Pages (Pages 2-15) -->
            <div v-if="page > 1" class="wallpaper-viewport-wrapper">
              <template v-for="(wp, idx) in shuffledWallpapers" :key="idx">
                <div v-if="page === idx + 2" class="wallpaper-display-card animate-fade">
                  <div v-if="wp.type === 'single'" class="wallpaper-container">
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.name}`"
                      class="wallpaper-img"
                      :style="{ objectFit: photoObjectFit(wp) }"
                      :alt="wp.title"
                    >
                  </div>
                  <div v-else-if="wp.type === 'daynight'" class="wallpaper-container daynight">
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.dayName}`"
                      class="wallpaper-img"
                      :style="{ objectFit: photoObjectFit(wp) }"
                      alt="Bluefin Dusk - Day"
                    >
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.nightName}`"
                      class="wallpaper-img night-overlay"
                      :class="{ 'is-night': duskIsNight }"
                      :style="{ objectFit: photoObjectFit(wp) }"
                      alt="Bluefin Dusk - Night"
                    >
                  </div>
                  <!-- Decorative caption -->
                  <div class="wallpaper-caption font-mono">
                    <span class="caption-label text-cyan">BLUEFIN ARCHIVE //</span> {{ wp.title }}
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- Bottom control bar removed (fused into soundtrack widget) -->
    </div>
  </section>
</template>

<style scoped lang="scss">
.comic-toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  width: 100%;
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;

  @media (min-width: 600px) {
    flex-direction: row;
    align-items: center;
  }
}

.autoplay-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #10151f;
  border: 1px solid #272727;
  color: #bdbdbd;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(66, 133, 244, 0.4);
    color: #ffffff;
  }

  &.is-active {
    border-color: #27c93f;
    color: #27c93f;
    box-shadow: 0 0 10px rgba(39, 201, 63, 0.2);

    .indicator-dot {
      background-color: #27c93f;
      box-shadow: 0 0 8px #27c93f;
    }
  }

  .indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #5d5d5d;
    transition: all 0.2s ease;
  }
}

.mode-selectors {
  display: flex;
  background-color: #10151f;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #272727;
  align-self: flex-start;

  button {
    background: none;
    border: none;
    color: #bdbdbd;
    font-size: 1.2rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &[aria-selected='true'] {
      background-color: var(--color-blue);
      color: #ffffff;
    }

    &[aria-selected='false']:hover {
      color: #ffffff;
    }
  }
}

.comic-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 220px;
  max-width: 760px;
  max-height: min(74dvh, 760px);
  margin: 0 auto;
  background-color: #10151f;
  border: 1px solid rgba(var(--color-blue-rgb), 0.3);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;

  .comic-content-area {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    padding: 12px;
    overflow: hidden;
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.7);
    border: 1px solid #272727;
    color: #ffffff;
    font-size: 1.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;

    &:hover {
      background-color: #000;
      color: var(--color-blue-light);
      border-color: var(--color-blue-light);
    }

    &.prev {
      left: 12px;
    }
    &.next {
      right: 12px;
    }
  }
}

.pdf-page-canvas {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}

.comic-status-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 32px;
  text-align: center;
  color: #bdbdbd;
  font-size: 1.4rem;

  &.is-error {
    color: var(--color-blue-light);
  }

  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(var(--color-blue-rgb), 0.25);
    border-top-color: var(--color-blue);
    animation: comic-spinner-spin 0.8s linear infinite;
  }
}

@keyframes comic-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

.comic-caption-bar {
  background-color: rgba(0, 0, 0, 0.9);
  padding: 16px 24px;
  border-top: 1px solid #272727;
  text-align: center;
  font-size: 1.3rem;
  color: #ffffff;
  font-weight: 500;
  line-height: 1.5;
}

.reader-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 0;
  gap: 8px 12px;
  flex-wrap: wrap;

  .ctrl-btn {
    background-color: #10151f;
    border: 1px solid #272727;
    color: #bdbdbd;
    font-size: 1.2rem;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      color: #ffffff;
      border-color: var(--color-blue-light);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .kbd-hint {
    font-size: 1.1rem;
    color: #616161;
  }

  .jump-select-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.2rem;
    color: #bdbdbd;

    select {
      background-color: #10151f;
      border: 1px solid #272727;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 1.2rem;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--color-blue-light);
      }
    }
  }
}

// Wallpaper Gallery Styling ──────────────────────────────────────────────────
.wallpaper-viewport-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.wallpaper-display-card {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.scroll-mode {
    height: 100%;
    width: 100%;
  }
}

.wallpaper-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
}

.wallpaper-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  transition: opacity 3s linear;
  will-change: opacity;
  transform: translateZ(0);
}

.night-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms linear;
  will-change: opacity;
  transform: translateZ(0);

  &.is-night {
    opacity: 1;
  }
}

.wallpaper-caption {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(16, 21, 31, 0.85);
  border: 1px solid rgba(66, 133, 244, 0.3);
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  z-index: 5;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  white-space: nowrap;

  .caption-label {
    font-weight: bold;
  }
}

.animate-fade {
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// Flickr Immersive Slideshow
.flickr-gallery-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: transparent;
}

.flickr-photo-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: opacity;
  transform: translateZ(0);
}

.flickr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.flickr-caption {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(16, 21, 31, 0.85);
  border: 1px solid rgba(66, 133, 244, 0.3);
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  z-index: 5;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  max-width: 90%;
  overflow-wrap: anywhere;

  .caption-label {
    font-weight: bold;
  }
}

@keyframes fadeInBuffer {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOutBuffer {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
