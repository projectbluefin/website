<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getQuoteLore } from '../lore'

const props = defineProps<LoreViewProps>()

const quote = computed(() => getQuoteLore(props.record))
const quoteViewportRef = ref<HTMLElement | null>(null)
const typedQuoteText = ref('')
let typewriterTimer: ReturnType<typeof setInterval> | null = null
let scrollPending = false

function clearTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
    typewriterTimer = null
  }
}

function scrollViewport() {
  if (scrollPending) {
    return
  }

  scrollPending = true
  void nextTick(() => {
    const viewport = quoteViewportRef.value
    if (viewport) {
      // Smooth scrolling queues animations faster than the typewriter can
      // finish them, leaving the lore visibly behind. Set the scroll position
      // after layout so every authored beat stays pinned to the latest text.
      viewport.scrollTop = viewport.scrollHeight
    }
    scrollPending = false
  })
}

function runTypewriter() {
  clearTypewriter()
  typedQuoteText.value = ''

  const targetText = quote.value.quote
  const stepTime = Math.max(5, Math.min(50, (props.duration * 700) / targetText.length))
  let index = 0

  typewriterTimer = setInterval(() => {
    index++
    typedQuoteText.value = targetText.slice(0, index)
    // Keep the newest line visible continuously; punctuation-only scrolling
    // leaves long authored sentences stranded below the viewport.
    scrollViewport()

    const currentChar = targetText[index - 1]
    if (currentChar === '.' || currentChar === '?' || currentChar === '!' || currentChar === '…') {
      scrollViewport()
    }

    if (index >= targetText.length) {
      clearTypewriter()
      scrollViewport()
    }
  }, stepTime)
}

function skipTypewriter() {
  clearTypewriter()
  typedQuoteText.value = quote.value.quote

  setTimeout(() => {
    if (quoteViewportRef.value) {
      quoteViewportRef.value.scrollTop = quoteViewportRef.value.scrollHeight
    }
  }, 50)
}

watch(() => props.record, runTypewriter, { immediate: true })

onBeforeUnmount(clearTypewriter)
</script>

<template>
  <section
    id="intercepted-communications"
    class="dispatch-quote-section comic-reader-section"
    data-lore-view-kind="quote"
  >
    <div class="dispatch-quote-card">
      <div ref="quoteViewportRef" class="quote-viewport" @click="skipTypewriter">
        <p v-if="warning" class="thesis-warning">
          {{ warning }}
        </p>
        <Transition name="quote-fade">
          <div :key="record.id" class="conversation-rotator">
            <div class="lore-quote">
              <div class="lore-quote-mark">
                &ldquo;
              </div>
              <p class="lore-quote-text">
                {{ typedQuoteText }}
              </p>
              <div class="lore-quote-meta">
                <strong>{{ quote.attribution }}</strong>
                <span v-if="quote.context" data-lore-quote-context>
                  {{ quote.context }}
                </span>
                <time v-if="quote.date" :datetime="quote.date">
                  {{ quote.date }}
                </time>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.dispatch-quote-section {
  @media (min-width: 1024px) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}

.dispatch-quote-card {
  background-color: #10151f;
  border: 1px solid #272727;
  padding: 16px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  width: 100%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  overflow: hidden;

  @media (min-width: 1024px) {
    flex: 1;
    min-height: 0;
  }

  &:hover {
    border-color: rgba(var(--color-blue-rgb), 0.4);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }
}

.quote-viewport {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 179, 255, 0.3) transparent;
  scroll-behavior: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  .thesis-warning {
    margin: 0 0 18px;
    border-left: 2px solid var(--color-blue-light);
    padding-left: 12px;
    color: #d9f4ff;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 1.3rem;
    font-style: italic;
    line-height: 1.6;
    opacity: 0.8;
    animation: thesis-warning-fade 20s linear forwards;
  }

  @keyframes thesis-warning-fade {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.35;
    }
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(102, 179, 255, 0.3);
    border-radius: 3px;
  }
}

.conversation-rotator {
  position: relative;
  padding-top: 4px;
  padding-right: 4px;
}

.lore-quote {
  min-height: 220px;
  padding: 8px 0 0;
}

.lore-quote-mark {
  color: rgba(var(--color-blue-rgb), 0.28);
  font-family: Georgia, serif;
  font-size: 5rem;
  line-height: 0.6;
  pointer-events: none;
  user-select: none;
}

.lore-quote-text {
  margin: 18px 0 24px;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 1.45rem;
  font-style: italic;
  line-height: 1.55;
}

.lore-quote-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px solid rgba(var(--color-blue-rgb), 0.25);
  padding-top: 14px;
  color: rgba(189, 189, 189, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95rem;
  line-height: 1.45;
}

.lore-quote-meta strong {
  color: var(--color-blue);
  font-size: 1rem;
}

.lore-quote-meta time {
  color: rgba(189, 189, 189, 0.6);
}

.quote-fade-enter-active,
.quote-fade-leave-active {
  transition: opacity 0.5s ease-in-out;
}

.quote-fade-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.quote-fade-enter-from,
.quote-fade-leave-to {
  opacity: 0;
}
</style>
