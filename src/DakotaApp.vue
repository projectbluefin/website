<script setup lang="ts">
import { onBeforeMount, provide, ref } from 'vue'
import DakotaDownloadCard from './components/dakota/DakotaDownloadCard.vue'
import DakotaHighlights from './components/dakota/DakotaHighlights.vue'
import DakotaScene from './components/dakota/DakotaScene.vue'
import DakotaVersionChips from './components/dakota/DakotaVersionChips.vue'
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
      <!-- Left: text on top, raptor below -->
      <div class="col-left">
        <DakotaScene>
          <DakotaVersionChips />
        </DakotaScene>
        <img
          class="raptor"
          src="/characters/dakota.webp"
          alt="Dakotaraptor"
          fetchpriority="high"
        >
      </div>

      <!-- Right: features + download -->
      <div class="col-features">
        <DakotaHighlights />
        <DakotaDownloadCard />
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.dakota-page {
  min-height: 100vh;
  overflow-y: auto;
  background-image: url('/evening/night-sky.webp');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

.dakota-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  box-sizing: border-box;
  padding: 48px 60px 40px;
  gap: 40px;

  // Keep the fullscreen feel on wide landscape without clipping tall content
  @media (min-aspect-ratio: 16/10) and (min-width: 1024px) {
    min-height: calc(100vh - 60px);
  }

  // Tablet portrait / narrow desktop: stack columns
  @media (max-aspect-ratio: 16/10), (max-width: 1023px) {
    flex-direction: column;
    padding: 32px 32px 48px;
    gap: 32px;
  }

  // Phone
  @media (max-width: 600px) {
    padding: 24px 16px 48px;
    gap: 24px;
  }
}

.col-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;

  // Medium: text box and raptor side by side
  @media (min-width: 640px) and ((max-aspect-ratio: 16/10) or (max-width: 1023px)) {
    flex-direction: row;
    align-items: flex-end;
    gap: 32px;
  }

  .raptor {
    height: 30vh;
    width: auto;
    transform: scaleX(-1);
    filter: drop-shadow(0 20px 60px rgba(var(--color-blue-rgb), 0.2));
    margin-top: 24px;

    // Medium: no top margin, sits beside text
    @media (min-width: 640px) and ((max-aspect-ratio: 16/10) or (max-width: 1023px)) {
      margin-top: 0;
      flex-shrink: 0;
    }

    @media (max-aspect-ratio: 16/10), (max-width: 1023px) {
      height: 20vh;
      align-self: center;
    }

    @media (max-width: 600px) {
      height: 15vh;
    }
  }
}

.col-features {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: visible;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 28px 32px;

  @media (max-aspect-ratio: 16/10), (max-width: 1023px) {
    width: 100%;
    box-sizing: border-box;
  }

  @media (max-width: 600px) {
    padding: 20px 20px;
  }

  @media (max-width: 500px) {
    padding: 20px 16px;
  }
}
</style>
