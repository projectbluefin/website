<script setup lang="ts">
import { onBeforeMount, provide, ref } from 'vue'
import PageLoading from './components/PageLoading.vue'
import ServerDemos from './components/server/ServerDemos.vue'
import ServerDesc from './components/server/ServerDesc.vue'
import ServerDocs from './components/server/ServerDocs.vue'
import ServerTitle from './components/server/ServerTitle.vue'
import ServerVersion from './components/server/ServerVersion.vue'
import TopNavbar from './components/TopNavbar.vue'
import { resolveLocale, setLocale } from './composables/useLocale'

const visibleSection = ref<string>('')
provide('visibleSection', visibleSection)

const baseUrl = import.meta.env.BASE_URL
const nightWallpaper = `url("${baseUrl}evening/august-night.webp")`
const dayWallpaper = `url("${baseUrl}img/wallpapers/bluefin-08-day.webp")`
const dayWordmark = `url("${baseUrl}brands/bluefin-wordmark-light.svg")`
const isLoading = ref(true)
// Toggle states for collapsible boxes
const whyBox1Open = ref(true)
const whyBox2Open = ref(true)
onBeforeMount(() => {
  const artwork = ['karl.webp', 'alamosaurus.webp'].map((name) => {
    const img = new Image()
    img.src = `${baseUrl}characters/${name}`
    return new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })
  })
  Promise.all(artwork).finally(() => {
    setTimeout(() => {
      isLoading.value = false
    }, 100)
  })
})

const urlParams = new URLSearchParams(window.location.search)
const currentLocale = resolveLocale(urlParams.get('lang') || window.navigator.language)
setLocale(currentLocale)
</script>

