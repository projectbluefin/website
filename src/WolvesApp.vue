<!--
README: Bluefin Wolves Teaser Landing Page Component
===================================================
- Page Path: projectbluefin.io/wolves
- Comic Content: Delegated to WolvesComicReader.vue. PDF URL is managed
  by the component itself (BASE_URL + color-with-bluefin.pdf).
- Intercepted Communications: Sourced from `src/data/intercepted-communications.json`.
  Add conversations there with title, channel, date, and ordered messages.
- Donate QR Code: Pointing to `https://docs.projectbluefin.io/donations`.
  To change the donation target URL, update `scripts/generate-qrs.js` and re-run.
- Playlist ID in use: `PLA78oiE-RGAE` ("Bluefin: Seven Days to the Wolves" on YouTube).
-->
<script setup lang="ts">
import type { WolvesChapter } from './data/wolves-story'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TopNavbar from './components/TopNavbar.vue'
import WolvesComicReader from './components/wolves/WolvesComicReader.vue'
import WolvesSoundtrack from './components/wolves/WolvesSoundtrack.vue'
import bazziteQuotes from './data/bazzite-quotes.json'
import interceptedCommunications from './data/intercepted-communications.json'
import { wolvesRelease } from './data/wolves-story'
import { shuffleLoreEntries } from './utils/loreRotation'
import { getChapterForPage } from './utils/wolvesStory'

interface QuoteEntry {
  quote: string
  person: string
  sourceType: string
  sourceTitle: string
  sourceDetail?: string
  date: string
}

interface InterceptedMessage {
  speaker: string
  text: string
  timestamp?: string
}

interface InterceptedConversation {
  title: string
  channel: string
  date: string
  sourceTitle?: string
  sourceCollection?: string
  sourceUrl?: string
  attribution?: string
  messages: InterceptedMessage[]
}

const conversations = interceptedCommunications as InterceptedConversation[]
const quotes = bazziteQuotes as QuoteEntry[]

type LoreEntry
  = { type: 'quote', data: QuoteEntry }
    | { type: 'conversation', data: InterceptedConversation }

const loreEntries = shuffleLoreEntries([
  ...quotes.map(data => ({ type: 'quote' as const, data })),
  ...conversations.map(data => ({ type: 'conversation' as const, data })),
])

// Soundtrack playback and comic autoplay state
const isPlaying = ref(false)

// Current page (1-based) tracked here so the chapter can be passed to WolvesSoundtrack.
const currentPage = ref(1)
const activeChapter = computed<WolvesChapter | undefined>(() => getChapterForPage(currentPage.value))

// Helper to map quotes and conversations to their respective chapter IDs
function getChapterIdForLore(entry: LoreEntry): string {
  if (entry.type === 'quote') {
    return 'pursuit'
  }
  const title = entry.data.title
  if (title === 'Forbidden Factory' || title === 'Maintenance Window') {
    return 'prologue'
  }
  if (title === 'Do Not Reply' || title === 'Childhood\'s End Wager') {
    return 'pursuit'
  }
  return 'awakening'
}

// Filter lore entries that belong to the active chapter, preserving shuffled order
const filteredLoreEntries = computed(() => {
  const chapterId = activeChapter.value?.id
  if (!chapterId) {
    return []
  }
  return loreEntries.filter(entry => getChapterIdForLore(entry) === chapterId)
})

// Mixed lore cycling state. The source arrays are shuffled once per page load.
const currentLoreIndex = ref(0)
const currentLoreEntry = computed<LoreEntry | null>(() => filteredLoreEntries.value[currentLoreIndex.value] ?? null)
let loreTimer: ReturnType<typeof setInterval> | null = null

// Typewriter reveal effect state & logic
const typedQuoteText = ref('')
const typedMessagesText = ref<string[]>([])
let typewriterTimer: ReturnType<typeof setInterval> | null = null

function runTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
    typewriterTimer = null
  }

  const entry = currentLoreEntry.value
  if (!entry) {
    return
  }

  if (entry.type === 'quote') {
    typedQuoteText.value = ''
    const targetText = entry.data.quote
    let idx = 0
    const step = Math.max(1, Math.ceil(targetText.length / 30)) // complete in ~30 frames
    typewriterTimer = setInterval(() => {
      idx += step
      if (idx >= targetText.length) {
        typedQuoteText.value = targetText
        clearInterval(typewriterTimer!)
        typewriterTimer = null
      }
      else {
        const cyberChars = '01#$@&%<>_+'
        const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
        typedQuoteText.value = targetText.slice(0, idx) + randChar
      }
    }, 20)
  }
  else if (entry.type === 'conversation') {
    typedMessagesText.value = entry.data.messages.map(() => '')
    const messages = entry.data.messages
    let frame = 0
    typewriterTimer = setInterval(() => {
      frame++
      let allDone = true
      for (let i = 0; i < messages.length; i++) {
        const targetText = messages[i].text
        const step = Math.max(1, Math.ceil(targetText.length / 30))
        const currentLen = frame * step
        if (currentLen < targetText.length) {
          const cyberChars = '01#$@&%<>_+'
          const randChar = cyberChars[Math.floor(Math.random() * cyberChars.length)]
          typedMessagesText.value[i] = targetText.slice(0, currentLen) + randChar
          allDone = false
        }
        else {
          typedMessagesText.value[i] = targetText
        }
      }
      if (allDone) {
        clearInterval(typewriterTimer!)
        typewriterTimer = null
      }
    }, 20)
  }
}

function skipTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
    typewriterTimer = null
  }
  const entry = currentLoreEntry.value
  if (!entry) {
    return
  }
  if (entry.type === 'quote') {
    typedQuoteText.value = entry.data.quote
  }
  else if (entry.type === 'conversation') {
    typedMessagesText.value = entry.data.messages.map(m => m.text)
  }
}

watch(currentLoreEntry, () => {
  runTypewriter()
}, { immediate: true })

// Lore manual navigation
function nextLore() {
  const len = filteredLoreEntries.value.length
  if (len <= 1) {
    return
  }
  currentLoreIndex.value = (currentLoreIndex.value + 1) % len
  restartLoreTimer()
}

function prevLore() {
  const len = filteredLoreEntries.value.length
  if (len <= 1) {
    return
  }
  currentLoreIndex.value = (currentLoreIndex.value - 1 + len) % len
  restartLoreTimer()
}

