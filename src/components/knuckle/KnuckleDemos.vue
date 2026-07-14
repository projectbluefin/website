<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import KnuckleFeatures from './KnuckleFeatures.vue'
import KnuckleHighlights from './KnuckleHighlights.vue'

const phases: Phase[] = ['cluster', 'cpu', 'storage', 'highlights', 'features']

const baseUrl = import.meta.env.BASE_URL

type Phase = 'cluster' | 'cpu' | 'storage' | 'features' | 'highlights'

const phase = ref<Phase>('cluster')
let timer: ReturnType<typeof setTimeout>
const isHovered = ref(false)

const sequence: Array<{ phase: Phase, duration: number }> = [
  { phase: 'cluster', duration: 5000 },
  { phase: 'cpu', duration: 5000 },
  { phase: 'storage', duration: 5000 },
  { phase: 'highlights', duration: 10000 },
  { phase: 'features', duration: 15000 },
]
let idx = 0

function onHover() {
  isHovered.value = true
  clearTimeout(timer)
}

function onUnhover() {
  isHovered.value = false
  cycle()
}

function cycle() {
  if (!isHovered.value) {
    timer = setTimeout(() => {
      advance()
    }, sequence[idx].duration)
  }
}

function onTabClick(index: number) {
  idx = index
  phase.value = phases[index]
  clearTimeout(timer)
  cycle()
}

function advance() {
  clearTimeout(timer)
  idx = (idx + 1) % sequence.length
  phase.value = sequence[idx].phase
  cycle()
}

/* ── Drag-to-scroll ── */
const innerEl = ref<HTMLElement | null>(null)
const isDragging = ref(false)
let dragStartY = 0
let dragStartScrollTop = 0

function onDragStart(e: MouseEvent) {
  if (e.button !== 0) {
    return
  }
  isDragging.value = true
  dragStartY = e.clientY
  dragStartScrollTop = innerEl.value?.scrollTop ?? 0
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) {
    return
  }
  const dy = e.clientY - dragStartY
  if (innerEl.value) {
    innerEl.value.scrollTop = dragStartScrollTop - dy
  }
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

onMounted(() => cycle())
onUnmounted(() => {
  clearTimeout(timer)
  onDragEnd()
})

const tabLabels: Record<Phase, string> = {
  cluster: 'Cluster',
  cpu: 'Nodes',
  storage: 'Storage',
  highlights: 'Highlights',
  features: 'Features',
}

const urlMap: Record<Phase, string> = {
  cluster: 'vanguard.local/cluster',
  cpu: 'vanguard.local/nodes',
  storage: 'vanguard.local/storage',
  features: 'vanguard.local/features',
  highlights: 'vanguard.local/highlights',
}
</script>

<template>
  <section class="knuckle-demos">
    <div class="demo-window">
      <div class="browser-bar">
        <div class="browser-spacer" />
        <div class="browser-url">
          <span class="browser-url-text">{{ urlMap[phase] }}</span>
        </div>
        <button class="hb-min-btn" aria-label="Minimize" tabindex="-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
        <button class="hb-max-btn" aria-label="Maximize" tabindex="-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
        </button>
        <button class="hb-close-btn" aria-label="Close" tabindex="-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="tabs-container">
        <button
          v-for="(p, index) in phases"
          :key="p"
          :class="{ active: phase === p }"
          @click="onTabClick(index)"
          @mouseenter="onHover"
          @mouseleave="onUnhover"
        >
          {{ tabLabels[p] }}
        </button>
      </div>

      <transition name="fade" mode="out-in">
        <div :key="phase" class="img-wrap" @mouseenter="onHover" @mouseleave="onUnhover">
          <template v-if="phase === 'cluster' || phase === 'cpu' || phase === 'storage'">
            <img
              v-if="phase === 'cluster'"
              :src="`${baseUrl}bluespeed-cluster.png`"
              alt="Bluespeed cluster overview"
            >
            <img
              v-else-if="phase === 'cpu'"
              :src="`${baseUrl}bluespeed-cpu.png`"
              alt="Bluespeed node metrics"
            >
            <img
              v-else
              :src="`${baseUrl}bluespeed-storage.png`"
              alt="Bluespeed storage"
            >
          </template>

          <template v-else>
            <div
              ref="innerEl"
              class="img-wrap-inner"
              :class="{ 'is-dragging': isDragging }"
              @mousedown="onDragStart"
            >
              <div style="padding: 8px">
                <KnuckleHighlights v-if="phase === 'highlights'" />
                <KnuckleFeatures v-else-if="phase === 'features'" />
              </div>
            </div>
          </template>
        </div>
      </transition>
    </div>
  </section>