<template>
  <main class="server-page">
    <PageLoading v-if="isLoading" />
    <TopNavbar v-show="!isLoading" />

    <div v-show="!isLoading" class="server-layout">
      <!-- Centered showcase followed by illustrated field-guide sections. -->
      <div class="col-left-stack">
        <div class="col-left">
          <ServerTitle />
          <ServerDesc />
        </div>
        <div class="col-demos-wrap">
          <div class="col-demos">
            <ServerDemos />
          </div>
        </div>
        <div class="action-widgets">
          <ServerVersion />
          <ServerDocs />
        </div>
        <section class="field-row">
          <div class="field-artwork field-artwork--alamo">
            <img
              class="alamo"
              :src="`${baseUrl}characters/alamosaurus.webp`"
              alt=""
              fetchpriority="high"
              aria-hidden="true"
            >
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
              <li><strong>On Brand.</strong> Working hard to give you Star Trek, it's about useful bling.</li>
            </ul>
          </div>
        </section>

        <section class="field-row field-row--reverse">
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
          <div class="field-artwork field-artwork--karl">
            <img
              class="karl"
              :src="`${baseUrl}characters/karl.webp`"
              alt=""
              fetchpriority="high"
              aria-hidden="true"
            >
          </div>
        </section>

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
            <a class="signatory" href="https://github.com/jeefy" target="_blank" rel="noopener noreferrer">
              <img src="https://github.com/jeefy.png" alt="Jeffrey Sica" loading="lazy">
              <span>Jeffrey Sica</span>
            </a>
          </div>
        </blockquote>

        <blockquote class="little-bluefin">
          <p>Little Bluefin has brought many of you to the world of cloud native. Now meet the real giant. <strong>Infrastructure</strong>. How would cloud native people run their own homelabs? As customizable as you want where it matters, and a fully automated, well tuned machine. Bluefin's natural companion. The building block to your perfect computing setup, all controlled by you. Help us build it!</p>
          <a class="github-star-btn" href="https://github.com/projectbluefin/server" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.09.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
            Star &amp; contribute on GitHub
          </a>
        </blockquote>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.server-page {
  min-height: 100vh;
  color-scheme: dark;
  background: var(--color-bg);
  color: var(--color-text-light);

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: v-bind(nightWallpaper);
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

@media (prefers-color-scheme: light) {
  .server-page {
    --color-bg: #f1f6f8;
    --color-bg-light: #ffffff;
    --color-bg-rgb: 241, 246, 248;
    --color-border: #b4c4ce;
    --color-border-light: #a4b8c5;
    --color-text: #405467;
    --color-text-light: #132b3a;
    --color-blue: #2059ae;
    --color-blue-light: #184985;
    --color-blue-rgb: 32, 89, 174;

    color-scheme: light;

    &::before {
      background-image: v-bind(dayWallpaper);
    }

    .col-left {
      background: rgba(var(--color-bg-rgb), 0.88);
    }

    .quote-box,
    :deep(.release-widget),
    :deep(.server-docs-card) {
      background: rgba(var(--color-bg-rgb), 0.94);
    }

    .quote-box .quote-label {
      opacity: 0.9;
    }

    :deep(.hero-tag strong),
    :deep(.title-subtitle) {
      text-shadow: none;
    }

    .little-bluefin {
      padding: 24px;
      border-radius: 12px;
      background: rgba(var(--color-bg-rgb), 0.94);
    }

    .github-star-btn {
      background: var(--color-blue);

      &:hover {
        background: #184985;
      }
    }

    :deep(.docusaurus-navbar) {
      --ifm-navbar-background-color: #f1f6f8;
      --ifm-navbar-link-color: #132b3a;
      --ifm-navbar-link-hover-color: #2059ae;
    }

    :deep(.navbar__wordmark) {
      content: v-bind(dayWordmark);
    }

    :deep(.navbar__link--active) {
      color: var(--color-blue);
    }

    :deep(.navbar__menu-toggle),
    :deep(.navbar__mobile-menu),
    :deep(.navbar__mobile-link) {
      border-color: var(--color-border);
    }
  }
}

// Preserve the demo's dark UI independently of the surrounding page theme.
.col-demos {
  --color-bg: #0c1016;
  --color-bg-light: #10151f;
  --color-bg-rgb: 12, 16, 22;
  --color-border: #272727;
  --color-border-light: #616161;
  --color-text: #bdbdbd;
  --color-text-light: #ffffff;
  --color-blue: #4285f4;
  --color-blue-light: #8a97f7;
  --color-blue-rgb: 108, 122, 233;

  color-scheme: dark;
}

.server-layout {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
  width: min(100%, 1160px);
  min-width: 0;
}

.col-left,
.col-demos-wrap {
  width: min(calc((100vw - 64px) * 0.65), 960px);

  @media (max-width: 1023px) {
    width: min(calc((100vw - 48px) * 0.65), 960px);
  }

  @media (max-width: 700px) {
    width: 100%;
  }
}

.col-demos-wrap {
  position: relative;
}

.action-widgets {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 24px;
  width: min(100%, 1080px);

  @media (max-width: 1023px) {
    grid-template-columns: minmax(0, 1fr);
    max-width: 760px;
  }
}

.field-row {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  align-items: center;
  gap: 36px;
  width: 100%;

  &--reverse {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  @media (max-width: 1023px) {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 24px;

    &--reverse {
      grid-template-columns: minmax(0, 1fr) 240px;
    }
  }

  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
}

// These boxes trim only the transparent padding measured in the artwork.
.field-artwork {
  position: relative;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  aspect-ratio: var(--art-visible-width) / var(--art-visible-height);

  .alamo,
  .karl {
    position: absolute;
    width: calc(100% * var(--art-source-width) / var(--art-visible-width));
    max-width: none;
    height: auto;
    left: calc(-100% * var(--art-x) / var(--art-visible-width));
    top: calc(-100% * var(--art-y) / var(--art-visible-height));
  }

  &--alamo {
    --art-source-width: 3300;
    --art-visible-width: 1584;
    --art-visible-height: 1913;
    --art-x: 785;
    --art-y: 525;
  }

  &--karl {
    --art-source-width: 1296;
    --art-visible-width: 969;
    --art-visible-height: 951;
    --art-x: 183;
    --art-y: 137;
  }

  @media (max-width: 700px) {
    grid-row: 1;
    justify-self: center;
    width: 230px;
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

.col-left {
  @extend %col-glass;
  justify-content: flex-start;
  gap: 8px;
  background: none;
  backdrop-filter: none;
}

.why-box {
  @extend %col-glass;
  gap: 12px;
  padding: 28px;
  background: rgba(var(--color-bg-rgb), 0.8);
  border: 1px solid var(--color-border-light);

  .why-title {
    cursor: pointer;
    font-size: 2.6rem;
    font-weight: 700;
    color: var(--color-text-light);
    margin: 0;
    transition: color 0.2s;

    &:hover {
      color: var(--color-blue-light);
    }
  }

  .why-list {
    margin: 0 0 6px 0;
    padding-left: 0;
    list-style: none;
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;

    li {
      font-size: 1.6rem;
      line-height: 1.6;
      color: var(--color-text-light);
      padding: 8px 10px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;

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
    background: var(--color-blue);
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
  width: min(100%, 960px);
  padding: 32px;
  border: 1px solid var(--color-border-light);

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
    margin-top: 16px;
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