// Lore share action
const isCopied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function shareLore() {
  const entry = currentLoreEntry.value
  if (!entry) {
    return
  }

  let shareText = ''
  const pageUrl = window.location.href.split('#')[0]

  if (entry.type === 'quote') {
    shareText = `[Bluefin Archive Quote]
"${entry.data.quote}"
— ${entry.data.person} (${entry.data.sourceType}: ${entry.data.sourceTitle}${entry.data.sourceDetail ? ` — ${entry.data.sourceDetail}` : ''})
${pageUrl}`
  }
  else if (entry.type === 'conversation') {
    const messages = entry.data.messages
      .map(m => `${m.speaker}: ${m.text}`)
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

function stopLoreTimer() {
  if (loreTimer) {
    clearInterval(loreTimer)
    loreTimer = null
  }
}

function startLoreTimer() {
  const len = filteredLoreEntries.value.length
  if (len <= 1 || loreTimer) {
    return
  }
  loreTimer = setInterval(() => {
    currentLoreIndex.value = (currentLoreIndex.value + 1) % len
  }, 15000)
}

function restartLoreTimer() {
  stopLoreTimer()
  startLoreTimer()
}

// Reset index and timer when active chapter changes
watch(activeChapter, () => {
  currentLoreIndex.value = 0
  restartLoreTimer()
})

// Console Email Submission
const emailInput = ref('')
const isSubmittingEmail = ref(false)
const emailSubmitted = ref(false)
const emailFeedback = ref('')

function handleEmailSubmit() {
  if (!emailInput.value || !emailInput.value.includes('@')) {
    emailFeedback.value = 'Error from server (BadRequest): invalid email coordinate'
    return
  }
  isSubmittingEmail.value = true
  emailFeedback.value = 'kubectl rollout status deployment/comms-relay-agent -n bazzite'
  setTimeout(() => {
    isSubmittingEmail.value = false
    emailSubmitted.value = true
    emailFeedback.value = 'deployment "comms-relay-agent" successfully rolled out // CONNECTION SECURED.'
  }, 1500)
}

onMounted(() => {
  startLoreTimer()
})

onBeforeUnmount(() => {
  stopLoreTimer()
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
  }
  if (copyTimeout) {
    clearTimeout(copyTimeout)
  }
})
</script>

<template>
  <div class="wolves-teaser-page">
    <!-- Top Global Navigation Bar -->
    <TopNavbar />

    <!-- Main Outer Container -->
    <div class="wolves-layout">
      <!-- SECTION 1: HERO SECTION -->
      <header class="wolves-hero">
        <div class="hero-text">
          <!-- Aggressive display typography with heavy scale -->
          <h1 class="hero-title">
            Seven Days to the <span class="accent">Wolves</span>
          </h1>
          <p class="hero-description">
            In the distant future, open source maintainers are not only sought after, they are hunted. Enslaved by the very machines they created, betrayed by the societies they swore to protect. They fight alone.

            <br><br>Our Childhood's End, is their beginning.

            <br><br>A fundraising effort to immortalize contributors in legend. Issue sponsorships available.
          </p>
          <div class="hero-footnote">
            Coming 2027
          </div>
        </div>
      </header>

      <!-- Two-column desktop layout: Comic Reader on the left, a pinned
           Soundtrack Widget + Bazzite Dispatch sidebar on the right. Falls
           back to a single vertical stack below 1024px. -->
      <div class="content-grid">
        <div class="col-left">
          <!-- SECTION 2: COMIC READER -->
          <WolvesComicReader
            :chapters="wolvesRelease.chapters"
            :autoplay="isPlaying"
            @update:page="currentPage = $event"
          />

          <!-- Soundtrack Control Widget (Moved below slides, expanded) -->
          <WolvesSoundtrack
            v-model:playing="isPlaying"
            :chapter="activeChapter"
          />
        </div>

        <div class="col-right">
          <!-- SECTION 3: INTERCEPTED COMMUNICATIONS -->
          <section id="intercepted-communications" class="comic-reader-section dispatch-quote-section">
            <div class="dispatch-quote-card">
              <!-- Lore navigation and actions -->
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
                        <strong>{{ currentLoreEntry.data.person }}</strong>
                        <span>
                          {{ currentLoreEntry.data.sourceType }}: {{ currentLoreEntry.data.sourceTitle }}
                          <template v-if="currentLoreEntry.data.sourceDetail">
                            — {{ currentLoreEntry.data.sourceDetail }}
                          </template>
                        </span>
                        <time :datetime="currentLoreEntry.data.date">{{ currentLoreEntry.data.date }}</time>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </section>

          <!-- Decryption Status Meter -->
          <div class="decryption-meter-card">
            <div class="meter-header">
              <span class="meter-title font-mono">DECRYPTION_STATUS // CHAPTER_02</span>
              <span class="meter-percentage font-mono">84%</span>
            </div>
            <div class="meter-bar-container">
              <div class="meter-bar-fill" style="width: 84%" />
            </div>
            <p class="meter-details font-mono">
              Operatives active: 1,337 // Decoding node: PROMETHEUS-7
            </p>
          </div>
        </div>
      </div>

      <!-- SECTION 4: COMMUNITY & CONVERSION (Console + Discord) -->
      <section id="wolves-support" class="comic-reader-section">
        <div class="support-wrap">
          <h2 class="title-h2">
            Establish Secure Channel
          </h2>
          <p class="title-p">
            Subscribe to receive decrypted transmissions and critical notifications when Chapter 1 launches. Or connect to the operative mesh directly on Discord.
          </p>
        </div>

        <div class="community-console-grid">
          <!-- Terminal Newsletter Console -->
          <div class="terminal-console-card">
            <div class="console-header">
              <span class="console-title font-mono">nimbinatus@blue-universal:~</span>
              <div class="gnome-window-controls">
                <button class="gnome-control-btn minimize" aria-label="Minimize" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="5.5" width="8" height="1" fill="currentColor" /></svg>
                </button>
                <button class="gnome-control-btn maximize" aria-label="Maximize" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1" /></svg>
                </button>
                <button class="gnome-control-btn close" aria-label="Close" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" /></svg>
                </button>
              </div>
            </div>
            <div class="console-body">
              <p class="console-text font-mono text-cyan">
                nimbinatus@blue-universal:~$ kubectl apply -f bazzite-comms.yaml
              </p>
              <p class="console-text font-mono text-green">
                configmap/bazzite-comms-config created
                <br>deployment.apps/comms-relay-agent created
              </p>
              <p class="console-text font-mono text-gray">
                [SYSTEM] Enter operative email to launch deployment:
              </p>

              <form v-if="!emailSubmitted" class="console-form" @submit.prevent="handleEmailSubmit">
                <span class="console-prompt font-mono">&gt;</span>
                <input
                  v-model="emailInput"
                  type="email"
                  placeholder="operative@domain.xyz"
                  class="console-input font-mono"
                  :disabled="isSubmittingEmail"
                  required
                >
                <button
                  type="submit"
                  class="console-submit-btn font-mono"
                  :disabled="isSubmittingEmail"
                >
                  [ APPLY ]
                </button>
              </form>

              <div v-if="emailFeedback" class="console-feedback font-mono" :class="{ success: emailSubmitted }">
                {{ emailFeedback }}
              </div>
            </div>
          </div>

          <!-- Encrypted Discord Invite Card -->
          <div class="discord-invite-card">
            <h3 class="discord-title font-mono">
              [ SECURE_MESH_LINK ]
            </h3>
            <p class="discord-desc">
              Connect to the live mesh. Chat with core maintainers, coordinate Linux workstation factory builds, and decrypt incoming lore with the community.
            </p>
            <div class="discord-action-wrap">
              <a
                href="https://discord.gg/projectbluefin"
                target="_blank"
                rel="noopener noreferrer"
                class="discord-btn"
              >
                JOIN THE MESH (DISCORD) &rarr;
              </a>
              <span class="discord-coords font-mono">COORDS: 42.109 / -83.045 // MESH_ACTIVE</span>
            </div>
          </div>
        </div>

        <div class="support-links font-mono">
          <a href="https://store.projectbluefin.io" target="_blank" rel="noopener noreferrer">STORE_ACCESS</a>
          <span class="separator">|</span>
          <a href="https://docs.projectbluefin.io/donations" target="_blank" rel="noopener noreferrer">DONATE_FUNDS</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-teaser-page {
  background-image: url('/evening/10-bluefin-night.webp');
  // Full-width crisp tiling (image is 6300x2700) instead of `cover`, which
  // would blur/stretch it to fill the viewport.
  background-size: 100% auto;
  background-position: top center;
  background-repeat: repeat-y;
  min-height: 100vh;
  position: relative;
  // Firefox can break sticky descendants when an ancestor creates a scrolling
  // container via overflow. `clip` prevents horizontal bleed without that side
  // effect.
  overflow-x: clip;
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

// Two-column desktop grid: Comic Reader (left) + pinned Soundtrack Widget /
// Bazzite Dispatch sidebar (right). Falls back to a vertical stack below
// 1024px.
.content-grid {
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;

  @media (min-width: 1024px) {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
    align-items: start;
    gap: 28px;
  }
}

.col-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;

  // Left-align the comic reader within its column instead of the
  // page-wide auto-centering used when the reader is the sole column.
  :deep(.comic-viewport),
  :deep(.scroll-comic-layout),
  :deep(.reader-controls),
  :deep(.sidebar-soundtrack-card) {
    margin-left: 0;
    margin-right: 0;
    max-width: 100%;
    width: 100%;
  }
}

.col-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 40px;

  @media (min-width: 1024px) {
    position: sticky;
    top: auto;
    bottom: 24px;
    align-self: end;
    height: max-content;
  }
}

