<script setup lang="ts">
import { onBeforeMount, provide, ref } from 'vue'
import KnuckleDemos from './components/knuckle/KnuckleDemos.vue'
import KnuckleTitle from './components/knuckle/KnuckleTitle.vue'
import KnuckleDesc from './components/knuckle/KnuckleDesc.vue'
import KnuckleVersionChips from './components/knuckle/KnuckleVersionChips.vue'
import PageLoading from './components/PageLoading.vue'
import TopNavbar from './components/TopNavbar.vue'
import { setLocale } from './composables/useLocale'
import { i18n } from './locales/schema'

const visibleSection = ref<string>('')
provide('visibleSection', visibleSection)

const baseUrl = import.meta.env.BASE_URL
const isLoading = ref(true)
// Toggle states for collapsible boxes
const whyBox1Open = ref(true)
const whyBox2Open = ref(true)
onBeforeMount(() => {
  const img = new Image()
  img.src = `${baseUrl}characters/karl.webp`
  img.onload = () => setTimeout(() => {
    isLoading.value = false
  }, 100)
  img.onerror = () => {
    isLoading.value = false
  }
})

const urlParams = new URLSearchParams(window.location.search)
const currentLocale = urlParams.get('lang') || window.navigator.language
if (i18n.global.availableLocales.includes(currentLocale)) {
  setLocale(currentLocale)
}
</script>

<template>
  <main class="knuckle-page">
    <PageLoading v-if="isLoading" />
    <TopNavbar v-show="!isLoading" />

    <img
      v-show="!isLoading"
      class="karl"
      :src="`${baseUrl}characters/karl.webp`"
      alt=""
      fetchpriority="high"
      aria-hidden="true"
    >

    <div v-show="!isLoading" class="knuckle-layout">
      <!-- Single column: glass boxes stacked vertically -->
      <div class="col-left-stack">
        <div class="col-left">
          <KnuckleTitle />
          <KnuckleDesc />
          <div class="alpha-badge-row">
            <div class="alpha-badge"><strong>⚠️ Beta.</strong> Take appropriate precautions.</div>
          </div>
        </div>
        <div class="col-demos">
          <KnuckleDemos />
        </div>
        <div>
          <KnuckleVersionChips />
        </div>
        <div class="why-box">
          <h2 class="why-title" @click="whyBox1Open = !whyBox1Open">
            Why Bluefin Server?
          </h2>
          <ul v-if="whyBox1Open" class="why-list">
            <li><strong>Sustainability</strong> — Use all of your machines as one cluster, take advantage of everything you own.</li>
            <li><strong>Community Driven</strong> — CNCF Projects have a proven track record of community interaction and commercial vendors</li>
            <li><strong>Built by Experts for themselves</strong> — This is how we would design our ultimate homelab ourselves, your favorite dinosaur people</li>
            <li><strong>Common</strong> — everything you learn here is a real world skill. One that is in high demand!</li>
            <li><strong>Foundational</strong> — Keep it simple or build an automation setup totally run by your own self host models. Sky's the limit.</li>
            <li><strong>On Brand</strong> — Working hard to give you Star Trek, it's about useful bling here, we're trying to show off to our friends.</li>
          </ul>
        </div>

        <div class="why-box">
          <h2 class="why-title" @click="whyBox2Open = !whyBox2Open">
            One node to start, then scale effortlessly
          </h2>
          <ul v-if="whyBox2Open" class="why-list">
            <li><strong>One config, infinite nodes</strong> — Seamlessly just add nodes, it's all just Kubernetes</li>
            <li><strong>Automatic networking</strong> — Tailscale joins at first boot. No port forwarding.</li>
            <li><strong>Self-healing</strong> — OS and sysexts auto-update. You never patch.</li>
            <li><strong>GPU Support</strong> — NVIDIA configured on your server's GPU, transparently shareable with all of your clients.</li>
            <li><strong>Dashboard from day one</strong> — KubeStellar gives you visibility across your entire cluster.</li>
            <li><strong>Reproducible</strong> — Node die? Rebuild on the fly. It's a cluster — redundancy is built in.</li>
          </ul>
        </div>

        <blockquote class="quote-box">
          <p class="quote-label">
            Mission
          </p>
          <p>We're sysadmins, we work really hard to be lazy. So we took all of our work skills and tools and put together a little toolkit for you. The way we would do it: <a href="https://landscape.cncf.io" target="_blank" rel="noopener noreferrer">CNCF tech stack</a> for the home. Fully automated, the foundation for the best setup because it's designed to build around what you're into. Also, there is a 3-ton <em>Amargasaurus</em> chasing us.</p>
          <p>This is our contribution to training the next generation. Thanks for joining us!</p>
          <div class="quote-signatories">
            <a class="signatory" href="https://github.com/clubanderson" target="_blank" rel="noopener noreferrer">
              <img src="https://github.com/clubanderson.png" alt="Andy Anderson" loading="lazy">
              <span>Andy Anderson</span>
            </a>
            <a class="signatory" href="https://github.com/castrojo" target="_blank" rel="noopener noreferrer">
              <img src="https://github.com/castrojo.png" alt="Jorge Castro" loading="lazy">
              <span>Jorge Castro</span>
            </a>
          </div>
        </blockquote>

        <blockquote class="little-bluefin">
          <p>Little Bluefin has brought many of you to the world of cloud native. Now meet the real giant. <strong>Infrastructure</strong>. How would cloud native people run their own homelabs? As customizable as you want where it matters, and a fully automated, well tuned machine. Bluefin's natural companion. The building block to your perfect computing setup, all controlled by you. Help us build it!</p>
        </blockquote>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.knuckle-page {
  min-height: 100vh;
  background: none;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url('/evening/august-night.webp');
    background-size: cover;
    background-position: center top;
    background-repeat: no-repeat;
    transform: scaleX(-1);
    z-index: 0;
  }

  &::after {
    content: '';
    position: fixed;
    top: 60px;
    left: 0;
    width: 100%;
    height: 400px;
    background: linear-gradient(to bottom, rgb(var(--color-bg-rgb)), transparent);
    z-index: 0;
    pointer-events: none;
  }
}

