<script setup lang="ts">
import type { WolvesLoreEntry } from './lore'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LangLandingBluefinImageURLs } from '../../content'
import { loreEntries } from './lore'

const props = defineProps<{
  artifactId: string
  duration: number
  warning?: string
}>()

const baseUrl = import.meta.env.BASE_URL

const currentLoreEntry = computed<WolvesLoreEntry | null>(() =>
  loreEntries.find(entry => entry.id === props.artifactId) ?? null,
)

const quoteViewportRef = ref<HTMLElement | null>(null)
const activeMessageIndex = ref(0)
const typedQuoteText = ref('')
const typedMessagesText = ref<string[]>([])
const climaxMessageIndex = ref<number | null>(null)
const revealedClimaxSentence = ref('')
let typewriterTimer: ReturnType<typeof setInterval> | null = null
let scrollPending = false

const CLIMAX_ARTIFACT_ID = 'lorem-pursuit-1'
const CLIMAX_SPEAKER = 'BUR//S'
const CLIMAX_HOLD_MS = 3000
const CLIMAX_FADE_MS = 1000

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
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      })
    }
    scrollPending = false
  })
}

function runTypewriter() {
  clearTypewriter()

  const entry = currentLoreEntry.value
  if (!entry) {
    typedQuoteText.value = ''
    typedMessagesText.value = []
    return
  }

  let stepTime = 35

  if (entry.type === 'quote') {
    typedQuoteText.value = ''
    typedMessagesText.value = []
    const targetText = entry.data.quote

    stepTime = Math.max(5, Math.min(50, (props.duration * 700) / targetText.length))

    let index = 0

    typewriterTimer = setInterval(() => {
      index++
      typedQuoteText.value = targetText.slice(0, index)

      const currentChar = targetText[index - 1]
      if (currentChar === '.' || currentChar === '?' || currentChar === '!' || currentChar === '…') {
        scrollViewport()
      }

      if (index >= targetText.length) {
        clearTypewriter()
      }
    }, stepTime)
    return
  }

  typedQuoteText.value = ''
  activeMessageIndex.value = 0
  typedMessagesText.value = entry.data.messages.map(() => '')
  climaxMessageIndex.value = entry.id === CLIMAX_ARTIFACT_ID
    ? entry.data.messages.findIndex(message => message.speaker === CLIMAX_SPEAKER)
    : null
  revealedClimaxSentence.value = ''

  {
    const D = props.duration * 1000
    const climaxCueDuration = entry.id === CLIMAX_ARTIFACT_ID
      ? CLIMAX_HOLD_MS + CLIMAX_FADE_MS
      : 0
    let totalTicks = 0
    entry.data.messages.forEach((message) => {
      const isSlow = message.speaker === 'BUR//S' || message.speaker === 'SARAH'
      totalTicks += message.text.length
      const text = message.text
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (char === '.' || char === '?' || char === '!') {
          totalTicks += isSlow ? 40 : 12
        }
        else if (char === '…') {
          totalTicks += isSlow ? 30 : 15
        }
        else if (char === ',') {
          totalTicks += isSlow ? 15 : 5
        }
      }
      totalTicks += isSlow ? 50 : 20
    })
    stepTime = Math.max(5, Math.min(50, Math.max(0, D * 0.7 - climaxCueDuration) / totalTicks))
  }

  // Track which message index we are currently typing. We type sequentially.
  let currentLength = 0
  let pauseTicks = 0
  let climaxStage: 'typing' | 'holding' | 'fading' = 'typing'

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
    const isClimaxMessage = activeMessageIndex.value === climaxMessageIndex.value
    const climaxOpeningEnd = targetText.indexOf('. ') + 2

    if (isClimaxMessage && climaxStage === 'holding') {
      revealedClimaxSentence.value = targetText.slice(climaxOpeningEnd)
      climaxStage = 'fading'
      pauseTicks = Math.ceil(CLIMAX_FADE_MS / stepTime)
      return
    }

    if (isClimaxMessage && climaxStage === 'fading') {
      scrollViewport()
      activeMessageIndex.value++
      currentLength = 0
      return
    }

    // We increment letter by letter for a realistic human typing tempo.
    currentLength++

    if (currentLength <= targetText.length) {
      typedMessagesText.value[activeMessageIndex.value] = targetText.slice(0, currentLength)

      if (isClimaxMessage && currentLength === climaxOpeningEnd) {
        climaxStage = 'holding'
        pauseTicks = Math.ceil(CLIMAX_HOLD_MS / stepTime)
        return
      }

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
      scrollViewport()
      // Once a message completes, proceed to the next after a brief pause
      activeMessageIndex.value++
      currentLength = 0
      pauseTicks = isSlowSpeaker ? 50 : 20
    }
  }, stepTime)
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