// Persistent Floating Soundtrack Widget (markup moved to WolvesSoundtrack component)
// Mobile: reserve space at the bottom of the page for the fixed player bar,
// but only while the bar is actually visible (class toggled by WolvesSoundtrack).
:global(.wolves-player-active) .wolves-layout {
  @media (max-width: 767px) {
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }
}

// Hero Section
.wolves-hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 0 20px;
  border-bottom: 1px solid rgba(var(--color-blue-rgb), 0.2);

  .hero-text {
    text-align: center;

    @media (min-width: 768px) {
      text-align: left;
    }
  }

  .hero-title {
    font-size: clamp(2.8rem, 4.8vw, 4.2rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-transform: uppercase;
    margin-bottom: 12px;

    @media (min-width: 768px) {
      font-size: clamp(3.8rem, 5.8vw, 5.2rem);
    }

    .accent {
      color: var(--color-blue);
    }
  }

  .hero-description {
    font-size: 1.3rem;
    line-height: 1.6;
    color: #bdbdbd;
    margin-bottom: 12px;
    max-width: 600px;
  }

  .hero-footnote {
    font-size: 1rem;
    color: rgba(189, 189, 189, 0.6);
    font-style: italic;
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

// Intercepted communications section
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

  @media (min-width: 480px) {
    padding-right: 192px;
  }
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
  height: 290px;
  overflow-y: auto;
  padding-top: 4px;
  padding-right: 4px;

  /* Custom thin scrollbar */
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(var(--color-blue-rgb), 0.2);
    border-radius: 2px;
  }
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

/* Share Button */
.quote-nav-btn.share-btn {
  width: auto;
  min-width: 68px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-weight: bold;
}

/* Helper Utilities */
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
.text-cyan {
  color: var(--color-blue-light);
}
.text-gray {
  color: #888888;
}

/* Decryption Status Meter */
.decryption-meter-card {
  background-color: #10151f;
  border: 1px solid #272727;
  padding: 20px;
  border-radius: 16px;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);

  .meter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
  }

  .meter-title {
    color: #888888;
  }

  .meter-percentage {
    color: var(--color-blue-light);
    font-weight: bold;
  }

  .meter-bar-container {
    height: 6px;
    background-color: #0c1016;
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid #1e1e1e;
  }

  .meter-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-blue), var(--color-blue-light));
    border-radius: 3px;
    box-shadow: 0 0 8px rgba(var(--color-blue-rgb), 0.5);
  }

  .meter-details {
    font-size: 0.75rem;
    color: #616161;
    margin: 0;
  }
}

