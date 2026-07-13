<script setup lang="ts">
import type { WolvesChapter } from '../../data/wolves-story'
import type { WolvesLoreEntry } from './lore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LangLandingBluefinImageURLs } from '../../content'
import { getLoreEntriesForChapter } from './lore'

const props = defineProps<{
  chapter?: WolvesChapter
}>()

const emit = defineEmits<{
  (e: 'copiedStatus', status: boolean): void
  (e: 'firstFinished'): void
}>()

const baseUrl = import.meta.env.BASE_URL

const isCopied = ref(false)

watch(isCopied, (newVal) => {
  emit('copiedStatus', newVal)
})

const filteredLoreEntries = computed(() => getLoreEntriesForChapter(props.chapter))
const currentLoreIndex = ref(0)
const currentLoreEntry = computed<WolvesLoreEntry | null>(() => filteredLoreEntries.value[currentLoreIndex.value] ?? null)

const quoteViewportRef = ref<HTMLElement | null>(null)
const activeMessageIndex = ref(0)
const typedQuoteText = ref('')
const typedMessagesText = ref<string[]>([])
const isInitialQuote = ref(true)
let loreTimer: ReturnType<typeof setTimeout> | null = null
let typewriterTimer: ReturnType<typeof setInterval> | null = null

let copyTimeout: ReturnType<typeof setTimeout> | null = null

function clearTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
    typewriterTimer = null
  }
}

function runTypewriter() {
  clearTypewriter()

  const entry = currentLoreEntry.value
  if (!entry) {
    typedQuoteText.value = ''
    typedMessagesText.value = []
    return
  }

  if (entry.type === 'quote') {
    typedQuoteText.value = ''
    typedMessagesText.value = []
    const targetText = entry.data.quote
    let index = 0

    typewriterTimer = setInterval(() => {
      index++
      if (index >= targetText.length) {
        typedQuoteText.value = targetText
        clearTypewriter()
      }
      else {
        const cyberChars = '01#$@&%<>_+'
        const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
        typedQuoteText.value = targetText.slice(0, index) + randChar
      }
    }, 35)
    return
  }

  typedQuoteText.value = ''
  activeMessageIndex.value = 0
  typedMessagesText.value = entry.data.messages.map(() => '')

  // Track which message index we are currently typing. We type sequentially.
  let currentLength = 0
  let pauseTicks = 0

  typewriterTimer = setInterval(() => {
    if (pauseTicks > 0) {
      pauseTicks--
      return
    }

    if (activeMessageIndex.value >= entry.data.messages.length) {
      clearTypewriter()
      return
    }

    const currentMessage = entry.data.messages[activeMessageIndex.value]
    const targetText = currentMessage.text
    const speaker = currentMessage.speaker
    const isSlowSpeaker = speaker === 'BUR//S' || speaker === 'SARAH'

    // We increment letter by letter for a realistic human typing tempo.
    currentLength++

    if (currentLength <= targetText.length) {
      const cyberChars = '01#$@&%<>_+'
      const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
      typedMessagesText.value[activeMessageIndex.value] = targetText.slice(0, currentLength) + randChar

      const lastChar = targetText[currentLength - 1]

      if (isSlowSpeaker) {
        pauseTicks = 2 // Slower baseline typing speed (3x slower)
        if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
          pauseTicks = 40 // ~1.4 seconds dramatic pause between sentences
        }
        else if (lastChar === '…') {
          pauseTicks = 30 // ~1 second pause for ellipses
        }
        else if (lastChar === ',') {
          pauseTicks = 15 // ~0.5 second pause for commas
        }
      }
      else {
        if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
          pauseTicks = 12 // ~0.4 second normal pause
        }
        else if (lastChar === '…') {
          pauseTicks = 15 // ~0.5 second pause for ellipses
        }
        else if (lastChar === ',') {
          pauseTicks = 5 // ~0.17 second pause for commas
        }
      }
    }
    else {
      typedMessagesText.value[activeMessageIndex.value] = targetText
      // Once a message completes, proceed to the next after a brief pause
      activeMessageIndex.value++
      currentLength = 0
      pauseTicks = isSlowSpeaker ? 50 : 20
    }

    // Auto-scroll
    if (quoteViewportRef.value) {
      quoteViewportRef.value.scrollTop = quoteViewportRef.value.scrollHeight
    }
  }, 35)
}