watch(currentLoreEntry, () => {
  runTypewriter()
}, { immediate: true })

const filteredMascots = computed(() => {
  return LangLandingBluefinImageURLs.filter((url) => {
    const filename = url.split('/').pop() || ''
    return !filename.startsWith('aurora') && !filename.includes('jonatan')
  })
})

const mascotIndex = ref(0)
const nextMascotIndex = ref(0)
const isMascotTransitioning = ref(false)

let mascotTimer: ReturnType<typeof setInterval> | null = null
let mascotInitialTimeout: ReturnType<typeof setTimeout> | null = null

async function rotateMascot() {
  if (filteredMascots.value.length === 0) {
    return
  }
  const nextIdx = (mascotIndex.value + 1) % filteredMascots.value.length
  nextMascotIndex.value = nextIdx
  await nextTick()
  isMascotTransitioning.value = true
  setTimeout(() => {
    mascotIndex.value = nextIdx
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
  stopMascotRotation()
  if (telemetryTimer) {
    clearInterval(telemetryTimer)
    telemetryTimer = null
  }
  clearTypewriter()
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
          <p v-if="warning" class="thesis-warning">
            {{ warning }}
          </p>
          <Transition name="quote-fade">
            <div
              v-if="currentLoreEntry"
              :key="currentLoreEntry.id"
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
                  :key="`${currentLoreEntry.id}-${index}`"
                  class="conversation-message"
                  :class="{ 'sfx-message': message.isSfx }"
                >
                  <p v-if="message.isSfx" class="sfx-text">
                    {{ typedMessagesText[index] ?? '' }}
                  </p>
                  <template v-else>
                    <div class="conversation-message-header">
                      <span class="conversation-speaker">{{ message.speaker }}</span>
                      <time v-if="message.timestamp">{{ message.timestamp }}</time>
                    </div>
                    <p>
                      {{ typedMessagesText[index] ?? '' }}
                      <Transition name="climax-fade">
                        <span
                          v-if="index === climaxMessageIndex && revealedClimaxSentence"
                          class="climax-sentence"
                        >{{ revealedClimaxSentence }}</span>
                      </Transition>
                    </p>
                  </template>
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
                  :src="`${baseUrl}${filteredMascots[mascotIndex].replace('./', '')}`"
                  class="mascot-avatar mascot-avatar-current"
                  :class="{ 'is-fading-out': isMascotTransitioning }"
                  alt="Telemetry Avatar"
                >
                <img
                  :src="`${baseUrl}${filteredMascots[nextMascotIndex].replace('./', '')}`"
                  class="mascot-avatar mascot-avatar-next"
                  :class="{ 'is-fading-in': isMascotTransitioning }"
                  alt="Telemetry Avatar Next"
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

.climax-sentence {
  display: inline;
}

.climax-fade-enter-active {
  transition: opacity 1s linear;
}

.climax-fade-enter-from {
  opacity: 0;
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

    &.mascot-avatar-next,
    &.is-fading-out {
      opacity: 0;
    }
    &.mascot-avatar-next.is-fading-in {
      opacity: 0.85;
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
</style>
