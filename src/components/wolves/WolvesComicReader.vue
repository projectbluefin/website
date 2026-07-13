<!--
WolvesComicReader — Chapter-aware canvas PDF reader
===================================================
Renders the wolves comic PDF in paged or continuous mode.
Accepts WolvesChapter[] to derive which chapter is active.

Props
  chapters  Array of WolvesChapter for active-chapter derivation.

Emits
  update:page(page: number)        1-based current page on every navigation.
  chapter-change(id: string)       Chapter ID when the active chapter changes.
-->
<script setup lang="ts">
import type { SoundtrackTrack, WolvesSoundtrackManifest } from '@/data/wolves-soundtrack'
import type { WolvesChapter } from '@/data/wolves-story'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadWolvesSoundtrack } from '@/data/wolves-soundtrack'
import { wallpapers } from './wallpapers-list'

const props = defineProps<{
  chapters: WolvesChapter[]
  autoplay?: boolean
  pacingMode?: 'normal' | 'fast' | 'hyper'
  page?: number
  trackIndex?: number
  playlistCurrentTime?: number
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'chapterChange', id: string): void
  (e: 'update:autoplay', autoplay: boolean): void
}>()

// PDF source ───────────────────────────────────────────────────────────────
const pdfUrl = `${import.meta.env.BASE_URL}color-with-bluefin.pdf`

// PDF.js CDN constants ─────────────────────────────────────────────────────
const PDFJS_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_SCRIPT_INTEGRITY = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ=='
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// Module-level singletons (survive component re-mounts on same page)
let pdfjsLib: any = null
let pdfDocument: any = null
const renderTasks = new Map<HTMLCanvasElement, any>()

// State ────────────────────────────────────────────────────────────────────
const page = ref(1) // 1-based
const pdfLoading = ref(true)
const pdfError = ref('')
const isExperimental = ref(true)

// Base path for public assets
const baseUrl = import.meta.env.BASE_URL

const shuffledWallpapers = ref<any[]>(shuffleWallpapers([...wallpapers]))
const totalPages = ref(wallpapers.length + 1)
const duskIsNight = ref(false)
let duskTimer: ReturnType<typeof setInterval> | null = null

const flickrPhotos = ref<{ id: string, server: string, secret: string, title: string }[]>([])
const manifest = ref<WolvesSoundtrackManifest | null>(null)

