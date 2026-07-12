<script setup lang="ts">
import type { WolvesChapter } from '../../data/wolves-story'
import type { WolvesLoreEntry } from './lore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatQuoteSource, getLoreEntriesForChapter } from './lore'

const props = defineProps<{
  chapter?: WolvesChapter
}>()

const filteredLoreEntries = computed(() => getLoreEntriesForChapter(props.chapter))
const currentLoreIndex = ref(0)
const currentLoreEntry = computed<WolvesLoreEntry | null>(() => filteredLoreEntries.value[currentLoreIndex.value] ?? null)

const typedQuoteText = ref('')
const typedMessagesText = ref<string[]>([])
let loreTimer: ReturnType<typeof setInterval> | null = null
let typewriterTimer: ReturnType<typeof setInterval> | null = null

const isCopied = ref(false)
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
    const step = Math.max(1, Math.ceil(targetText.length / 30))

    typewriterTimer = setInterval(() => {
      index += step
      if (index >= targetText.length) {
        typedQuoteText.value = targetText
        clearTypewriter()
      }
      else {
        const cyberChars = '01#$@&%<>_+'
        const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
        typedQuoteText.value = targetText.slice(0, index) + randChar
      }
    }, 20)
    return
  }

  typedQuoteText.value = ''
  typedMessagesText.value = entry.data.messages.map(() => '')
  let frame = 0

  typewriterTimer = setInterval(() => {
    frame++
    let allDone = true

    for (let index = 0; index < entry.data.messages.length; index++) {
      const targetText = entry.data.messages[index].text
      const step = Math.max(1, Math.ceil(targetText.length / 30))
      const currentLength = frame * step
      if (currentLength < targetText.length) {
        const cyberChars = '01#$@&%<>_+'
        const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
        typedMessagesText.value[index] = targetText.slice(0, currentLength) + randChar
        allDone = false
      }
      else {
        typedMessagesText.value[index] = targetText
      }
    }

    if (allDone) {
      clearTypewriter()
    }
  }, 20)
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

  typedMessagesText.value = entry.data.messages.map(message => message.text)
}

function stopLoreTimer() {
  if (loreTimer) {
    clearInterval(loreTimer)
    loreTimer = null
  }
}

function startLoreTimer() {
  if (filteredLoreEntries.value.length <= 1 || loreTimer) {
    return
  }

  loreTimer = setInterval(() => {
    currentLoreIndex.value = (currentLoreIndex.value + 1) % filteredLoreEntries.value.length
  }, 15000)
}

function restartLoreTimer() {
  stopLoreTimer()
  startLoreTimer()
}

function nextLore() {
  if (filteredLoreEntries.value.length <= 1) {
    return
  }

  currentLoreIndex.value = (currentLoreIndex.value + 1) % filteredLoreEntries.value.length
  restartLoreTimer()
}

function prevLore() {
  if (filteredLoreEntries.value.length <= 1) {
    return
  }

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
      .map(message => `${message.speaker}: ${message.text}`)
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

  restartLoreTimer()
}

watch(filteredLoreEntries, () => {
  currentLoreIndex.value = 0
  restartLoreTimer()
}, { immediate: true })

watch(currentLoreEntry, () => {
  runTypewriter()
}, { immediate: true })

onMounted(() => {
  startLoreTimer()
})

onBeforeUnmount(() => {
  stopLoreTimer()
  clearTypewriter()
  if (copyTimeout) {
    clearTimeout(copyTimeout)
  }
})
</script>

<template>
  <div class="wolves-lore-column">
    <section id="intercepted-communications" class="dispatch-quote-section comic-reader-section">
      <div class="dispatch-quote-card">
        <div class="quote-nav">
          <button
            class="quote-nav-btn share-btn font-mono"
            :aria-label="isCopied ? 'Transcript copied' : 'Share transcript'"
            type="button"
            @click="shareLore"
          >
            {{ isCopied ? 'COPIED!' : 'SHARE' }}
          </button>
          <button
            class="quote-nav-btn prev"
            aria-label="Previous transcript"
            type="button"
            @click="prevLore"
          >
            &larr;
          </button>
          <button
            class="quote-nav-btn next"
            aria-label="Next transcript"
            type="button"
            @click="nextLore"
          >
            &rarr;
          </button>
        </div>

        <div class="dispatch-plan-content">
          <p class="dispatch-plan-command">
            nimbinatus@blue-universal:~$ monitor --archive
          </p>
          <h2 class="title-h2">
            Recovered Transmissions
          </h2>
          <p class="title-p">
            Signal: Captured
            <br>Source: Quotes + Intercepts
            <br>Rotation: Randomized on load
          </p>
        </div>

        <div class="quote-viewport" @click="skipTypewriter">
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
              <div
                v-if="currentLoreEntry.type === 'conversation' && currentLoreEntry.data.sourceTitle"
                class="conversation-source"
              >
                <span>{{ currentLoreEntry.data.attribution ?? 'ARCHIVE REFERENCE' }}</span>
                <a
                  v-if="currentLoreEntry.data.sourceUrl"
                  :href="currentLoreEntry.data.sourceUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ currentLoreEntry.data.sourceCollection ?? 'SOURCE' }}:
                  {{ currentLoreEntry.data.sourceTitle }}
                </a>
                <span v-else>
                  {{ currentLoreEntry.data.sourceCollection ?? 'SOURCE' }}:
                  {{ currentLoreEntry.data.sourceTitle }}
                </span>
              </div>
              <div v-else-if="currentLoreEntry.type === 'quote'" class="lore-quote">
                <div class="lore-quote-mark">
                  &ldquo;
                </div>
                <p class="lore-quote-text">
                  {{ typedQuoteText }}
                </p>
                <div class="lore-quote-meta">
                  <strong>{{ currentLoreEntry.data.attribution }}</strong>
                  <span v-if="formatQuoteSource(currentLoreEntry.data)">
                    {{ formatQuoteSource(currentLoreEntry.data) }}
                  </span>
                  <time v-if="currentLoreEntry.data.date" :datetime="currentLoreEntry.data.date">
                    {{ currentLoreEntry.data.date }}
                  </time>
                </div>
              </div>
            </div>
          </Transition>
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
  }
}

.dispatch-quote-section {
  @media (min-width: 1024px) {
    flex: 1;
    display: flex;
    flex-direction: column;
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

  @media (min-width: 1024px) {
    flex: 1;
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

.quote-viewport {
  position: relative;
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
}

.conversation-source {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid rgba(var(--color-blue-rgb), 0.25);
  margin-top: 20px;
  padding-top: 12px;
  color: rgba(189, 189, 189, 0.62);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.78rem;
  line-height: 1.45;
}

.conversation-source a {
  color: var(--color-blue);
  text-decoration: underline;
  text-decoration-color: rgba(var(--color-blue-rgb), 0.4);
  text-underline-offset: 3px;
}

.conversation-source a:hover {
  color: var(--color-blue-light);
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

.quote-nav {
  display: flex;
  gap: 8px;
  z-index: 3;

  @media (max-width: 479px) {
    position: static;
    margin-bottom: 12px;
    justify-content: flex-end;
  }

  @media (min-width: 480px) {
    position: absolute;
    top: 24px;
    right: 24px;
  }
}

.quote-nav-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-blue-rgb), 0.45);
  background-color: #10151f;
  color: var(--color-blue-light);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(var(--color-blue-rgb), 0.15);
    border-color: var(--color-blue-light);
    color: #ffffff;
  }
}

.quote-nav-btn.share-btn {
  width: auto;
  min-width: 68px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-weight: bold;
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

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
