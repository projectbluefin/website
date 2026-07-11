<!--
README: Bluefin Wolves Teaser Landing Page Component
===================================================
- Page Path: projectbluefin.io/wolves
- Comic Content: Currently embeds the Stacklet comic (Origin Story) as placeholder.
  To replace this with the real Bluefin comic book, update the `comicPages` array
  below with the new image URLs and captions.
- Discord Quotes: Sourced from `src/data/bazzite-quotes.json`. Add real/new community
  quotes there with fields: quote, attribution, context, date.
- Donate QR Code: Pointing to `https://docs.projectbluefin.io/donations`.
  To change the donation target URL, update `scripts/generate-qrs.js` and re-run.
- Playlist ID in use: `PLA78oiE-RGAE` ("Bluefin: Seven Days to the Wolves" on YouTube).
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import qrDonate from '@/assets/svg/qr-donate.svg'
import qrStore from '@/assets/svg/qr-store.svg'
import TopNavbar from './components/TopNavbar.vue'
import bazziteQuotes from './data/bazzite-quotes.json'

// Comic book pages data structure (Placeholder Stacklet Content)
interface ComicPage {
  pageNumber: number
  imageUrl: string
  caption: string
  title: string
}

const comicPages: ComicPage[] = [
  {
    pageNumber: 1,
    imageUrl: 'https://d17lvj5xn8sco6.cloudfront.net/91/38/3E/69/17/2E/AB/97/4F/D3/03/4C/D5/BC/92/9C/001E9171/cover300.jpg',
    title: 'Cover: Origin Story',
    caption: 'Cloud Governance as Code Comic - Issue #1: Origin Story. Learn about Cloud Governance as Code, Cloud Custodian, and Stacklet in a fun, visual way.',
  },
  {
    pageNumber: 2,
    imageUrl: '', // Will render beautiful comic-styled vector card when empty
    title: 'The Chaos of Manual Governance',
    caption: 'Our hero, a cloud architect, is drowning in alert fatigue, security reports, and astronomical cloud bills. "There has to be a better way to enforce policies than manual spreadsheets!"',
  },
  {
    pageNumber: 3,
    imageUrl: '',
    title: 'Enter Cloud Custodian',
    caption: 'Discovering Cloud Custodian! An open source rules engine that allows developers and operators to write simple, human-readable YAML policies to audit and remediate resources.',
  },
  {
    pageNumber: 4,
    imageUrl: '',
    title: 'Governance as Code',
    caption: 'Defining policies as standard code. Version-controlled in Git, tested in pipelines, and executed automatically across all environments. Infrastructure compliance is finally automated.',
  },
  {
    pageNumber: 5,
    imageUrl: '',
    title: 'The Scaling Hurdle',
    caption: 'As the organization expands from 5 accounts to 500, orchestrating, deploying, and maintaining thousands of Cloud Custodian policies across multi-cloud environments becomes a monumental challenge.',
  },
  {
    pageNumber: 6,
    imageUrl: '',
    title: 'Enter Stacklet Admin',
    caption: 'Stacklet delivers the unified management, deployment, and intelligence plane to run Cloud Custodian at hyperscale, enabling real-time policy enforcement with ease.',
  },
  {
    pageNumber: 7,
    imageUrl: '',
    title: 'Real-time Prevention',
    caption: 'Shift left with real-time prevention. Automatically intercept misconfigured, insecure, or non-compliant resources at the deployment stage, ensuring a robust security posture from day zero.',
  },
  {
    pageNumber: 8,
    imageUrl: '',
    title: 'Continuous Cost Optimization',
    caption: 'Slashing cloud waste automatically. Terminate idle resources, delete orphaned storage volumes, and enforce strict run-schedules to maximize efficiency and stretch budgets.',
  },
  {
    pageNumber: 9,
    imageUrl: '',
    title: 'Collaborative Alignment',
    caption: 'Security, compliance, and engineering teams are aligned on a single, clear source of truth. Security is guardrails, not a gatekeeper, empowering developers to move rapidly.',
  },
  {
    pageNumber: 10,
    imageUrl: '',
    title: 'Burnout Relief',
    caption: 'No more frantic midnight alerts, urgent remediation requests, or blame games. Automated policies run quietly in the background, keeping the infrastructure safe around the clock.',
  },
  {
    pageNumber: 11,
    imageUrl: '',
    title: 'Sovereign Control',
    caption: 'Complete structural visibility. Comprehensive dashboards show live compliance scores, automated savings, and risk vectors, giving leadership absolute peace of mind.',
  },
  {
    pageNumber: 12,
    imageUrl: '',
    title: 'Strategic Triumph',
    caption: 'The cloud architect is celebrated as a visionary. By letting Stacklet handle the enforcement guardrails, the entire engineering team is freed to focus on shipping actual features.',
  },
]