const activePhotoIndex = ref(0)
const previousPhotoIndex = ref<number | null>(null)
const isPhotoTransitioning = ref(false)
let photoTransitionTimeout: ReturnType<typeof setTimeout> | null = null

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
    nightName: wp.nightName
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
    nightName: wp.nightName
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

  if (trackIdx > 0 && remotePeople.length > 0) {
    return shuffleArray([...remotePeople])
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
    nightName: wp.nightName
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
    nightName: wp.nightName
  }))

  const daynightShowcase = localShowcase.filter(wp => wp.type === 'daynight')
  const normalShowcase = localShowcase.filter(wp => wp.type !== 'daynight')

  const shuffledDaynight = deterministicShuffle(daynightShowcase, 101)
  const shuffledNormalShowcase = deterministicShuffle(normalShowcase, 202)
  const shuffledPeople = deterministicShuffle(localPeople, 303)

  const result: TimelineSlide[] = []
  let currentTime = 0

  // Section 1 (Intro & Verse 1): [0, 127] seconds
  // Target: 5 Day/Night and 7 normal showcase items
  const numDn1 = Math.min(shuffledDaynight.length, 5)
  const numNormal1 = Math.min(shuffledNormalShowcase.length, 7)

  const sec1Items: any[] = []
  const dnPool = shuffledDaynight.slice(0, numDn1)
  const normalPool1 = shuffledNormalShowcase.slice(0, numNormal1)
  const remainingShowcase = shuffledNormalShowcase.slice(numNormal1)

  const totalSec1Items = numDn1 + numNormal1
  for (let i = 0; i < totalSec1Items; i++) {
    if (i % 2 === 1 && dnPool.length > 0) {
      sec1Items.push(dnPool.shift()!)
    }
    else if (normalPool1.length > 0) {
      sec1Items.push(normalPool1.shift()!)
    }
    else {
      sec1Items.push(dnPool.shift()!)
    }
  }

  const sec1Weight = numNormal1 + (numDn1 * 2)
  const sec1BaseDuration = sec1Weight > 0 ? 127 / sec1Weight : 10
  for (const item of sec1Items) {
    const duration = item.type === 'daynight' ? sec1BaseDuration * 2 : sec1BaseDuration
    result.push({
      ...item,
      path: item.path || '',
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    })
    currentTime += duration
  }

  // Section 2 (Chorus 1 & Verse 2 & Chorus 2): [127, 229] seconds
  // Target: 25 normal showcase items
  const numNormal2 = Math.min(remainingShowcase.length, 25)
  const normalPool2 = remainingShowcase.slice(0, numNormal2)
  const leftoverShowcase = remainingShowcase.slice(numNormal2)

  const sec2BaseDuration = numNormal2 > 0 ? 102 / numNormal2 : 4.08
  for (const item of normalPool2) {
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

  // Section 3 (Bridge): [229, 277] seconds
  // Leftover showcase items and first few people item (to fill exactly 8 items)
  const sec3Items: any[] = [...leftoverShowcase]
  const numPeopleNeeded3 = Math.max(0, 8 - sec3Items.length)
  const peoplePool3 = shuffledPeople.slice(0, Math.min(shuffledPeople.length, numPeopleNeeded3))
  sec3Items.push(...peoplePool3)

  const sec3BaseDuration = sec3Items.length > 0 ? 48 / sec3Items.length : 6
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

  // Section 4 (Build-Up): [277, 345] seconds
  // Target: 34 people items
  const startPeopleIdx4 = peoplePool3.length
  const endPeopleIdx4 = Math.min(shuffledPeople.length, startPeopleIdx4 + 34)
  const sec4Items = shuffledPeople.slice(startPeopleIdx4, endPeopleIdx4)

  const sec4BaseDuration = sec4Items.length > 0 ? 68 / sec4Items.length : 2
  for (const item of sec4Items) {
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

  // Section 5 (Climax & Outro): [345, 423] seconds
  // Remaining people items
  const sec5Items = shuffledPeople.slice(endPeopleIdx4)

  const sec5BaseDuration = sec5Items.length > 0 ? 78 / sec5Items.length : 0.85
  for (const item of sec5Items) {
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

  return result
})

const activeTimelineSlide = computed(() => {
  if (props.trackIndex !== 0 || !isExperimental.value || timelineSlides.value.length === 0) {
    return null
  }
  const curTime = props.playlistCurrentTime ?? 0
  const slide = timelineSlides.value.find(s => curTime >= s.startTime && curTime < s.endTime)
  return slide || timelineSlides.value[timelineSlides.value.length - 1]
})

const daynightNightOpacity = computed(() => {
  const slide = activeTimelineSlide.value
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

  // Precomputed interval in seconds per slide (avoiding double-floor snapping)
  let interval = currentTrack.value.slideInterval
    || (currentTrack.value.bpm ? (currentTrack.value.phraseBeats || 32) * 60 / currentTrack.value.bpm : 19.2)

  // Enforce minimal and maximum bounds while keeping changes beat-aligned
  const minTime = 5.0
  const maxTime = 12.0

  while (interval > maxTime) {
    interval /= 2
  }
  while (interval < minTime) {
    interval *= 2
  }

  if (props.playlistCurrentTime === undefined) {
    return 0
  }

  return Math.floor(props.playlistCurrentTime / interval) % mixedPhotos.value.length
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

watch(activeDisplayIndex, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) {
    previousPhotoIndex.value = oldVal
    activePhotoIndex.value = newVal
    isPhotoTransitioning.value = true

    if (photoTransitionTimeout) {
      clearTimeout(photoTransitionTimeout)
    }

    const duration = currentTrack.value?.fadeDuration ?? 1500
    photoTransitionTimeout = setTimeout(() => {
      previousPhotoIndex.value = null
      isPhotoTransitioning.value = false
      photoTransitionTimeout = null
    }, duration)
  }
  else {
    activePhotoIndex.value = newVal
  }
}, { immediate: true })

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

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

// Active chapter ───────────────────────────────────────────────────────────
const activeChapter = computed(() =>
  props.chapters.find(ch => page.value >= ch.pageStart && page.value <= ch.pageEnd),
)

// Template refs ────────────────────────────────────────────────────────────
const flipViewport = ref<HTMLElement | null>(null)
const flipCanvas = ref<HTMLCanvasElement | null>(null)

let flipResizeObserver: ResizeObserver | null = null

// Script injection ─────────────────────────────────────────────────────────
function loadScript(src: string, integrity?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    if (integrity) {
      script.integrity = integrity
      script.crossOrigin = 'anonymous'
    }
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) {
    return pdfjsLib
  }
  await loadScript(PDFJS_SCRIPT_URL, PDFJS_SCRIPT_INTEGRITY)
  const lib = (window as any).pdfjsLib
  if (!lib) {
    throw new Error('PDF.js failed to initialize')
  }
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
  pdfjsLib = lib
  return lib
}

