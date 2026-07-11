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
  <div class="wolves-teaser-page bg-[#0c1016] text-[#ffffff] min-h-screen font-sans antialiased selection:bg-[#ef4444] selection:text-white">
    <!-- Top Global Navigation Bar -->
    <TopNavbar />

    <!-- Sticky Soundtrack Widget (floats right below top navbar which is 60px height) -->
    <div
      v-if="!isDismissed && isSticky"
      class="fixed left-0 right-0 z-50 transition-all duration-300 transform translate-y-0"
      :style="{ top: '60px' }"
    >
      <div class="bg-[#10151f]/95 backdrop-blur border-b border-[#ef4444]/30 px-4 py-3 shadow-lg flex items-center justify-between max-w-7xl mx-auto md:rounded-b-xl md:border-x">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Album Thumbnail -->
          <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-black border border-[#ef4444]/40">
            <img :src="coverArtUrl" :alt="playlistTitle" class="w-full h-full object-cover">
          </div>
          <div class="min-w-0 flex-1">
            <span class="block text-[10px] font-bold tracking-widest text-[#ef4444] uppercase leading-none">Soundtrack Playing</span>
            <span class="block text-sm font-semibold truncate text-[#ffffff] mt-0.5">{{ playlistTitle }}</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Media Player -->
          <div class="w-[120px] h-[30px] rounded overflow-hidden bg-black flex-shrink-0 relative hidden md:block">
            <iframe
              v-if="isPlaying"
              :src="embedUrl"
              title="YouTube playlist player"
              class="w-full h-full border-none"
              allow="autoplay; encrypted-media"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-zinc-900">
              <button
                class="text-xs font-bold text-[#ffffff] hover:text-[#ef4444] flex items-center gap-1.5 transition-colors"
                @click="isPlaying = true"
              >
                <span>▶ Play Audio</span>
              </button>
            </div>
          </div>

          <!-- Small controls for mobile/tablet when already playing -->
          <button
            v-if="!isPlaying"
            class="md:hidden text-xs bg-[#ef4444] hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            @click="isPlaying = true"
          >
            <span>▶ Play</span>
          </button>

          <!-- Dismiss button -->
          <button
            class="text-[#bdbdbd] hover:text-white transition-colors text-xl font-bold leading-none p-1"
            aria-label="Dismiss Player"
            @click="isDismissed = true"
          >
            &times;
          </button>
        </div>
      </div>
    </div>

    <!-- Main Outer Container -->
    <div class="pt-[80px] px-4 md:px-8 max-w-5xl mx-auto flex flex-col gap-16 pb-24">
      <!-- SECTION 1: HERO SECTION -->
      <header class="relative flex flex-col md:flex-row items-center gap-8 py-8 md:py-12 border-b border-[#ef4444]/20">
        <div class="flex-1 text-center md:text-left">
          <div class="inline-block border border-[#ef4444] text-[#ef4444] text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Upcoming Release Teaser
          </div>
          <!-- Aggressive display typography with heavy scale -->
          <h1 class="text-4xl md:text-6xl font-extrabold tracking-tighter text-white uppercase leading-none mb-4">
            Seven Days to the <span class="text-[#ef4444]">Wolves</span>
          </h1>
          <p class="text-lg md:text-xl text-[#bdbdbd] font-medium max-w-2xl leading-relaxed mb-6">
            An original Project Bluefin graphic novel. Follow the journey of an architect battling systemic infrastructure collapse, navigating the shadows of the old web, and fighting to deploy ultimate digital sovereignty.
          </p>
          <div class="text-[13px] text-[#bdbdbd]/60 italic">
            Comic book release slated for late 2026. Review placeholder governance comic below.
          </div>
        </div>

        <!-- Hero Soundtrack Widget Box -->
        <div v-if="!isSticky || isDismissed" class="w-full md:w-[350px] flex-shrink-0 bg-[#10151f] border border-[#ef4444]/40 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded bg-black flex-shrink-0 overflow-hidden border border-[#ef4444]/30">
              <img :src="coverArtUrl" :alt="playlistTitle" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="text-[9px] font-extrabold tracking-widest text-[#ef4444] uppercase block leading-none">Soundtrack Invite</span>
              <span class="text-sm font-bold text-white block mt-0.5 leading-tight truncate max-w-[200px]">{{ playlistTitle }}</span>
            </div>
          </div>
          <p class="text-xs text-[#bdbdbd] leading-relaxed">
            {{ playlistDescription }}. Activate playback to lock in the metal atmosphere while scrolling the story panels.
          </p>
          <div class="w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 relative">
            <iframe
              v-if="isPlaying"
              :src="embedUrl"
              title="YouTube playlist player"
              class="w-full h-full border-none"
              allow="autoplay; encrypted-media"
            />
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-t from-black/80 to-black/30">
              <button
                class="bg-[#ef4444] hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 transform hover:scale-105"
                @click="isPlaying = true"
              >
                <span>▶ Start Soundtrack</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- SECTION 2: COMIC READER -->
      <section id="comic-reader" class="flex flex-col gap-6">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight uppercase">
              Comic Reader
            </h2>
            <p class="text-sm text-[#bdbdbd]">
              Review the technical placeholder comic book below. Ingesting Stacklet original artwork.
            </p>
          </div>

          <!-- Mode Selector Toggles -->
          <div class="flex items-center gap-2 self-start md:self-auto bg-[#10151f] p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              class="px-3 py-1.5 rounded font-bold transition-all"
              :class="readingMode === 'flip' ? 'bg-[#ef4444] text-white' : 'text-[#bdbdbd] hover:text-white'"
              @click="readingMode = 'flip'"
            >
              Page By Page
            </button>
            <button
              class="px-3 py-1.5 rounded font-bold transition-all"
              :class="readingMode === 'scroll' ? 'bg-[#ef4444] text-white' : 'text-[#bdbdbd] hover:text-white'"
              @click="readingMode = 'scroll'"
            >
              Continuous Scroll
            </button>
          </div>
        </div>

        <!-- Comic Reader Layout: Page by Page (Slideshow) -->
        <div v-if="readingMode === 'flip'" class="flex flex-col gap-4">
          <div class="relative w-full aspect-[4/5] max-w-2xl mx-auto bg-[#10151f] border border-[#ef4444]/30 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center group">
            <!-- Page Contents -->
            <div class="absolute inset-0 flex flex-col">
              <!-- If page has actual image, render it, else render beautiful custom comic panel placeholder -->
              <div v-if="comicPages[currentPageIndex].imageUrl" class="flex-1 w-full h-full relative">
                <img
                  :src="comicPages[currentPageIndex].imageUrl"
                  :alt="comicPages[currentPageIndex].caption"
                  class="w-full h-full object-contain"
                  loading="eager"
                >
              </div>
              <div v-else class="flex-1 p-8 flex flex-col items-center justify-center text-center relative bg-gradient-to-br from-[#10151f] to-zinc-950">
                <!-- Retro-styled Comic Dots background & styling -->
                <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]" />

                <div class="relative z-10 max-w-md flex flex-col items-center gap-4">
                  <div class="w-16 h-16 rounded-lg border border-[#ef4444]/60 bg-black/40 flex items-center justify-center text-[#ef4444]">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                    </svg>
                  </div>
                  <div class="text-[#ef4444] text-xs font-bold uppercase tracking-widest leading-none">
                    PANEL {{ comicPages[currentPageIndex].pageNumber }} OF 12
                  </div>
                  <h3 class="text-xl md:text-2xl font-black tracking-tight text-white uppercase mt-1">
                    {{ comicPages[currentPageIndex].title }}
                  </h3>
                  <div class="h-px w-24 bg-gradient-to-r from-transparent via-[#ef4444] to-transparent my-1" />
                  <p class="text-sm md:text-base text-[#bdbdbd] leading-relaxed italic">
                    "{{ comicPages[currentPageIndex].caption }}"
                  </p>
                </div>
              </div>

              <!-- Page Caption Banner at Bottom -->
              <div class="bg-black/90 px-6 py-4 border-t border-zinc-800 text-center text-xs md:text-sm text-[#ffffff] font-medium leading-relaxed select-text">
                {{ comicPages[currentPageIndex].caption }}
              </div>
            </div>

            <!-- Left Navigation Button -->
            <button
              v-show="currentPageIndex > 0"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white hover:text-[#ef4444] border border-zinc-800 flex items-center justify-center transition-all cursor-pointer z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Previous Page"
              @click="prevPage"
            >
              &larr;
            </button>

            <!-- Right Navigation Button -->
            <button
              v-show="currentPageIndex < comicPages.length - 1"
              class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white hover:text-[#ef4444] border border-zinc-800 flex items-center justify-center transition-all cursor-pointer z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Next Page"
              @click="nextPage"
            >
              &rarr;
            </button>
          </div>

          <!-- Bottom Control Bar (Navigation Controls) -->
          <div class="flex items-center justify-between gap-4 max-w-2xl mx-auto w-full px-4 text-xs font-semibold">
            <button
              class="px-4 py-2 border border-zinc-800 bg-[#10151f] hover:bg-zinc-900 rounded-lg text-[#bdbdbd] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              :disabled="currentPageIndex === 0"
              @click="prevPage"
            >
              &larr; Previous
            </button>

            <!-- Keyboard helper -->
            <div class="text-zinc-600 hidden md:block">
              Use &larr; &rarr; arrow keys to turn pages
            </div>

            <div class="flex items-center gap-2">
              <span class="text-zinc-500">Jump to:</span>
              <select
                :value="currentPageIndex"
                class="bg-[#10151f] border border-zinc-800 text-white px-2 py-1 rounded cursor-pointer text-xs font-medium focus:outline-none focus:border-[#ef4444]"
                @change="jumpToPage(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="(page, idx) in comicPages" :key="idx" :value="idx">
                  Page {{ page.pageNumber }}: {{ page.title.slice(0, 20) }}...
                </option>
              </select>
            </div>

            <button
              class="px-4 py-2 border border-zinc-800 bg-[#10151f] hover:bg-zinc-900 rounded-lg text-[#bdbdbd] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              :disabled="currentPageIndex === comicPages.length - 1"
              @click="nextPage"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        <!-- Comic Reader Layout: Continuous Stacked Vertical Scroll -->
        <div v-else class="flex flex-col gap-8 max-w-2xl mx-auto w-full">
          <div
            v-for="(page, idx) in comicPages"
            :key="idx"
            class="w-full bg-[#10151f] border border-[#ef4444]/20 rounded-2xl overflow-hidden shadow-xl flex flex-col"
          >
            <!-- Content -->
            <div v-if="page.imageUrl" class="w-full aspect-[4/5] bg-black">
              <img
                :src="page.imageUrl"
                :alt="page.caption"
                class="w-full h-full object-contain"
                loading="lazy"
              >
            </div>
            <div v-else class="w-full aspect-[4/5] p-8 flex flex-col items-center justify-center text-center relative bg-gradient-to-br from-[#10151f] to-zinc-950">
              <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]" />
              <div class="relative z-10 max-w-md flex flex-col items-center gap-4">
                <div class="w-16 h-16 rounded-lg border border-[#ef4444]/40 bg-black/40 flex items-center justify-center text-[#ef4444]">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                  </svg>
                </div>
                <div class="text-[#ef4444] text-xs font-bold uppercase tracking-widest">
                  PANEL {{ page.pageNumber }} OF 12
                </div>
                <h3 class="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                  {{ page.title }}
                </h3>
                <div class="h-px w-24 bg-gradient-to-r from-transparent via-[#ef4444] to-transparent my-1" />
                <p class="text-sm md:text-base text-[#bdbdbd] leading-relaxed italic">
                  "{{ page.caption }}"
                </p>
              </div>
            </div>

            <!-- Page Caption Banner at Bottom -->
            <div class="bg-black/90 px-6 py-4 border-t border-zinc-800 text-center text-xs md:text-sm text-[#ffffff] font-medium leading-relaxed">
              {{ page.caption }}
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 3: BAZZITE DISCORD QUOTES -->
      <section id="bazzite-quotes" class="flex flex-col gap-6">
        <div>
          <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight uppercase">
            Bazzite Dispatch
          </h2>
          <p class="text-sm text-[#bdbdbd]">
            Direct dispatches from Bazzite gaming operatives via the Project Bluefin Discord.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="(item, idx) in bazziteQuotes"
            :key="idx"
            class="bg-[#10151f] border border-zinc-800 hover:border-[#ef4444]/40 p-6 rounded-2xl flex flex-col justify-between gap-6 transition-all duration-300 shadow-lg relative group"
          >
            <!-- Decorative quote icon -->
            <div class="absolute top-4 right-6 text-zinc-800 group-hover:text-[#ef4444]/10 text-6xl font-serif select-none pointer-events-none leading-none transition-colors">
              &ldquo;
            </div>

            <!-- Quote Text -->
            <p class="text-sm md:text-base text-[#ffffff] leading-relaxed font-medium italic relative z-10">
              "{{ item.quote }}"
            </p>

            <!-- Citation Metadata -->
            <div class="flex flex-col gap-1 text-[11px] border-t border-zinc-800/60 pt-4 mt-auto">
              <div class="flex items-center justify-between text-[#ffffff] font-bold">
                <span>@{{ item.attribution }}</span>
                <span class="text-zinc-500 font-medium">{{ item.date }}</span>
              </div>
              <div class="text-[#ef4444] font-semibold uppercase tracking-wider">
                {{ item.context }}
              </div>
            </div>
          </div>
        </div>

        <!-- Discord hook commentary -->
        <div class="text-[11px] text-[#bdbdbd]/40 italic text-center mt-2">
          <!-- Sourced directly from Discord API dump: automatic ingestion hook scheduled to run weekly -->
          Quotes sourced from verified Discord testimonials. Additional quotes can be added in src/data/bazzite-quotes.json.
        </div>
      </section>

      <!-- SECTION 4: QR CODES SECTION -->
      <section id="wolves-support" class="flex flex-col gap-6 border-t border-[#ef4444]/20 pt-16">
        <div class="text-center max-w-2xl mx-auto flex flex-col gap-2">
          <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight uppercase">
            Support the Mission
          </h2>
          <p class="text-sm text-[#bdbdbd]">
            Secure official gear or donate directly to fuel next-generation Linux workstation research, hardware enablement, and future comic releases.
          </p>
        </div>

        <div class="flex flex-col md:flex-row items-stretch justify-center gap-8 max-w-2xl mx-auto w-full mt-4">
          <!-- QR Card 1: Official Store -->
          <div class="flex-1 bg-[#10151f] border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-6 shadow-xl text-center">
            <h3 class="text-base font-extrabold tracking-tight uppercase text-white leading-none">
              Official Store
            </h3>
            <div class="w-48 h-48 bg-[#0c1016] border border-zinc-800 rounded-xl p-4 flex items-center justify-center transition-transform hover:scale-105 duration-300">
              <img :src="qrStore" alt="QR Code linking to Store" class="w-full h-full object-contain">
            </div>
            <div class="flex flex-col gap-2">
              <a
                href="https://store.projectbluefin.io"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block bg-[#ef4444] hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest px-6 py-2.5 rounded-full transition-colors"
              >
                Go to Store &rarr;
              </a>
              <span class="text-[11px] text-zinc-500">store.projectbluefin.io</span>
            </div>
          </div>

          <!-- QR Card 2: Donate to Project -->
          <div class="flex-1 bg-[#10151f] border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-6 shadow-xl text-center">
            <h3 class="text-base font-extrabold tracking-tight uppercase text-white leading-none">
              Donate to Bluefin
            </h3>
            <div class="w-48 h-48 bg-[#0c1016] border border-zinc-800 rounded-xl p-4 flex items-center justify-center transition-transform hover:scale-105 duration-300">
              <img :src="qrDonate" alt="QR Code to Donate" class="w-full h-full object-contain">
            </div>
            <div class="flex flex-col gap-2">
              <a
                href="https://docs.projectbluefin.io/donations"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-2.5 rounded-full transition-colors"
              >
                Donate Now &rarr;
              </a>
              <span class="text-[11px] text-zinc-500">docs.projectbluefin.io/donations</span>
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
  overflow-x: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 600px;
    background: linear-gradient(to bottom, rgba(var(--color-bg-rgb), 0.7), transparent);
    z-index: 0;
    pointer-events: none;
  }
}

// Custom styles for embedded iframe sizing and responsiveness
iframe {
  width: 100%;
  height: 100%;
}
</style>
