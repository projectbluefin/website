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
        </div>
        <div class="col-demos">
          <KnuckleDemos />
        </div>
        <div class="alpha-badge-row">
          <div class="alpha-badge"><strong>⚠️ Beta.</strong> Take appropriate precautions.</div>
        </div>
        <div>
          <KnuckleVersionChips />
        </div>
        <div class="why-box">
          <h2 class="why-title" @click="whyBox1Open = !whyBox1Open">
            Why Bluefin Server?
          </h2>
          <ul v-if="whyBox1Open" class="why-list why-list-grid">
            <li><strong>Sustainability.</strong> Use all of your machines as one cluster, take advantage of everything you own.</li>
            <li><strong>Community Driven.</strong> CNCF Projects have a proven track record of community interaction and commercial vendors.</li>
            <li><strong>Built by Experts for themselves.</strong> This is how we would design our ultimate homelab ourselves, your favorite dinosaur people.</li>
            <li><strong>Common.</strong> Everything you learn here is a real world skill. One that is in high demand.</li>
            <li><strong>Foundational.</strong> Keep it simple or build an automation setup totally run by your own self host models. Sky is the limit.</li>
            <li><strong>On Brand.</strong> Working hard to give you Star Trek, it's about useful bling here, we're trying to show off to our friends.</li>
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
          <a class="github-star-btn" href="https://github.com/projectbluefin/knuckle" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.09.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
            Star &amp; contribute on GitHub
          </a>
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
      padding: 7px 10px;
      border-radius: 6px;
      transition: background 0.2s;

      &:hover {
        background: rgba(var(--color-blue-rgb), 0.2);
      }

      strong {
        color: var(--color-blue-light);
        font-weight: 600;
        letter-spacing: 0.01em;
      }
    }
  }

  .why-list-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    @media (max-width: 1023px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 639px) {
      grid-template-columns: 1fr;
    }

    li {
      margin-bottom: 0;
    }
  }
}

.little-bluefin {
  margin: 15px 30px 30px;
  gap: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
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

.github-star-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 7px;
  font-size: 1.25rem;
  font-weight: 700;
  background: var(--color-bg);
  color: white;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: var(--color-bg-light);
  }
  svg {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
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