// Rendering ────────────────────────────────────────────────────────────────
function getContentWidth(element: HTMLElement): number {
  const styles = window.getComputedStyle(element)
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0
  return Math.max(0, element.clientWidth - paddingLeft - paddingRight)
}

async function renderPageOnCanvas(pageNumber: number, canvas: HTMLCanvasElement, containerWidth: number) {
  if (!pdfDocument || containerWidth <= 0) {
    return
  }
  const existingTask = renderTasks.get(canvas)
  if (existingTask) {
    existingTask.cancel()
  }
  const pdfPage = await pdfDocument.getPage(pageNumber)
  const baseViewport = pdfPage.getViewport({ scale: 1 })

  // Find container available height to prevent clipping tall pages inside a fixed aspect-ratio box
  const host = canvas.parentElement as HTMLElement | null
  const paddingY = host ? (Number.parseFloat(window.getComputedStyle(host).paddingTop) || 0) + (Number.parseFloat(window.getComputedStyle(host).paddingBottom) || 0) : 24
  const containerHeight = host ? Math.max(0, host.clientHeight - paddingY) : 0

  let scale = containerWidth / baseViewport.width
  if (containerHeight > 0) {
    const scaledHeight = baseViewport.height * scale
    if (scaledHeight > containerHeight) {
      scale = containerHeight / baseViewport.height
    }
  }

  const viewport = pdfPage.getViewport({ scale })
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  const outputScale = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
  const renderTask = pdfPage.render({ canvasContext: context, viewport, transform })
  renderTasks.set(canvas, renderTask)
  renderTask.promise.then(() => {
    if (renderTasks.get(canvas) === renderTask) {
      renderTasks.delete(canvas)
    }
  }).catch(() => {})
  try {
    await renderTask.promise
  }
  catch (err: any) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('[wolves] Failed to render PDF page', pageNumber, err)
    }
  }
}

function renderFlipPage() {
  if (page.value > 1) {
    return
  }
  if (!flipCanvas.value) {
    return
  }
  const host = flipCanvas.value.parentElement as HTMLElement | null
  const width = host ? getContentWidth(host) : (flipViewport.value?.clientWidth ?? 0)
  renderPageOnCanvas(page.value, flipCanvas.value, width)
}

function setupFlipResizeObserver() {
  flipResizeObserver?.disconnect()
  if (!flipViewport.value) {
    return
  }
  flipResizeObserver = new ResizeObserver(() => renderFlipPage())
  flipResizeObserver.observe(flipViewport.value)
}

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
  pdfLoading.value = true
  pdfError.value = ''
  try {
    const lib = await loadPdfJs()
    pdfDocument = await lib.getDocument(pdfUrl).promise
    pdfLoading.value = false
    await nextTick()
    setupFlipResizeObserver()
    renderFlipPage()
  }
  catch (err) {
    console.error('[wolves] Failed to load comic PDF', err)
    pdfError.value = 'Unable to load the comic book cover right now. Wallpapers will still play.'
    pdfLoading.value = false
  }
}

// Autoplay / Autoscroll Timer
let autoplayTimer: ReturnType<typeof setInterval> | null = null
const localAutoplay = ref(false)

const autoplayInterval = computed(() => {
  if (props.pacingMode === 'hyper') {
    return 1000
  }
  if (props.pacingMode === 'fast') {
    return 2000
  }
  return 10000
})

function stopAutoplayTimer() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