// Soundtrack Widget state
const playlistId = 'PLA78oiE-RGAE'
const embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&rel=0`
const playlistTitle = 'Bluefin: Seven Days to the Wolves'
const playlistDescription = 'The ultimate heavy metal companion soundtrack for reading the Wolves comic'
const coverArtUrl = 'https://i.ytimg.com/vi/LASru9j0oIc/maxresdefault.jpg'

const isPlaying = ref(false)
const isSticky = ref(false)
const isDismissed = ref(false)

// Comic Reader state
const currentPageIndex = ref(0)
const readingMode = ref<'flip' | 'scroll'>('flip') // 'flip' = page-by-page, 'scroll' = stacked vertical

// Watch scroll position for Soundtrack Widget sticky transition
function handleScroll() {
  const scrollTop = window.scrollY
  isSticky.value = scrollTop > 250
}

// Keyboard navigation helper
function handleKeyDown(event: KeyboardEvent) {
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
  if (currentPageIndex.value < comicPages.length - 1) {
    currentPageIndex.value++
  }
}

function prevPage() {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
  }
}

function jumpToPage(index: number) {
  if (index >= 0 && index < comicPages.length) {
    currentPageIndex.value = index
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="wolves-teaser-page">
    <!-- Top Global Navigation Bar -->
    <TopNavbar />

    <!-- Sticky Soundtrack Widget (floats right below top navbar which is 60px height) -->
    <div
      v-if="!isDismissed && isSticky"
      class="sticky-soundtrack-bar"
      :style="{ top: '60px' }"
    >
      <div class="bar-content">
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

          <!-- Dismiss button -->
          <button
            class="close-btn"
            aria-label="Dismiss Player"
            @click="isDismissed = true"
          >
            &times;
          </button>
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
        <div v-if="!isSticky || isDismissed" class="hero-soundtrack-card">
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
            <iframe
              v-if="isPlaying"
              :src="embedUrl"
              title="YouTube playlist player"
              allow="autoplay; encrypted-media"
            />
            <div v-else class="play-overlay">
              <button
                class="play-btn"
                @click="isPlaying = true"
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
              Review the technical placeholder comic book below. Ingesting Stacklet original artwork.
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
          <div class="comic-viewport">
            <!-- Page Contents -->
            <div class="comic-content-area">
              <!-- If page has actual image, render it, else render beautiful custom comic panel placeholder -->
              <div v-if="comicPages[currentPageIndex].imageUrl" class="comic-image-wrap">
                <img
                  :src="comicPages[currentPageIndex].imageUrl"
                  :alt="comicPages[currentPageIndex].caption"
                  loading="eager"
                >
              </div>
              <div v-else class="comic-placeholder-wrap">
                <div class="dots-overlay" />
                <div class="placeholder-content">
                  <div class="placeholder-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                    </svg>
                  </div>
                  <div class="placeholder-tag">
                    PANEL {{ comicPages[currentPageIndex].pageNumber }} OF {{ comicPages.length }}
                  </div>
                  <h3 class="placeholder-title">
                    {{ comicPages[currentPageIndex].title }}
                  </h3>
                  <div class="placeholder-divider" />
                  <p class="placeholder-desc">
                    "{{ comicPages[currentPageIndex].caption }}"
                  </p>
                </div>
              </div>

              <!-- Page Caption Banner at Bottom -->
              <div class="comic-caption-bar select-text">
                {{ comicPages[currentPageIndex].caption }}
              </div>
            </div>

            <!-- Left Navigation Button -->
            <button
              v-show="currentPageIndex > 0"
              class="nav-btn prev"
              aria-label="Previous Page"
              @click="prevPage"
            >
              &larr;
            </button>

            <!-- Right Navigation Button -->
            <button
              v-show="currentPageIndex < comicPages.length - 1"
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
              :disabled="currentPageIndex === 0"
              @click="prevPage"
            >
              &larr; Previous
            </button>

            <!-- Keyboard helper -->
            <div class="kbd-hint">
              Use &larr; &rarr; arrow keys to turn pages
            </div>

            <div class="jump-select-wrap">
              <span>Jump to:</span>
              <select
                :value="currentPageIndex"
                @change="jumpToPage(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="(page, idx) in comicPages" :key="idx" :value="idx">
                  Page {{ page.pageNumber }}: {{ page.title.slice(0, 25) }}...
                </option>
              </select>
            </div>

            <button
              class="ctrl-btn"
              :disabled="currentPageIndex === comicPages.length - 1"
              @click="nextPage"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        <!-- Comic Reader Layout: Continuous Stacked Vertical Scroll -->
        <div v-else class="scroll-comic-layout">
          <div
            v-for="(page, idx) in comicPages"
            :key="idx"
            class="scroll-page-card"
          >
            <!-- Content -->
            <div class="comic-viewport">
              <div class="comic-content-area">
                <div v-if="page.imageUrl" class="comic-image-wrap">
                  <img
                    :src="page.imageUrl"
                    :alt="page.caption"
                    loading="lazy"
                  >
                </div>
                <div v-else class="comic-placeholder-wrap">
                  <div class="dots-overlay" />
                  <div class="placeholder-content">
                    <div class="placeholder-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                      </svg>
                    </div>
                    <div class="placeholder-tag">
                      PANEL {{ page.pageNumber }} OF {{ comicPages.length }}
                    </div>
                    <h3 class="placeholder-title">
                      {{ page.title }}
                    </h3>
                    <div class="placeholder-divider" />
                    <p class="placeholder-desc">
                      "{{ page.caption }}"
                    </p>
                  </div>
                </div>

                <!-- Page Caption Banner at Bottom -->
                <div class="comic-caption-bar">
                  {{ page.caption }}
                </div>
              </div>
            </div>
          </div>
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

        <div class="quotes-grid">
          <div
            v-for="(item, idx) in bazziteQuotes"
            :key="idx"
            class="quote-card"
          >
            <!-- Decorative quote icon -->
            <div class="quote-symbol">
              &ldquo;
            </div>

            <!-- Quote Text -->
            <p class="quote-text">
              "{{ item.quote }}"
            </p>

            <!-- Citation Metadata -->
            <div class="quote-meta">
              <div class="meta-top">
                <span>@{{ item.attribution }}</span>
                <span class="meta-date">{{ item.date }}</span>
              </div>
              <div class="meta-context">
                {{ item.context }}
              </div>
            </div>
          </div>
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
                class="qr-btn red"
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

// Sticky Soundtrack Widget (floating/sticky bar)
.sticky-soundtrack-bar {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 999;
  background-color: rgba(16, 21, 31, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;

  .bar-content {
    max-width: 1012px;
    margin: 0 auto;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .bar-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .bar-thumbnail {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(239, 68, 68, 0.4);
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
  }

  .bar-label {
    display: block;
    font-size: 0.9rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #ef4444;
    line-height: 1;
  }

  .bar-title {
    display: block;
    font-size: 1.3rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .mini-player {
    width: 120px;
    height: 30px;
    border-radius: 4px;
    overflow: hidden;
    background-color: #000;
    border: 1px solid #272727;
  }

  .mini-play-btn {
    background-color: #ef4444;
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 6px 16px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #dc2626;
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: #bdbdbd;
    font-size: 2.2rem;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: color 0.2s;

    &:hover {
      color: #ffffff;
    }
  }
}

// Hero Section
.wolves-hero {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 40px 0;
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);

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
    border: 1px solid #ef4444;
    color: #ef4444;
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
      color: #ef4444;
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
    border: 1px solid rgba(239, 68, 68, 0.4);
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
    border: 1px solid rgba(239, 68, 68, 0.3);
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
    color: #ef4444;
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

  .play-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-btn {
    background-color: #ef4444;
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
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);

    &:hover {
      background-color: #dc2626;
      transform: scale(1.05);
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
      background-color: #ef4444;
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
  aspect-ratio: 4 / 5;
  max-width: 640px;
  margin: 0 auto;
  background-color: #10151f;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;

  .comic-content-area {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .comic-image-wrap {
    flex: 1;
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }

  .comic-placeholder-wrap {
    flex: 1;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: linear-gradient(135deg, #10151f 0%, #080a10 100%);
    position: relative;

    .dots-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.08;
      background-image: radial-gradient(#ef4444 1px, transparent 1px);
      background-size: 16px 16px;
      pointer-events: none;
    }

    .placeholder-content {
      position: relative;
      z-index: 1;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .placeholder-icon {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      border: 1px solid rgba(239, 68, 68, 0.5);
      background-color: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
    }

    .placeholder-tag {
      font-size: 1.1rem;
      font-weight: 800;
      color: #ef4444;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .placeholder-title {
      font-size: 2rem;
      font-weight: 900;
      text-transform: uppercase;
      color: #ffffff;
      margin: 0;
    }

    .placeholder-divider {
      width: 80px;
      height: 2px;
      background: linear-gradient(to right, transparent, #ef4444, transparent);
    }

    .placeholder-desc {
      font-size: 1.4rem;
      line-height: 1.6;
      color: #bdbdbd;
      font-style: italic;
      margin: 0;
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
      color: #ef4444;
      border-color: #ef4444;
    }

    &.prev {
      left: 12px;
    }
    &.next {
      right: 12px;
    }
  }
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
      border-color: #ef4444;
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
        border-color: #ef4444;
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
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }
}

// Bazzite Quotes Section
.quotes-grid {
  display: grid;
  grid-template-cols: 1fr;
  gap: 24px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
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
  transition:
    border-color 0.3s,
    box-shadow 0.3s;

  &:hover {
    border-color: rgba(239, 68, 68, 0.4);
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
    color: rgba(239, 68, 68, 0.1);
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
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
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

    &.red {
      background-color: #ef4444;
      &:hover {
        background-color: #dc2626;
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