</template>

<style scoped lang="scss">
.knuckle-demos {
  width: 100%;
}

.demo-window {
  border-radius: 12px;
  overflow: hidden;
  background: #1d1d20;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 8px 24px rgba(0, 0, 0, 0.5),
    0 20px 48px rgba(0, 0, 0, 0.3);
}

/* ── Browser chrome ── */
.browser-bar {
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 6px;
  background: #303030;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
  user-select: none;
  gap: 4px;
}

.browser-spacer {
  width: 82px;
  flex-shrink: 0;

  @media (max-width: 640px) {
    display: none;
  }
}

.browser-url {
  flex: 1;
  display: flex;
  justify-content: center;
}

.browser-url-text {
  font-family: Inter, system-ui, sans-serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.07);
  border: none;
  border-radius: 6px;
  padding: 8px 0;
  width: 300px;
  text-align: center;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  @media (max-width: 640px) {
    width: 220px;
  }
}

/* ── Tabs ── */
.tabs-container {
  display: flex;
  gap: 0;
  padding: 0 12px 6px;
  background: #303030;

  button {
    flex: 1;
    height: 30px;
    border: none;
    background: #303030;
    color: rgba(255, 255, 255, 0.85);
    font-family: Inter, system-ui, sans-serif;
    font-size: 1.2rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px;
    padding: 0 8px;
    position: relative;
    transition:
      background 0.2s ease,
      color 0.2s ease;
    white-space: nowrap;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background: rgba(var(--color-blue-rgb), 0.15);
      color: var(--color-blue-light);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 25%;
      height: 50%;
      width: 1px;
      background: rgba(255, 255, 255, 0.12);
      pointer-events: none;
    }

    &:first-child::before,
    &.active::before {
      display: none;
    }
  }

  // Hide separator on button directly after active tab
  @at-root {
    #{&} button.active + button::before {
      display: none;
    }
  }
}

.hb-min-btn,
.hb-max-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: default;
  padding: 0;
  transition:
    background 0.1s,
    color 0.1s;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }

  svg {
    display: block;
  }

  @media (max-width: 640px) {
    display: none;
  }
}

.hb-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: default;
  padding: 0;
  margin-left: 2px;
  transition:
    background 0.1s,
    color 0.1s;

  &:hover {
    background: #c01c28;
    color: #fff;
  }

  svg {
    display: block;
  }

  @media (max-width: 640px) {
    display: none;
  }
}

/* ── Image container ── */
.img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #1d1d20;
  overflow: hidden;

  .img-wrap-inner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    cursor: grab;
    user-select: none;

    &::-webkit-scrollbar {
      display: none;
    }

    &.is-dragging {
      cursor: grabbing;
    }

    // Scroll shadows: background-attachment scroll/local auto-hides at edges
    background:
      linear-gradient(to bottom, #1d1d20 70%, transparent) top / 100% 50px no-repeat local,
      linear-gradient(to top, #1d1d20 70%, transparent) bottom / 100% 50px no-repeat local,
      linear-gradient(to bottom, rgba(0, 0, 0, 0.4), transparent) top / 100% 30px no-repeat scroll,
      linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent) bottom / 100% 30px no-repeat scroll;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 1;
    transition: opacity 0.15s ease;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
