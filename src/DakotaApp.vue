<script setup lang="ts">
import { IconGithubCircle } from '@iconify-prerendered/vue-mdi'
import { onBeforeMount, provide, ref } from 'vue'
import DakotaHighlights from './components/dakota/DakotaHighlights.vue'
import DakotaScene from './components/dakota/DakotaScene.vue'
import DakotaVersionCard from './components/dakota/DakotaVersionCard.vue'
import PageLoading from './components/PageLoading.vue'
import TopNavbar from './components/TopNavbar.vue'
import { setLocale } from './composables/useLocale'
import { i18n } from './locales/schema'

const visibleSection = ref<string>('')
provide('visibleSection', visibleSection)

const isLoading = ref(true)
onBeforeMount(() => {
  const img = new Image()
  img.src = '/characters/dakota.webp'
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
  <main class="dakota-page">
    <PageLoading v-if="isLoading" />
    <TopNavbar v-show="!isLoading" />

    <div v-show="!isLoading" class="dakota-layout">
      <!-- Left: text, video, highlights -->
      <div class="col-left">
        <DakotaScene />
        <div class="video-wrap">
          <iframe
            src="https://www.youtube.com/embed/v18c8ipK02A"
            title="Dakota"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>
        <div class="release-links">
          <span>Read the announcements:</span>
          <div class="release-link-item">
            <a
              href="https://docs.projectbluefin.io/blog/making-our-own-fate/"
              target="_blank"
              rel="noopener noreferrer"
            >Alpha 2 Release →</a>
            <a
              href="https://docs.projectbluefin.io/blog/dakota-alpha-1/"
              target="_blank"
              rel="noopener noreferrer"
            >Alpha 1 Release →</a>
          </div>
        </div>
        <DakotaHighlights />
      </div>

      <!-- Right: version card + secondary chips -->
      <div class="col-right">
        <div class="col-right-sticky">
          <DakotaVersionCard />
          <a
            class="github-btn"
            href="https://github.com/projectbluefin/dakota"
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconGithubCircle />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.dakota-page {
  position: relative;
  background-image: url('/evening/night-sky.webp');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;

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

.dakota-layout {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-sizing: border-box;
  padding: 32px 32px 48px;
  gap: 32px;

  @media (min-width: 840px) {
    flex-direction: row;
    padding: 60px 60px 40px;
    gap: 40px;
  }

  @media (max-width: 600px) {
    padding: 24px 16px 48px;
    gap: 24px;
  }
}

.col-right {
  min-width: 0;

  @media (min-width: 840px) {
    width: 35%;
    flex: none;
  }
}

.col-right-sticky {
  @media (min-width: 840px) {
    position: sticky;
    top: 22vh;
  }
}

.release-links {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 1.4rem;
  font-weight: 600;
  span {
    color: var(--color-text-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
}

.release-link-item {
  a {
    font-weight: 600;
    text-decoration: none;
    background: rgb(var(--color-bg-rgb), 0.5);
    color: var(--color-text-light);
    height: 36px;
    line-height: 36px;
    padding: 8px 18px;
    border-radius: 18px;
    margin: 0 4px 0 4px;
    transition: background 0.2s;

    &:hover {
      background: var(--color-blue);
    }
  }
}

.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  min-width: 180px;
  line-height: 36px;
  padding: 0 20px;
  margin: 16px;
  border-radius: 18px;
  font-size: 1.4rem;
  font-weight: 700;
  background: var(--color-bg);
  color: var(--color-text-light);
  border: 1px solid rgb(var(--color-blue-rgb), 0.3);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;

  svg {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }

  &:hover {
    background: var(--color-blue);
    border-color: var(--color-blue);
  }
}

.col-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  flex: 1;
  min-width: 0;
}

.video-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
  }
}
</style>