function skipTypewriter() {
  clearTypewriter()

  const entry = currentLoreEntry.value
  if (!entry) {
    return
  }

  if (entry.type === 'quote') {
    typedQuoteText.value = entry.data.quote
    typedMessagesText.value = []
    return
  }

  activeMessageIndex.value = entry.data.messages.length - 1
  typedMessagesText.value = entry.data.messages.map(message => message.text)

  setTimeout(() => {
    if (quoteViewportRef.value) {
      quoteViewportRef.value.scrollTop = quoteViewportRef.value.scrollHeight
    }
  }, 50)
}

function stopLoreTimer() {
  if (loreTimer) {
    clearTimeout(loreTimer)
    loreTimer = null
  }
}

function getDynamicDelay(entry: WolvesLoreEntry): number {
  let charCount = 0
  if (entry.type === 'quote') {
    charCount = entry.data.quote.length
  }
  else {
    charCount = entry.data.messages.reduce((sum, msg) => sum + msg.text.length, 0)
  }

  // Base reading/pacing buffer: 8000ms
  // Plus 45ms per character (realistic reading pace and typing time)
  // Clamp between 10 seconds and 45 seconds to ensure clean user experience
  const delay = 8000 + charCount * 45
  return Math.max(10000, Math.min(45000, delay))
}

function startLoreTimer() {
  if (filteredLoreEntries.value.length <= 1 || loreTimer) {
    return
  }

  const currentEntry = currentLoreEntry.value
  if (!currentEntry) {
    return
  }

  const isInitial = currentLoreIndex.value === 0 && isInitialQuote.value
  const delay = isInitial ? 28000 : getDynamicDelay(currentEntry)

  loreTimer = setTimeout(() => {
    if (currentLoreIndex.value === 0 && isInitialQuote.value) {
      emit('firstFinished')
    }
    isInitialQuote.value = false
    currentLoreIndex.value = (currentLoreIndex.value + 1) % filteredLoreEntries.value.length
  }, delay)
}

function restartLoreTimer() {
  stopLoreTimer()
  startLoreTimer()
}

function nextLore() {
  if (filteredLoreEntries.value.length <= 1) {
    return
  }

  if (currentLoreIndex.value === 0 && isInitialQuote.value) {
    emit('firstFinished')
  }
  isInitialQuote.value = false
  currentLoreIndex.value = (currentLoreIndex.value + 1) % filteredLoreEntries.value.length
  restartLoreTimer()
}

function prevLore() {
  if (filteredLoreEntries.value.length <= 1) {
    return
  }

  isInitialQuote.value = false
  currentLoreIndex.value = (currentLoreIndex.value - 1 + filteredLoreEntries.value.length) % filteredLoreEntries.value.length
  restartLoreTimer()
}

function shareLore() {
  const entry = currentLoreEntry.value
  if (!entry) {
    return
  }

  const pageUrl = window.location.href.split('#')[0]
  let shareText = ''

  if (entry.type === 'quote') {
    shareText = `[Bluefin Archive Quote]
"${entry.data.quote}"
— ${entry.data.attribution}${entry.data.context ? ` (${entry.data.context})` : ''}${entry.data.date ? `\n${entry.data.date}` : ''}
${pageUrl}`
  }
  else {
    const messages = entry.data.messages
      .map(message => message.isSfx ? `⟪ ${message.text} ⟫` : (message.speaker ? `${message.speaker}: ${message.text}` : message.text))
      .join('\n')
    shareText = `[Bluefin Archive Intercept - ${entry.data.title}]
Channel: ${entry.data.channel} | Date: ${entry.data.date}
${messages}
${pageUrl}`
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    void navigator.clipboard.writeText(shareText).then(() => {
      isCopied.value = true
      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }
      copyTimeout = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    })
  }
  else {
    isCopied.value = true
    if (copyTimeout) {
      clearTimeout(copyTimeout)
    }
    copyTimeout = setTimeout(() => {
      isCopied.value = false
    }, 2000)
  }

  isInitialQuote.value = false
  restartLoreTimer()
}

let firstWatch = true
watch(filteredLoreEntries, () => {
  currentLoreIndex.value = 0
  if (!firstWatch) {
    isInitialQuote.value = false
  }
  firstWatch = false
  restartLoreTimer()
}, { immediate: true })

watch(currentLoreEntry, () => {
  runTypewriter()
  restartLoreTimer()
}, { immediate: true })

const filteredMascots = computed(() => {
  return LangLandingBluefinImageURLs.filter((url) => {
    const filename = url.split('/').pop() || ''
    return !filename.startsWith('aurora') && !filename.includes('jonatan')
  })
})

const mascotIndex = ref(0)
const nextMascotIndex = ref<number | null>(null)
const isMascotTransitioning = ref(false)

let mascotTimer: ReturnType<typeof setInterval> | null = null
let mascotInitialTimeout: ReturnType<typeof setTimeout> | null = null

