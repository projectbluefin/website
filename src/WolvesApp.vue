<!--
README: Bluefin Wolves Teaser Landing Page Component
===================================================
- Page Path: projectbluefin.io/wolves
- Comic Content: Renders the real "Color with Bluefin" coloring book PDF
  (https://download.projectbluefin.io/color-with-bluefin.pdf) page-by-page onto
  an HTML5 canvas using PDF.js, loaded dynamically from the cdnjs CDN (see
  `PDFJS_SCRIPT_URL` / `PDFJS_WORKER_URL` below). To point at a different PDF,
  update `PDF_URL`.
- Discord Quotes: Sourced from `src/data/bazzite-quotes.json`. Add real/new community
  quotes there with fields: quote, attribution, context, date.
- Donate QR Code: Pointing to `https://docs.projectbluefin.io/donations`.
  To change the donation target URL, update `scripts/generate-qrs.js` and re-run.
- Playlist ID in use: `PLA78oiE-RGAE` ("Bluefin: Seven Days to the Wolves" on YouTube).
-->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import qrDonate from '@/assets/svg/qr-donate.svg'
import qrStore from '@/assets/svg/qr-store.svg'
import TopNavbar from './components/TopNavbar.vue'
import bazziteQuotes from './data/bazzite-quotes.json'

// PDF.js is injected dynamically from CDNJS (see loadPdfJs()) and attaches itself
// to `window.pdfjsLib`. It ships no first-party types, so we treat it as `any`.
const PDF_URL = 'https://download.projectbluefin.io/color-with-bluefin.pdf'
const PDFJS_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_SCRIPT_INTEGRITY = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ=='
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

let pdfjsLib: any = null
let pdfDocument: any = null
// Tracks in-flight render tasks per canvas element so a resize/page-flip can cancel
// a stale render before starting a new one on the same canvas.
const renderTasks = new Map<HTMLCanvasElement, any>()

// Soundtrack Widget state
const playlistId = 'PLA78oiE-RGAE'
const embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&rel=0`
const playlistTitle = 'Bluefin: Seven Days to the Wolves'
const playlistDescription = 'The ultimate heavy metal companion soundtrack for reading the Wolves comic'
const coverArtUrl = 'https://i.ytimg.com/vi/LASru9j0oIc/maxresdefault.jpg'

const isPlaying = ref(false)
const isSticky = ref(false)
const isDismissed = ref(sessionStorage.getItem('wolves_soundtrack_dismissed') === 'true')
const isCollapsed = ref(sessionStorage.getItem('wolves_soundtrack_collapsed') === 'true')

function dismissPlayer() {
  isDismissed.value = true
  sessionStorage.setItem('wolves_soundtrack_dismissed', 'true')
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  sessionStorage.setItem('wolves_soundtrack_collapsed', isCollapsed.value ? 'true' : 'false')
}

function startSoundtrack() {
  isPlaying.value = true
  isDismissed.value = false
  sessionStorage.setItem('wolves_soundtrack_dismissed', 'false')
}

// Comic Reader state
const totalPages = ref(0)
const currentPageIndex = ref(0) // 0-based for the UI; PDF.js pages are 1-based
const readingMode = ref<'flip' | 'scroll'>('flip') // 'flip' = page-by-page, 'scroll' = stacked vertical
const pdfLoading = ref(true)
const pdfError = ref('')

// Template refs: the "flip" mode uses a single canvas, the "scroll" mode renders
// one canvas per page into an array indexed by page number.
const flipViewport = ref<HTMLElement | null>(null)
const flipCanvas = ref<HTMLCanvasElement | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const scrollCanvases = ref<(HTMLCanvasElement | null)[]>([])

let flipResizeObserver: ResizeObserver | null = null
let scrollResizeObserver: ResizeObserver | null = null

function setScrollCanvasRef(el: Element | null, index: number) {
  scrollCanvases.value[index] = el as HTMLCanvasElement | null
}

// Dynamically injects a <script> tag once and resolves when it has loaded.
// When `integrity` is supplied, the script is fetched with subresource integrity
// verification and CORS mode enabled so the browser can check the hash.
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

// Injects PDF.js from CDNJS and wires up its worker script, caching the global for reuse.
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

// Renders a single PDF page onto the given canvas, scaled to fill containerWidth.
async function renderPageOnCanvas(pageNumber: number, canvas: HTMLCanvasElement, containerWidth: number) {
  if (!pdfDocument || containerWidth <= 0) {
    return
  }

  // Cancel a stale in-flight render targeting this canvas before starting a new one.
  const existingTask = renderTasks.get(canvas)
  if (existingTask) {
    existingTask.cancel()
  }

  const page = await pdfDocument.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = containerWidth / baseViewport.width
  const viewport = page.getViewport({ scale })

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  // Render at native device pixel ratio for crisp output on HiDPI screens.
  const outputScale = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined

  const renderTask = page.render({ canvasContext: context, viewport, transform })
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
  if (!flipCanvas.value || !flipViewport.value) {
    return
  }
  renderPageOnCanvas(currentPageIndex.value + 1, flipCanvas.value, flipViewport.value.clientWidth)
}

function renderAllScrollPages() {
  if (!scrollContainer.value) {
    return
  }
  const width = scrollContainer.value.clientWidth
  for (let i = 0; i < totalPages.value; i++) {
    const canvas = scrollCanvases.value[i]
    if (canvas) {
      renderPageOnCanvas(i + 1, canvas, width)
    }
  }
}

function setupFlipResizeObserver() {
  flipResizeObserver?.disconnect()
  if (!flipViewport.value) {
    return
  }
  flipResizeObserver = new ResizeObserver(() => renderFlipPage())
  flipResizeObserver.observe(flipViewport.value)
}

function setupScrollResizeObserver() {
  scrollResizeObserver?.disconnect()
  if (!scrollContainer.value) {
    return
  }
  scrollResizeObserver = new ResizeObserver(() => renderAllScrollPages())
  scrollResizeObserver.observe(scrollContainer.value)
}

async function loadComicPdf() {
  pdfLoading.value = true
  pdfError.value = ''
  try {
    const lib = await loadPdfJs()
    pdfDocument = await lib.getDocument(PDF_URL).promise
    totalPages.value = pdfDocument.numPages
    pdfLoading.value = false
    await nextTick()
    if (readingMode.value === 'flip') {
      setupFlipResizeObserver()
      renderFlipPage()
    }
    else {
      setupScrollResizeObserver()
      renderAllScrollPages()
    }
  }
  catch (err) {
    console.error('[wolves] Failed to load comic PDF', err)
    pdfError.value = 'Unable to load the comic book right now. Please try again in a moment.'
    pdfLoading.value = false
  }
}

// Watch scroll position for Soundtrack Widget sticky transition
function handleScroll() {
  const scrollTop = window.scrollY
  isSticky.value = scrollTop > 250
}

// Keyboard navigation helper
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
    return
  }
  if (readingMode.value !== 'flip') {
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'Right') {
    nextPage()
  }
  else if (event.key === 'ArrowLeft' || event.key === 'Left') {
    prevPage()
  }
}

function nextPage() {
  if (currentPageIndex.value < totalPages.value - 1) {
    currentPageIndex.value++
  }
}

function prevPage() {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
  }
}

function jumpToPage(index: number) {
  if (index >= 0 && index < totalPages.value) {
    currentPageIndex.value = index
  }
}

// Re-render the current page whenever it changes in flip mode.
watch(currentPageIndex, () => {
  if (readingMode.value === 'flip' && !pdfLoading.value) {
    renderFlipPage()
  }
})

// Swap resize observers and (re)render pages whenever the layout mode toggles.
watch(readingMode, async (mode) => {
  if (pdfLoading.value || pdfError.value) {
    return
  }
  await nextTick()
  if (mode === 'flip') {
    scrollResizeObserver?.disconnect()
    setupFlipResizeObserver()
    renderFlipPage()
  }
  else {
    flipResizeObserver?.disconnect()
    setupScrollResizeObserver()
    renderAllScrollPages()
  }
})

// Bazzite Quote cycling state
const currentQuoteIndex = ref(0)
let quoteTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleKeyDown)
  loadComicPdf()

  // Start quote auto-cycling interval (9 seconds)
  quoteTimer = setInterval(() => {
    currentQuoteIndex.value = (currentQuoteIndex.value + 1) % bazziteQuotes.length
  }, 9000)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', handleKeyDown)
  flipResizeObserver?.disconnect()
  scrollResizeObserver?.disconnect()
  renderTasks.forEach(task => task.cancel())
  renderTasks.clear()
  pdfDocument?.destroy()

  // Clear quote auto-cycling interval to prevent memory leaks
  if (quoteTimer) {
    clearInterval(quoteTimer)
    quoteTimer = null
  }
})
</script>

<template>
  <div class="wolves-teaser-page">
    <!-- Top Global Navigation Bar -->
    <TopNavbar />

    <!-- Persistent Floating Soundtrack Widget -->
    <div
      v-if="!isDismissed"
      class="sticky-soundtrack-bar"
      :class="{
        'is-hidden': !isSticky && !isPlaying,
        'is-collapsed': isCollapsed,
      }"
    >
      <!-- Collapsed View -->
      <div v-if="isCollapsed" class="collapsed-pill" @click="toggleCollapse">
        <span class="music-icon">🎵</span>
        <span class="collapsed-text">{{ isPlaying ? 'Soundtrack Active' : 'Soundtrack' }}</span>
        <button
          class="mini-close-btn"
          aria-label="Dismiss Player"
          @click.stop="dismissPlayer"
        >
          &times;
        </button>
      </div>

      <!-- Expanded View -->
      <div v-else class="bar-content">
        <div class="bar-info">
          <!-- Album Thumbnail -->
          <div class="bar-thumbnail">
            <img :src="coverArtUrl" :alt="playlistTitle">
          </div>
          <div class="bar-meta">
            <span class="bar-label">Soundtrack Playing</span>
            <span class="bar-title">{{ playlistTitle }}</span>
          </div>
        </div>

        <div class="bar-controls">
          <!-- Media Player -->
          <div class="mini-player">
            <iframe
              v-if="isPlaying"
              :src="embedUrl"
              title="YouTube playlist player"
              allow="autoplay; encrypted-media"
            />
            <div v-else class="play-overlay">
              <button
                class="mini-play-btn"
                @click="isPlaying = true"
              >
                ▶ Play Audio
              </button>
            </div>
          </div>

          <div class="action-buttons">
            <!-- Collapse Button -->
            <button
              class="collapse-btn"
              title="Collapse Player"
              aria-label="Collapse Player"
              @click="toggleCollapse"
            >
              &minus;
            </button>

            <!-- Dismiss button -->
            <button
              class="close-btn"
              aria-label="Dismiss Player"
              @click="dismissPlayer"
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Outer Container -->
    <div class="wolves-layout">
      <!-- SECTION 1: HERO SECTION -->
      <header class="wolves-hero">
        <div class="hero-text">
          <div class="hero-tag">
            Upcoming Release Teaser
          </div>
          <!-- Aggressive display typography with heavy scale -->
          <h1 class="hero-title">
            Seven Days to the <span class="accent">Wolves</span>
          </h1>
          <p class="hero-description">
            An original Project Bluefin graphic novel. Follow the journey of an architect battling systemic infrastructure collapse, navigating the shadows of the old web, and fighting to deploy ultimate digital sovereignty.
          </p>
          <div class="hero-footnote">
            Comic book release slated for late 2026. Review placeholder governance comic below.
          </div>
        </div>

        <!-- Hero Soundtrack Widget Box -->
        <div class="hero-soundtrack-card">
          <div class="soundtrack-header">
            <div class="soundtrack-thumbnail">
              <img :src="coverArtUrl" :alt="playlistTitle">
            </div>
            <div class="soundtrack-meta">
              <span class="soundtrack-tag">Soundtrack Invite</span>
              <span class="soundtrack-title">{{ playlistTitle }}</span>
            </div>
          </div>
          <p class="soundtrack-desc">
            {{ playlistDescription }}. Activate playback to lock in the metal atmosphere while scrolling the story panels.
          </p>
          <div class="soundtrack-player-wrapper">
            <div v-if="isPlaying" class="playing-state-overlay">
              <div class="visualizer-content">
                <span class="visualizer-icon">🎵</span>
                <span class="visualizer-text">Soundtrack Active</span>
                <p class="visualizer-sub">
                  Enjoy the heavy metal companion soundtrack! You can pause or dismiss it using the floating player in the bottom-right corner.
                </p>
              </div>
            </div>
            <div v-else class="play-overlay">
              <button
                class="play-btn"
                @click="startSoundtrack"
              >
                ▶ Start Soundtrack
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- SECTION 2: COMIC READER -->
      <section id="comic-reader" class="comic-reader-section">
        <div class="section-title-wrap">
          <div>
            <h2 class="title-h2">
              Comic Reader
            </h2>
            <p class="title-p">
              Read "Color with Bluefin" right in your browser, rendered live from the source PDF.
            </p>
          </div>

          <!-- Mode Selector Toggles -->
          <div class="mode-selectors">
            <button
              :class="{ active: readingMode === 'flip' }"
              @click="readingMode = 'flip'"
            >
              Page By Page
            </button>
            <button
              :class="{ active: readingMode === 'scroll' }"
              @click="readingMode = 'scroll'"
            >
              Continuous Scroll
            </button>
          </div>
        </div>

        <!-- Comic Reader Layout: Page by Page (Slideshow) -->
        <div v-if="readingMode === 'flip'" class="page-flip-comic-layout">
          <div ref="flipViewport" class="comic-viewport">
            <!-- Page Contents -->
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
                v-show="!pdfLoading && !pdfError"
                ref="flipCanvas"
                class="pdf-page-canvas"
                role="img"
                :aria-label="`Comic page ${currentPageIndex + 1} of ${totalPages}`"
              />
            </div>

            <!-- Left Navigation Button -->
            <button
              v-show="!pdfLoading && !pdfError && currentPageIndex > 0"
              class="nav-btn prev"
              aria-label="Previous Page"
              @click="prevPage"
            >
              &larr;
            </button>

            <!-- Right Navigation Button -->
            <button
              v-show="!pdfLoading && !pdfError && currentPageIndex < totalPages - 1"
              class="nav-btn next"
              aria-label="Next Page"
              @click="nextPage"
            >
              &rarr;
            </button>
          </div>

          <!-- Bottom Control Bar (Navigation Controls) -->
          <div class="reader-controls">
            <button
              class="ctrl-btn"
              :disabled="pdfLoading || !!pdfError || currentPageIndex === 0"
              @click="prevPage"
            >
              &larr; Previous
            </button>

            <!-- Keyboard helper -->
            <div class="kbd-hint">
              Use &larr; &rarr; arrow keys to turn pages &middot; Page {{ currentPageIndex + 1 }} of {{ totalPages || '—' }}
            </div>

            <div class="jump-select-wrap">
              <span>Jump to:</span>
              <select
                :value="currentPageIndex"
                :disabled="pdfLoading || !!pdfError || !totalPages"
                @change="jumpToPage(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="n in totalPages" :key="n" :value="n - 1">
                  Page {{ n }}
                </option>
              </select>
            </div>

            <button
              class="ctrl-btn"
              :disabled="pdfLoading || !!pdfError || currentPageIndex === totalPages - 1"
              @click="nextPage"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        <!-- Comic Reader Layout: Continuous Stacked Vertical Scroll -->
        <div v-else ref="scrollContainer" class="scroll-comic-layout">
          <template v-if="pdfLoading">
            <div class="comic-status-wrap">
              <div class="spinner" />
              <p>Loading comic pages&hellip;</p>
            </div>
          </template>
          <template v-else-if="pdfError">
            <div class="comic-status-wrap is-error">
              <p>{{ pdfError }}</p>
              <button class="ctrl-btn" @click="loadComicPdf">
                Retry
              </button>
            </div>
          </template>
          <template v-else>
            <div
              v-for="n in totalPages"
              :key="n"
              class="scroll-page-card"
            >
              <div class="comic-viewport">
                <div class="comic-content-area">
                  <canvas
                    :ref="(el) => setScrollCanvasRef(el as Element | null, n - 1)"
                    class="pdf-page-canvas"
                    role="img"
                    :aria-label="`Page ${n} of ${totalPages}`"
                  />
                </div>
              </div>
              <div class="comic-caption-bar">
                Page {{ n }} of {{ totalPages }}
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- SECTION 3: BAZZITE DISCORD QUOTES -->
      <section id="bazzite-quotes" class="comic-reader-section">
        <div class="section-title-wrap">
          <div>
            <h2 class="title-h2">
              Bazzite Dispatch
            </h2>
            <p class="title-p">
              Direct dispatches from Bazzite gaming operatives via the Project Bluefin Discord.
            </p>
          </div>
        </div>

        <div class="quotes-single-wrap">
          <Transition name="quote-fade">
            <div
              :key="currentQuoteIndex"
              class="quote-card"
            >
              <!-- Decorative quote icon -->
              <div class="quote-symbol">
                &ldquo;
              </div>

              <!-- Quote Text -->
              <p class="quote-text">
                "{{ bazziteQuotes[currentQuoteIndex].quote }}"
              </p>

              <!-- Citation Metadata -->
              <div class="quote-meta">
                <div class="meta-top">
                  <span>John Bazzite</span>
                </div>
                <div class="meta-context">
                  Bluefin Discord Teaser Dispatch
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Discord hook commentary -->
        <div class="quotes-footnote">
          Quotes sourced from verified Discord testimonials. Additional quotes can be added in src/data/bazzite-quotes.json.
        </div>
      </section>

      <!-- SECTION 4: QR CODES SECTION -->
      <section id="wolves-support" class="comic-reader-section">
        <div class="support-wrap">
          <h2 class="title-h2">
            Support the Mission
          </h2>
          <p class="title-p">
            Secure official gear or donate directly to fuel next-generation Linux workstation research, hardware enablement, and future comic releases.
          </p>
        </div>

        <div class="qr-grid">
          <!-- QR Card 1: Official Store -->
          <div class="qr-card">
            <h3 class="qr-title">
              Official Store
            </h3>
            <div class="qr-image-box">
              <img :src="qrStore" alt="QR Code linking to Store">
            </div>
            <div class="qr-action-wrap">
              <a
                href="https://store.projectbluefin.io"
                target="_blank"
                rel="noopener noreferrer"
                class="qr-btn blue"
              >
                Go to Store &rarr;
              </a>
              <span class="qr-domain">store.projectbluefin.io</span>
            </div>
          </div>

          <!-- QR Card 2: Donate to Project -->
          <div class="qr-card">
            <h3 class="qr-title">
              Donate to Bluefin
            </h3>
            <div class="qr-image-box">
              <img :src="qrDonate" alt="QR Code to Donate">
            </div>
            <div class="qr-action-wrap">
              <a
                href="https://docs.projectbluefin.io/donations"
                target="_blank"
                rel="noopener noreferrer"
                class="qr-btn dark"
              >
                Donate Now &rarr;
              </a>
              <span class="qr-domain">docs.projectbluefin.io/donations</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-teaser-page {
  background-image: url('/evening/night-sky.webp');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  box-sizing: border-box;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 600px;
    background: linear-gradient(to bottom, rgba(12, 16, 22, 0.7), transparent);
    z-index: 0;
    pointer-events: none;
  }
}

.wolves-layout {
  position: relative;
  z-index: 1;
  max-width: 1012px;
  margin: 0 auto;
  padding: 80px 24px 100px;
  display: flex;
  flex-direction: column;
  gap: 60px;
}

// Persistent Floating Soundtrack Widget
.sticky-soundtrack-bar {
  position: fixed;
  z-index: 999;
  background-color: rgba(16, 21, 31, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(66, 133, 244, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  // Desktop layout (Default)
  bottom: 24px;
  right: 24px;
  width: 320px;
  border-radius: 12px;

  &.is-hidden {
    opacity: 0;
    transform: translateY(100px);
    pointer-events: none;
  }

  &.is-collapsed {
    width: auto;
    border-radius: 30px;
  }

  .collapsed-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    user-select: none;

    .music-icon {
      font-size: 1.4rem;
      animation: pulse 2s infinite;
    }

    .collapsed-text {
      white-space: nowrap;
    }

    .mini-close-btn {
      background: none;
      border: none;
      color: #bdbdbd;
      font-size: 1.8rem;
      cursor: pointer;
      line-height: 1;
      padding: 0 4px;
      margin-left: 4px;
      transition: color 0.2s;

      &:hover {
        color: #ffffff;
      }
    }
  }

  .bar-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bar-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .bar-thumbnail {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(66, 133, 244, 0.3);
    background-color: #000;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .bar-meta {
    min-width: 0;
    flex: 1;
  }

  .bar-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-blue);
    line-height: 1;
  }

  .bar-title {
    display: block;
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .mini-player {
    flex: 1;
    height: 32px;
    border-radius: 6px;
    overflow: hidden;
    background-color: #000;
    border: 1px solid #272727;

    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  }

  .mini-play-btn {
    width: 100%;
    height: 100%;
    background-color: var(--color-blue);
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--color-blue-light);
    }
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .collapse-btn,
  .close-btn {
    background: none;
    border: none;
    color: #bdbdbd;
    cursor: pointer;
    line-height: 1;
    transition: color 0.2s;

    &:hover {
      color: #ffffff;
    }
  }

  .collapse-btn {
    font-size: 1.8rem;
    padding: 0 4px;
  }

  .close-btn {
    font-size: 2.2rem;
    padding: 0 4px;
  }

  // Mobile layout
  @media (max-width: 767px) {
    bottom: 0;
    left: 0;
    right: 0;
    width: 100% !important;
    border-radius: 0;
    border-top: 1px solid rgba(66, 133, 244, 0.3);
    border-left: none;
    border-right: none;
    border-bottom: none;

    &.is-collapsed {
      bottom: 0;
      left: 0;
      right: 0;
      width: 100% !important;
      border-radius: 0;

      .collapsed-pill {
        justify-content: center;
        padding: 10px 16px;
      }
    }

    .bar-content {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      gap: 12px;
    }

    .bar-info {
      flex: 1;
    }

    .bar-controls {
      width: auto;
      flex-shrink: 0;
    }

    .mini-player {
      width: 100px;
      flex: none;
    }

    .bar-meta {
      .bar-title {
        font-size: 1.1rem;
        max-width: 150px;
      }
    }
  }
}

// Hero Section
.wolves-hero {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 40px 0;
  border-bottom: 1px solid rgba(var(--color-blue-rgb), 0.2);

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 48px;
  }

  .hero-text {
    flex: 1;
    text-align: center;

    @media (min-width: 768px) {
      text-align: left;
    }
  }

  .hero-tag {
    display: inline-block;
    border: 1px solid var(--color-blue-light);
    color: var(--color-blue-light);
    font-size: 1.1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 4px 14px;
    border-radius: 20px;
    margin-bottom: 16px;
  }

  .hero-title {
    font-size: 3.6rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-transform: uppercase;
    margin-bottom: 16px;

    @media (min-width: 768px) {
      font-size: 5.4rem;
    }

    .accent {
      color: var(--color-blue);
    }
  }

  .hero-description {
    font-size: 1.6rem;
    line-height: 1.6;
    color: #bdbdbd;
    margin-bottom: 24px;
    max-width: 600px;
  }

  .hero-footnote {
    font-size: 1.2rem;
    color: rgba(189, 189, 189, 0.6);
    font-style: italic;
  }

  // Soundtrack Box inside Hero
  .hero-soundtrack-card {
    width: 100%;
    background-color: #10151f;
    border: 1px solid rgba(var(--color-blue-rgb), 0.4);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;

    @media (min-width: 768px) {
      width: 320px;
      flex-shrink: 0;
    }
  }

  .soundtrack-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .soundtrack-thumbnail {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(var(--color-blue-rgb), 0.3);
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .soundtrack-meta {
    min-width: 0;
  }

  .soundtrack-tag {
    display: block;
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--color-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .soundtrack-title {
    display: block;
    font-size: 1.4rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .soundtrack-desc {
    font-size: 1.2rem;
    line-height: 1.5;
    color: #bdbdbd;
  }

  .soundtrack-player-wrapper {
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: #000;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #272727;
    position: relative;
  }

  .playing-state-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #10151f 0%, #0c1016 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
  }

  .visualizer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .visualizer-icon {
    font-size: 2.4rem;
    animation: bounce 1.5s infinite;
  }

  .visualizer-text {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .visualizer-sub {
    font-size: 1.1rem;
    color: #bdbdbd;
    margin: 0;
    max-width: 240px;
  }

  .play-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-btn {
    background-color: var(--color-blue);
    color: #ffffff;
    font-weight: 700;
    font-size: 1.2rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 10px 20px;
    border-radius: 30px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(var(--color-blue-rgb), 0.4);

    &:hover {
      background-color: var(--color-blue-light);
      transform: scale(1.05);
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
}

// Comic Reader Section
.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }

  .title-h2 {
    font-size: 2.4rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .title-p {
    font-size: 1.4rem;
    color: #bdbdbd;
    margin: 4px 0 0;
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

    &.active {
      background-color: var(--color-blue);
      color: #ffffff;
    }

    &:hover:not(.active) {
      color: #ffffff;
    }
  }
}

// Comic Page Viewer
.comic-viewport {
  position: relative;
  width: 100%;
  min-height: 200px;
  max-width: 640px;
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
    min-height: 200px;
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

// Canvas the current PDF page is rendered onto; JS sets explicit pixel
// dimensions to match the container width at the device pixel ratio.
.pdf-page-canvas {
  display: block;
  max-width: 100%;
}

// Loading / error states shown while PDF.js fetches and parses the PDF
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
  justify-content: space-between;
  width: 100%;
  max-width: 640px;
  margin: 16px auto 0;
  padding: 0 16px;

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

// Continuous Scroll Layout
.scroll-comic-layout {
  display: flex;
  flex-direction: column;
  gap: 32px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;

  .scroll-page-card {
    background-color: #10151f;
    border: 1px solid rgba(var(--color-blue-rgb), 0.2);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }
}

// Bazzite Quotes Section
.quotes-single-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
}

.quote-card {
  background-color: #10151f;
  border: 1px solid #272727;
  padding: 24px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  width: 100%;
  max-width: 640px;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;

  &:hover {
    border-color: rgba(var(--color-blue-rgb), 0.4);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .quote-symbol {
    position: absolute;
    top: 16px;
    right: 24px;
    color: #272727;
    font-size: 6rem;
    font-family: serif;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  &:hover .quote-symbol {
    color: rgba(var(--color-blue-rgb), 0.1);
  }

  .quote-text {
    font-size: 1.5rem;
    line-height: 1.6;
    color: #ffffff;
    font-style: italic;
    font-weight: 500;
    margin: 0;
    position: relative;
    z-index: 1;
  }

  .quote-meta {
    border-top: 1px solid rgba(39, 39, 39, 0.6);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-top {
    display: flex;
    justify-content: space-between;
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
  }

  .meta-date {
    color: #616161;
    font-weight: 500;
  }

  .meta-context {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

/* Quote transition effects */
.quote-fade-enter-active,
.quote-fade-leave-active {
  transition: opacity 0.5s ease-in-out;
}

.quote-fade-leave-active {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 640px;
}

.quote-fade-enter-from,
.quote-fade-leave-to {
  opacity: 0;
}

.quotes-footnote {
  font-size: 1.1rem;
  color: rgba(189, 189, 189, 0.4);
  text-align: center;
  font-style: italic;
  margin-top: 8px;
}

// Support / QR Section
.support-wrap {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
  margin: 24px auto 0;
  width: 100%;

  @media (min-width: 600px) {
    flex-direction: row;
  }
}

.qr-card {
  flex: 1;
  background-color: #10151f;
  border: 1px solid #272727;
  padding: 24px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);

  .qr-title {
    font-size: 1.4rem;
    font-weight: 800;
    text-transform: uppercase;
    color: #ffffff;
    margin: 0;
  }

  .qr-image-box {
    width: 192px;
    height: 192px;
    background-color: #0c1016;
    border: 1px solid #272727;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s;

    &:hover {
      transform: scale(1.05);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .qr-action-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    align-items: center;
  }

  .qr-btn {
    display: inline-block;
    color: #ffffff;
    font-weight: 700;
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 8px 24px;
    border-radius: 20px;
    text-decoration: none;
    transition: background-color 0.2s;

    &.blue {
      background-color: var(--color-blue);
      &:hover {
        background-color: var(--color-blue-light);
      }
    }

    &.dark {
      background-color: #272727;
      &:hover {
        background-color: #1e1e1e;
      }
    }
  }

  .qr-domain {
    font-size: 1.1rem;
    color: #616161;
  }
}
</style>