.knuckle-layout {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 32px 16px;
  gap: 16px;

  @media (max-width: 1023px) {
    padding: 24px 24px 32px;
  }

  @media (max-width: 600px) {
    padding: 16px 12px 32px;
  }
}

.col-left-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 75%;
  min-width: 0;

  @media (max-width: 700px) {
    width: 100%;
  }
}

// Karl: right side, original orientation (faces left, towards content)
.karl {
  position: fixed;
  bottom: -10px;
  right: 0;
  height: 50vh;
  width: auto;
  z-index: 3;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 0 40px rgba(var(--color-blue-rgb), 0.3));
  object-fit: contain;
  object-position: bottom right;

  @media (max-width: 1023px) {
    display: none;
  }
}

%col-glass {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px;
  box-sizing: border-box;
}

.alpha-badge-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

.alpha-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.2rem;
  color: var(--color-text-light);
  background: rgba(var(--color-bg-rgb), 0.5);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 7px 10px;

  strong {
  	font-weight: 600;
  }
}

@media (max-width: 640px) {
  .alpha-badge {
    font-size: 1.1rem;
    padding: 6px 12px;
  }
}

.col-left {
  @extend %col-glass;
  justify-content: flex-start;
  gap: 8px;
  background: none;
  backdrop-filter: none;
}

.col-features {
  @extend %col-glass;
}

.col-right {
  @extend %col-glass;
  justify-content: space-between;
  overflow-y: auto;
  max-height: calc(100vh - 96px);
}

.why-box {
  @extend %col-glass;
  gap: 12px;

  .why-title {
    cursor: pointer;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text-light);
    margin: 0;
    transition: color 0.2s;

    &:hover {
      color: var(--color-blue-light);
    }
  }

  .why-list {
    margin: 0;
    padding-left: 0;
    list-style: none;
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;

    li {
      font-size: 1.6rem;
      line-height: 1.7;
      color: var(--color-text-light);
      padding: 8px 0 8px 16px;
      border-left: 2px solid rgba(var(--color-blue-rgb), 0.3);
      margin-bottom: 6px;

      &:hover {
        border-left-color: rgba(var(--color-blue-rgb), 0.7);
      }

      strong {
        color: var(--color-blue-light);
        font-weight: 600;
        letter-spacing: 0.01em;
      }
    }
  }
}

.little-bluefin {
  margin: 15px 30px 30px;
  gap: 10px;
  p {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.6;
    color: var(--color-text-light);
    opacity: 0.85;
    font-style: italic;
    text-align: center;
  }
  strong {
    font-weight: 600;
  }
}

.quote-box {
  @extend %col-glass;
  margin: 0;
  gap: 10px;

  .quote-label {
    font-size: 1.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text);
    opacity: 0.5;
    margin: 0;
  }

  p {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.6;
    color: var(--color-text-light);
    opacity: 0.85;
    font-style: italic;

    a {
      color: var(--color-text-light);
      text-decoration: underline;
      text-underline-offset: 2px;
      opacity: 0.9;
      &:hover {
        opacity: 1;
      }
    }
  }

  .quote-signatories {
    display: flex;
    gap: 16px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .signatory {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.15s;

    &:hover {
      opacity: 1;
    }

    img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid rgba(var(--color-blue-rgb), 0.3);
    }

    span {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--color-text-light);
    }
  }
}
</style>