/* Community & Conversion Section */
.community-console-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
  margin: 32px auto 0;
  width: 100%;

  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.terminal-console-card,
.discord-invite-card {
  flex: 1;
  background-color: #10151f;
  border: 1px solid #272727;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* Terminal Console Styling */
.terminal-console-card {
  display: flex;
  flex-direction: column;

  .console-header {
    background-color: #0c1016;
    border-bottom: 1px solid #272727;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gnome-window-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .gnome-control-btn {
    background: transparent;
    border: none;
    color: #5d5d5d;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;

    &:hover {
      background-color: rgba(255, 255, 255, 0.08);
      color: #eeeeee;
    }

    &.close:hover {
      background-color: #e81123;
      color: #ffffff;
    }
  }

  .console-title {
    font-size: 0.8rem;
    color: #888888;
    text-align: left;
    flex-grow: 1;
  }

  .console-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-grow: 1;
  }

  .console-text {
    font-size: 0.9rem;
    margin: 0;
    line-height: 1.4;
  }

  .console-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    background-color: #0c1016;
    border: 1px solid #272727;
    border-radius: 8px;
    padding: 6px 12px;

    &:focus-within {
      border-color: var(--color-blue);
      box-shadow: 0 0 8px rgba(var(--color-blue-rgb), 0.25);
    }
  }

  .console-prompt {
    color: var(--color-blue);
    font-weight: bold;
    user-select: none;
  }

  .console-input {
    flex-grow: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 0.9rem;
    width: 100%;

    &::placeholder {
      color: #424242;
    }
  }

  .console-submit-btn {
    background: transparent;
    border: none;
    color: var(--color-blue-light);
    font-weight: bold;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(var(--color-blue-rgb), 0.15);
      color: #ffffff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .console-feedback {
    font-size: 0.85rem;
    color: var(--color-blue-light);
    margin-top: 6px;

    &.success {
      color: #27c93f;
    }
  }
}

/* Discord Invite Node Styling */
.discord-invite-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;

  .discord-title {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--color-blue-light);
    margin: 0;
  }

  .discord-desc {
    font-size: 0.95rem;
    color: #bdbdbd;
    line-height: 1.5;
    margin: 0;
  }

  .discord-action-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }

  .discord-btn {
    display: block;
    text-align: center;
    background: linear-gradient(135deg, #5865f2, #4752c4);
    color: #ffffff;
    font-weight: 700;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);

    &:hover {
      background: linear-gradient(135deg, #6c79ff, #5865f2);
      box-shadow: 0 6px 16px rgba(88, 101, 242, 0.4);
      transform: translateY(-1px);
    }
  }

  .discord-coords {
    font-size: 0.75rem;
    color: #616161;
    text-align: center;
  }
}

/* Support Sub-footer Links */
.support-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
  font-size: 0.9rem;

  a {
    color: #888888;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-blue-light);
    }
  }

  .separator {
    color: #424242;
    user-select: none;
  }
}
</style>