function rotateMascot() {
  if (filteredMascots.value.length === 0) {
    return
  }
  const nextIdx = (mascotIndex.value + 1) % filteredMascots.value.length
  nextMascotIndex.value = nextIdx
  isMascotTransitioning.value = true
  setTimeout(() => {
    mascotIndex.value = nextIdx
    nextMascotIndex.value = null
    isMascotTransitioning.value = false
  }, 1000)
}

function startMascotRotation() {
  if (mascotTimer || mascotInitialTimeout) {
    return
  }
  mascotInitialTimeout = setTimeout(() => {
    mascotInitialTimeout = null
    rotateMascot()
    mascotTimer = setInterval(rotateMascot, 6000)
  }, 15000)
}

function stopMascotRotation() {
  if (mascotInitialTimeout) {
    clearTimeout(mascotInitialTimeout)
    mascotInitialTimeout = null
  }
  if (mascotTimer) {
    clearInterval(mascotTimer)
    mascotTimer = null
  }
}

const telemetryCpu = ref(14)
const telemetryMem = ref(128)
let telemetryTimer: ReturnType<typeof setInterval> | null = null

function updateTelemetry() {
  // Random fluctuations for the unix stats
  telemetryCpu.value = 10 + Math.floor(Math.random() * 25)
  telemetryMem.value = 120 + Math.floor(Math.random() * 40)
}

onMounted(() => {
  startLoreTimer()

  // Preload all mascots to completely eliminate flashing and decode stutter
  // Since we know the list of filtered mascots, we load them into browser cache
  filteredMascots.value.forEach((m) => {
    const img = new Image()
    img.src = `${baseUrl}${m.replace('./', '')}`
  })

  startMascotRotation()
  telemetryTimer = setInterval(updateTelemetry, 30000)
})

onBeforeUnmount(() => {
  stopLoreTimer()
  stopMascotRotation()
  if (telemetryTimer) {
    clearInterval(telemetryTimer)
    telemetryTimer = null
  }
  clearTypewriter()
  if (copyTimeout) {
    clearTimeout(copyTimeout)
  }
})

defineExpose({
  nextLore,
  prevLore,
  shareLore,
  isCopied,
})
</script>

<template>
  <div class="wolves-lore-column">
    <section id="intercepted-communications" class="dispatch-quote-section comic-reader-section">
      <div class="dispatch-quote-card">
        <div class="dispatch-plan-content">
          <p class="dispatch-plan-command">
            nimbinatus@blue-universal:~$ monitor --archive
          </p>
          <h2 class="title-h2">
            // se7en.days
          </h2>
          <p class="title-p">
            <span class="stat-lbl">CLUSTER:</span> ghost.exo-1.k3s // <span class="stat-lbl">NS:</span> wolves-telemetry // <span class="stat-lbl">REPLICAS:</span> <span class="stat-ok">3/3 READY</span>
            <br><span class="stat-lbl">FACTORY:</span> factory.projectbluefin.io // <span class="stat-lbl">BUILD:</span> <span class="stat-ok">PASS</span>
            <br><span class="stat-lbl">VARIANT:</span> bluefin:testing // <span class="stat-lbl">ARCH:</span> x86_64, aarch64 // <span class="stat-lbl">STATUS:</span> <span class="stat-ok">Active</span>
          </p>
        </div>

        <div ref="quoteViewportRef" class="quote-viewport" @click="skipTypewriter">
          <Transition name="quote-fade">
            <div
              v-if="currentLoreEntry"
              :key="currentLoreIndex"
              class="conversation-rotator"
            >
              <div v-if="currentLoreEntry.type === 'conversation'" class="conversation-heading">
                <span>{{ currentLoreEntry.data.channel }}</span>
                <time :datetime="currentLoreEntry.data.date">{{ currentLoreEntry.data.date }}</time>
              </div>
              <h3 v-if="currentLoreEntry.type === 'conversation'" class="conversation-title">
                {{ currentLoreEntry.data.title }}
              </h3>
              <ol v-if="currentLoreEntry.type === 'conversation'" class="conversation-messages">
                <li
                  v-for="(message, index) in currentLoreEntry.data.messages"
                  v-show="index <= activeMessageIndex"
                  :key="`${currentLoreIndex}-${index}`"
                  class="conversation-message"
                >
                  <div class="conversation-message-header">
                    <span class="conversation-speaker">{{ message.speaker }}</span>
                    <time v-if="message.timestamp">{{ message.timestamp }}</time>
                  </div>
                  <p>{{ typedMessagesText[index] ?? '' }}</p>
                </li>
              </ol>
              <div v-else-if="currentLoreEntry.type === 'quote'" class="lore-quote">
                <div class="lore-quote-mark">
                  &ldquo;
                </div>
                <p class="lore-quote-text">
                  {{ typedQuoteText }}
                </p>
                <div class="lore-quote-meta">
                  <strong>{{ currentLoreEntry.data.attribution }}</strong>
                  <time v-if="currentLoreEntry.data.date" :datetime="currentLoreEntry.data.date">
                    {{ currentLoreEntry.data.date }}
                  </time>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Mascot Rotating Console (circular node) integrated at bottom of card -->
        <div class="mascot-console-hud">
          <div class="mascot-console-ring">
            <div class="mascot-display-area">
              <template v-if="filteredMascots.length > 0">
                <img
                  v-if="nextMascotIndex !== null"
                  :src="`${baseUrl}${filteredMascots[nextMascotIndex].replace('./', '')}`"
                  class="mascot-avatar fading-in"
                  alt="Telemetry Avatar Next"
                >
                <img
                  :src="`${baseUrl}${filteredMascots[mascotIndex].replace('./', '')}`"
                  class="mascot-avatar"
                  :class="{ 'fading-out': isMascotTransitioning }"
                  alt="Telemetry Avatar"
                >
              </template>
            </div>
          </div>
          <div class="mascot-telemetry-text font-mono">
            <span><span class="stat-lbl">POD:</span> wolves-telemetry-controller-7</span>
            <span><span class="stat-lbl">NODE:</span> ip-10-0-1-23.ec2.internal // <span class="stat-lbl">CPU:</span> <span class="stat-warn">{{ telemetryCpu }}m</span> // <span class="stat-lbl">MEM:</span> <span class="stat-warn">{{ telemetryMem }}Mi</span></span>
            <span><span class="stat-lbl">STATUS:</span> <span class="stat-ok">Running</span> // <span class="stat-lbl">UPTIME:</span> 34d 12h // <span class="stat-lbl">RESTART:</span> 0</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.wolves-lore-column {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 1024px) {
    flex: 1;
    min-height: 0;
  }
}

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

