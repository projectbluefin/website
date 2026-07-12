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
import type { WolvesChapter } from '@/data/wolves-story'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  chapters: WolvesChapter[]
  autoplay?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'chapterChange', id: string): void
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
const totalPages = ref(0)
const page = ref(1) // 1-based
const pdfLoading = ref(true)
const pdfError = ref('')

// Base path for public assets
const baseUrl = import.meta.env.BASE_URL

// Wallpapers list from projectbluefin/documentation/artwork
const wallpapers = [
  { type: 'single', name: 'bluefin-huntress.webp', title: 'Huntress' },
  { type: 'daynight', name: 'bluefin-dusk', dayName: 'bluefin-dusk-day.webp', nightName: 'bluefin-dusk-night.webp', title: 'Dusk (Day & Night)' },
  { type: 'single', name: 'bluefin-lazy-days.webp', title: 'Lazy Days' },
  { type: 'single', name: 'bluefin-chicken.webp', title: 'Chicken' },
  { type: 'single', name: 'bluefin-xe_sunset.webp', title: 'Sunset' },
  { type: 'single', name: 'bluefin-xe_space_needle.webp', title: 'Space Needle' },
  { type: 'single', name: 'bluefin-xe_red_tulip.webp', title: 'Red Tulip' },
  { type: 'single', name: 'bluefin-xe_foothills.webp', title: 'Foothills' },
  { type: 'single', name: 'bluefin-xe_clouds.webp', title: 'Clouds' },
  { type: 'single', name: 'aurora-xe_sunset.webp', title: 'Aurora Sunset' },
  { type: 'single', name: 'aurora-xe_space_needle.webp', title: 'Aurora Space Needle' },
  { type: 'single', name: 'aurora-xe_foothills.webp', title: 'Aurora Foothills' },
  { type: 'single', name: 'aurora-xe_clouds.webp', title: 'Aurora Clouds' },
  { type: 'single', name: 'aurora-jonatan-pie-aurora.webp', title: 'Jonatan Pie' }
]

const duskIsNight = ref(false)
let duskTimer: ReturnType<typeof setInterval> | null = null

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

async function loadComicPdf() {
  pdfLoading.value = true
  pdfError.value = ''
  try {
    const lib = await loadPdfJs()
    pdfDocument = await lib.getDocument(pdfUrl).promise
    totalPages.value = 15 // 1 Cover + 14 Wallpapers from projectbluefin/documentation/artwork
    pdfLoading.value = false
    await nextTick()
    setupFlipResizeObserver()
    renderFlipPage()
  }
  catch (err) {
    console.error('[wolves] Failed to load comic PDF', err)
    pdfError.value = 'Unable to load the comic book right now. Please try again in a moment.'
    pdfLoading.value = false
  }
}

// Autoplay / Autoscroll Timer
let autoplayTimer: ReturnType<typeof setInterval> | null = null
const localAutoplay = ref(false)

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
  autoplayTimer = setInterval(() => {
    if (page.value < totalPages.value) {
      setPage(page.value + 1)
    }
    else {
      // Loop back to page 1 at the end
      setPage(1)
    }
  }, 10000) // Paced at 10 seconds per page
}

watch(() => props.autoplay, (val) => {
  localAutoplay.value = !!val
}, { immediate: true })

watch(localAutoplay, (val) => {
  if (val) {
    startAutoplayTimer()
  }
  else {
    stopAutoplayTimer()
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
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  loadComicPdf()
  duskTimer = setInterval(() => {
    duskIsNight.value = !duskIsNight.value
  }, 6000) // Toggle dusk day/night state every 6 seconds for a soothing cycle
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
          <div v-if="pdfLoading" class="comic-status-wrap">
            <div class="spinner" />
            <p>Loading comic pages&hellip;</p>
          </div>
          <div v-else-if="pdfError" class="comic-status-wrap is-error">
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
          <div v-if="!pdfLoading && !pdfError && page > 1" class="wallpaper-viewport-wrapper">
            <template v-for="(wp, idx) in wallpapers" :key="idx">
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
        </div>

        <button
          v-show="!pdfLoading && !pdfError && page > 1"
          class="nav-btn prev"
          aria-label="Previous page"
          @click="setPage(page - 1)"
        >
          &larr;
        </button>

        <button
          v-show="!pdfLoading && !pdfError && page < totalPages"
          class="nav-btn next"
          aria-label="Next page"
          @click="setPage(page + 1)"
        >
          &rarr;
        </button>
      </div>

      <!-- Bottom control bar (Tightened & high density) -->
      <div class="reader-controls">
        <button
          class="ctrl-btn"
          aria-label="Previous page"
          :disabled="page === 1"
          @click="setPage(page - 1)"
        >
          &larr; Previous
        </button>

        <!-- Autoplay Toggle aligned in control bar -->
        <button
          class="autoplay-toggle-btn font-mono"
          :class="{ 'is-active': localAutoplay }"
          :aria-label="localAutoplay ? 'Disable page autoplay' : 'Enable page autoplay'"
          type="button"
          @click="localAutoplay = !localAutoplay"
        >
          <span class="indicator-dot" />
          {{ localAutoplay ? 'AUTO' : 'MANUAL' }}
        </button>

        <div class="kbd-hint font-mono">
          Page {{ page }} / {{ totalPages || '—' }}
        </div>

        <div class="jump-select-wrap">
          <span>Jump to:</span>
          <select
            :value="page"
            :disabled="pdfLoading || !!pdfError || !totalPages"
            @change="setPage(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="n in totalPages" :key="n" :value="n">
              Page {{ n }}
            </option>
          </select>
        </div>

        <button
          class="ctrl-btn"
          aria-label="Next page"
          :disabled="page === totalPages"
          @click="setPage(page + 1)"
        >
          Next &rarr;
        </button>
      </div>
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
</style>
