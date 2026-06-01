<script setup lang="ts">
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
          <div class="alpha-badge-row">
            <div class="alpha-badge">
              ⚠️ <strong>Alpha.</strong>Take appropriate precautions.
            </div>
          </div>
          <DakotaVersionCard />
          <a
            class="github-btn"
            href="https://github.com/projectbluefin/dakota"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.09.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.dakota-page {
  background-image: url('/evening/night-sky.webp');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

.dakota-layout {
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
    top: calc(18vh);
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

.alpha-badge-row {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.alpha-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  line-height: 36px;
  padding: 0 20px;
  margin: 16px 64px 0;
  border-radius: 18px;
  font-size: 1.4rem;
  font-weight: 700;
  background: var(--color-bg);
  color: var(--color-text-light);
  border: 2px solid var(--color-bg);
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