.dispatch-plan-content {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  background: linear-gradient(180deg, rgba(16, 21, 31, 0.98) 0%, rgba(12, 16, 22, 0.98) 100%);
  border: 1px solid rgba(var(--color-blue-rgb), 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.dispatch-plan-command {
  margin: 0 0 6px;
  font-size: 0.86rem;
  color: rgba(189, 189, 189, 0.65);
}

.dispatch-plan-content .title-h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #ffffff;
}

.dispatch-plan-content .title-p {
  margin: 6px 0 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(189, 189, 189, 0.9);
}

.stat-lbl {
  color: var(--color-blue-light);
}
.stat-ok {
  color: #4ade80;
}
.stat-warn {
  color: #facc15;
}

.quote-viewport {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-right: 8px;

  /* Scrollbar styles to make it look decent on dark background */
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 179, 255, 0.3) transparent;

  &::-webkit-scrollbar {
    width: 6px;
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

.conversation-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(var(--color-blue-rgb), 0.25);
  padding-bottom: 8px;
  color: var(--color-blue-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
}

.conversation-title {
  margin: 16px 0 20px;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.conversation-messages {
  display: flex;
  flex-direction: column;
  gap: 20px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.conversation-message {
  border-left: 2px solid rgba(var(--color-blue-rgb), 0.45);
  padding-left: 16px;
}

.sfx-message {
  border-left: none;
  padding-left: 0;
  text-align: center;
  margin: 10px 0;
}

.sfx-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  color: var(--color-blue-light);
  font-style: italic;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin: 0;
}

.conversation-message-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
}

.conversation-message-header time {
  color: rgba(189, 189, 189, 0.65);
}

.conversation-message p {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 1.15rem;
  line-height: 1.65;
  white-space: pre-wrap;
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
  font-size: 1.25rem;
  font-style: italic;
  line-height: 1.65;
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

/* Communication transition effects */
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

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

/* Mascot Telemetry Circle Console */
.mascot-console-hud {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 0;
  margin-top: 24px;
  flex-shrink: 0;

  .mascot-console-ring {
    position: relative;
    width: 180px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mascot-display-area {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mascot-avatar {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    top: 0;
    left: 0;
    transition: opacity 1s linear;
    opacity: 0.85;
    will-change: opacity;
    transform: translateZ(0);

    &.fading-out {
      opacity: 0;
    }
    &.fading-in {
      animation: mascotFadeIn 1s linear forwards;
    }
  }

  .mascot-telemetry-text {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: #94a3b8;
    line-height: 1.4;
  }
}

@keyframes mascotFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.85;
  }
}
</style>
