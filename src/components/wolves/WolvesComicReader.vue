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

const props = defineProps<{ chapters: WolvesChapter[] }>()

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
const readingMode = ref<'paged' | 'continuous'>('paged')
const pdfLoading = ref(true)
const pdfError = ref('')

// Active chapter ───────────────────────────────────────────────────────────
const activeChapter = computed(() =>
  props.chapters.find(ch => page.value >= ch.pageStart && page.value <= ch.pageEnd),
)

// Template refs ────────────────────────────────────────────────────────────
const flipViewport = ref<HTMLElement | null>(null)
const flipCanvas = ref<HTMLCanvasElement | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const scrollCanvases = ref<(HTMLCanvasElement | null)[]>([])
const scrollCards = ref<(HTMLElement | null)[]>([])

let flipResizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

function setScrollCanvasRef(el: Element | null, index: number) {
  scrollCanvases.value[index] = el as HTMLCanvasElement | null
}

function setScrollCardRef(el: Element | null, index: number) {
  scrollCards.value[index] = el as HTMLElement | null
}

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
  const scale = containerWidth / baseViewport.width
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

function setupIntersectionObserver() {
  intersectionObserver?.disconnect()
  if (typeof IntersectionObserver === 'undefined') {
    return
  }
  intersectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const n = Number((entry.target as HTMLElement).dataset.page)
        const canvas = scrollCanvases.value[n - 1]
        if (canvas) {
          const host = canvas.parentElement as HTMLElement | null
          const width = host ? getContentWidth(host) : (scrollContainer.value?.clientWidth ?? 0)
          void renderPageOnCanvas(n, canvas, width)
        }
      }
    }
  }, { rootMargin: '800px 0px' })
  for (const card of scrollCards.value) {
    if (card) {
      intersectionObserver.observe(card)
    }
  }
}

async function loadComicPdf() {
  pdfLoading.value = true
  pdfError.value = ''
  try {
    const lib = await loadPdfJs()
    pdfDocument = await lib.getDocument(pdfUrl).promise
    totalPages.value = pdfDocument.numPages
    pdfLoading.value = false
    await nextTick()
    if (readingMode.value === 'paged') {
      setupFlipResizeObserver()
      renderFlipPage()
    }
    else {
      setupIntersectionObserver()
    }
  }
  catch (err) {
    console.error('[wolves] Failed to load comic PDF', err)
    pdfError.value = 'Unable to load the comic book right now. Please try again in a moment.'
    pdfLoading.value = false
  }
}

// Navigation ───────────────────────────────────────────────────────────────
function setPage(n: number) {
  page.value = n
  emit('update:page', n)
}

// Watchers ─────────────────────────────────────────────────────────────────
watch(page, () => {
  if (readingMode.value === 'paged' && !pdfLoading.value) {
    renderFlipPage()
  }
})

watch(activeChapter, (chapter) => {
  if (chapter) {
    emit('chapterChange', chapter.id)
  }
})

watch(readingMode, async (mode) => {
  if (pdfLoading.value || pdfError.value) {
    return
  }
  await nextTick()
  if (mode === 'paged') {
    intersectionObserver?.disconnect()
    setupFlipResizeObserver()
    renderFlipPage()
  }
  else {
    flipResizeObserver?.disconnect()
    setupIntersectionObserver()
  }
})

// Keyboard navigation ──────────────────────────────────────────────────────
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) {
    return
  }

  // Check if focus is inside tablist
  const tablist = document.querySelector('[role="tablist"]') as HTMLElement | null
  const activeElement = document.activeElement as HTMLElement | null
  const isInTablist = tablist && activeElement ? tablist.contains(activeElement) : false

  // Tab switching via Left/Right arrows when focus is inside tablist
  if (isInTablist && (event.key === 'ArrowRight' || event.key === 'Right' || event.key === 'ArrowLeft' || event.key === 'Left')) {
    if (event.key === 'ArrowRight' || event.key === 'Right') {
      readingMode.value = readingMode.value === 'paged' ? 'continuous' : 'paged'
    }
    else if (event.key === 'ArrowLeft' || event.key === 'Left') {
      readingMode.value = readingMode.value === 'continuous' ? 'paged' : 'continuous'
    }
    event.preventDefault()
    // Focus the selected tab after mode changes
    nextTick(() => {
      const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLButtonElement
      selectedTab?.focus()
    })
    return
  }

  // Page navigation via Left/Right arrows when focus is NOT in tablist
  if (isInTablist) {
    return
  }
  if (readingMode.value !== 'paged') {
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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  flipResizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  renderTasks.forEach(task => task.cancel())
  renderTasks.clear()
  pdfDocument?.destroy()
  pdfDocument = null
})
</script>

<template>
  <section id="comic-reader" class="comic-reader-section">
    <div class="comic-toolbar">
      <div role="tablist" class="mode-selectors">
        <button
          id="tab-paged"
          role="tab"
          aria-controls="panel-paged"
          :aria-selected="readingMode === 'paged'"
          @click="readingMode = 'paged'"
        >
          Page By Page
        </button>
        <button
          id="tab-continuous"
          role="tab"
          aria-controls="panel-continuous"
          :aria-selected="readingMode === 'continuous'"
          @click="readingMode = 'continuous'"
        >
          Continuous Scroll
        </button>
      </div>
    </div>

    <!-- Paged mode -->
    <div v-if="readingMode === 'paged'" id="panel-paged" role="tabpanel" aria-labelledby="tab-paged" class="page-flip-comic-layout">
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
            v-show="!pdfLoading && !pdfError"
            ref="flipCanvas"
            class="pdf-page-canvas"
            role="img"
            :aria-label="`Comic page ${page} of ${totalPages}`"
          />
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

      <!-- Bottom control bar -->
      <div class="reader-controls">
        <button
          class="ctrl-btn"
          aria-label="Previous page"
          :disabled="page === 1"
          @click="setPage(page - 1)"
        >
          &larr; Previous
        </button>

        <div class="kbd-hint">
          Use &larr; &rarr; arrow keys to turn pages &middot; Page {{ page }} of {{ totalPages || '—' }}
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

    <!-- Continuous scroll mode -->
    <div v-else id="panel-continuous" ref="scrollContainer" role="tabpanel" aria-labelledby="tab-continuous" class="scroll-comic-layout">
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
          :ref="(el) => setScrollCardRef(el as Element | null, n - 1)"
          class="scroll-page-card"
          :data-page="n"
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
</template>

<style scoped lang="scss">
.comic-toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
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

.scroll-comic-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;

  .comic-viewport {
    max-height: none;
  }

  .comic-content-area {
    overflow: visible;
  }

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
</style>