function startAutoplayTimer() {
  if (autoplayTimer) {
    return
  }
  const delay = autoplayInterval.value
  autoplayTimer = setInterval(() => {
    if (page.value < totalPages.value) {
      setPage(page.value + 1)
    }
    else {
      // Reshuffle the local playlist copy for the next loop
      shuffledWallpapers.value = shuffleWallpapers([...wallpapers])
      setPage(1)
    }
  }, delay)
}

watch(() => props.autoplay, (val) => {
  localAutoplay.value = !!val
  emit('update:autoplay', !!val)
  if (val) {
    startAutoplayTimer()
  }
  else {
    stopAutoplayTimer()
  }
}, { immediate: true })

watch(autoplayInterval, () => {
  if (localAutoplay.value) {
    stopAutoplayTimer()
    startAutoplayTimer()
  }
})

// Navigation ───────────────────────────────────────────────────────────────
function setPage(n: number) {
  page.value = n
  emit('update:page', n)
  if (localAutoplay.value) {
    stopAutoplayTimer()
    startAutoplayTimer()
  }
}

// Watchers ─────────────────────────────────────────────────────────────────
watch(page, () => {
  if (!pdfLoading.value) {
    renderFlipPage()
  }
})

watch(() => props.page, (newVal) => {
  if (newVal !== undefined && newVal !== page.value) {
    page.value = newVal
  }
})

watch(activeChapter, (chapter) => {
  if (chapter) {
    emit('chapterChange', chapter.id)
  }
})

// Keyboard navigation ──────────────────────────────────────────────────────
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) {
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'Right') {
    if (page.value < totalPages.value) {
      setPage(page.value + 1)
    }
  }
  else if (event.key === 'ArrowLeft' || event.key === 'Left') {
    if (page.value > 1) {
      setPage(page.value - 1)
    }
  }
}

// Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
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
      flickrPhotos.value = shuffleArray(rawPhotos)
    }
  }
  catch (err) {
    console.error('[wolves] Failed to fetch Flickr photos list', err)
  }
})

onBeforeUnmount(() => {
  stopAutoplayTimer()
  if (duskTimer) {
    clearInterval(duskTimer)
  }
  window.removeEventListener('keydown', handleKeyDown)
  flipResizeObserver?.disconnect()
  renderTasks.forEach(task => task.cancel())
  renderTasks.clear()
  pdfDocument?.destroy()
  pdfDocument = null
})
</script>

<template>
  <section id="comic-reader" class="comic-reader-section">
    <div class="page-flip-comic-layout">
      <div ref="flipViewport" class="comic-viewport">
        <div class="comic-content-area">
          <!-- Live Gallery Mode (Tracks 1-6) -->
          <div v-if="(props.trackIndex && props.trackIndex > 0) || (props.trackIndex === 0 && isExperimental)" class="flickr-gallery-wrapper">
            <!-- Previous Photo (fading out) -->
            <div
              v-if="previousPhotoIndex !== null && mixedPhotosToUse[previousPhotoIndex!]"
              class="flickr-photo-layer fading-out"
              :style="{ animationDuration: `${currentTrack?.fadeDuration ?? 1500}ms` }"
            >
              <template v-if="mixedPhotosToUse[previousPhotoIndex!].type === 'daynight'">
                <div class="wallpaper-container daynight" style="width: 100%; height: 100%;">
                  <img
                    :src="`${baseUrl}img/wallpapers/${mixedPhotosToUse[previousPhotoIndex!].dayName}`"
                    class="flickr-img"
                    alt="Bluefin Dusk - Day"
                  >
                  <img
                    :src="`${baseUrl}img/wallpapers/${mixedPhotosToUse[previousPhotoIndex!].nightName}`"
                    class="flickr-img night-overlay is-night"
                    alt="Bluefin Dusk - Night"
                  >
                </div>
              </template>
              <template v-else>
                <img
                  :src="getFlickrPhotoUrl(mixedPhotosToUse[previousPhotoIndex!])"
                  class="flickr-img"
                  :alt="mixedPhotosToUse[previousPhotoIndex!]?.title"
                  @error="(e) => handleImageError(e, mixedPhotosToUse[previousPhotoIndex!])"
                >
              </template>
            </div>

            <!-- Active Photo (fading in/visible) -->
            <div
              class="flickr-photo-layer"
              :class="{ 'is-transitioning': isPhotoTransitioning }"
              :style="{ animationDuration: `${currentTrack?.fadeDuration ?? 1500}ms` }"
            >
              <template v-if="mixedPhotosToUse[activePhotoIndex] && mixedPhotosToUse[activePhotoIndex].type === 'daynight'">
                <div class="wallpaper-container daynight" style="width: 100%; height: 100%;">
                  <img
                    :src="`${baseUrl}img/wallpapers/${mixedPhotosToUse[activePhotoIndex].dayName}`"
                    class="flickr-img"
                    alt="Bluefin Dusk - Day"
                  >
                  <img
                    :src="`${baseUrl}img/wallpapers/${mixedPhotosToUse[activePhotoIndex].nightName}`"
                    class="flickr-img night-overlay"
                    :style="{ opacity: daynightNightOpacity }"
                    alt="Bluefin Dusk - Night"
                  >
                </div>
              </template>
              <template v-else-if="mixedPhotosToUse[activePhotoIndex]">
                <img
                  :src="getFlickrPhotoUrl(mixedPhotosToUse[activePhotoIndex])"
                  class="flickr-img"
                  :alt="mixedPhotosToUse[activePhotoIndex]?.title"
                  @error="(e) => handleImageError(e, mixedPhotosToUse[activePhotoIndex])"
                >
              </template>
            </div>

            <!-- Sleek photo caption -->
            <div v-if="mixedPhotosToUse[activePhotoIndex]" class="flickr-caption font-mono">
              <span class="caption-label text-cyan">
                {{ mixedPhotosToUse[activePhotoIndex].isLocal ? 'BLUEFIN SHOWCASE //' : 'CNCF STREAM //' }}
              </span>
              {{ mixedPhotosToUse[activePhotoIndex].title }}
            </div>
          </div>

          <template v-else>
            <div v-if="pdfLoading && page === 1" class="comic-status-wrap">
              <div class="spinner" />
              <p>Loading comic pages&hellip;</p>
            </div>
            <div v-else-if="pdfError && page === 1" class="comic-status-wrap is-error">
              <p>{{ pdfError }}</p>
              <button class="ctrl-btn" @click="loadComicPdf">
                Retry
              </button>
            </div>
            <canvas
              v-show="!pdfLoading && !pdfError && page === 1"
              ref="flipCanvas"
              class="pdf-page-canvas"
              role="img"
              :aria-label="`Comic page ${page} of ${totalPages}`"
            />
            <!-- Wallpaper Pages (Pages 2-15) -->
            <div v-if="page > 1" class="wallpaper-viewport-wrapper">
              <template v-for="(wp, idx) in shuffledWallpapers" :key="idx">
                <div v-if="page === idx + 2" class="wallpaper-display-card animate-fade">
                  <div v-if="wp.type === 'single'" class="wallpaper-container">
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.name}`"
                      class="wallpaper-img"
                      :alt="wp.title"
                    >
                  </div>
                  <div v-else-if="wp.type === 'daynight'" class="wallpaper-container daynight">
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.dayName}`"
                      class="wallpaper-img"
                      alt="Bluefin Dusk - Day"
                    >
                    <img
                      :src="`${baseUrl}img/wallpapers/${wp.nightName}`"
                      class="wallpaper-img night-overlay"
                      :class="{ 'is-night': duskIsNight }"
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

        <button
          v-show="!pdfLoading && !pdfError && page > 1 && (!props.trackIndex || props.trackIndex === 0)"
          class="nav-btn prev"
          aria-label="Previous page"
          @click="setPage(page - 1)"
        >
          &larr;
        </button>

        <button
          v-show="!pdfLoading && !pdfError && page < totalPages && (!props.trackIndex || props.trackIndex === 0)"
          class="nav-btn next"
          aria-label="Next page"
          @click="setPage(page + 1)"
        >
          &rarr;
        </button>
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
  background-color: #0c1016;
}

.wallpaper-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 3s ease-in-out;
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
  background-color: #0c1016;
  opacity: 1;

  &.fading-out {
    animation: fadeOutBuffer 1.5s ease-in-out forwards;
    z-index: 1;
  }

  &.is-transitioning {
    z-index: 2;
    animation: fadeInBuffer 1.5s ease-in-out forwards;
  }
}

.flickr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;

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
