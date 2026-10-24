<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { IconGithub, IconHeartCircle } from '@iconify-prerendered/vue-mdi'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({ useScope: 'global' })
const bluefinOrgUrl = 'https://github.com/projectbluefin'

interface Contributor {
  id: number
  login: string
  html_url: string
  avatar_url: string
}
const contributors = ref<Contributor[]>([])
const loading = ref(true)
const unavailable = ref(false)

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}contributors.json`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading contributors`)
    }
    contributors.value = await response.json()
    unavailable.value = contributors.value.length === 0
  }
  catch (error) {
    unavailable.value = true
    if (import.meta.env.DEV) {
      console.warn('[SectionContributors] failed to load contributors', error)
    }
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <section id="contributors" class="section-wrap">
    <div class="container">
      <div class="contributors-header">
        <h2>{{ t('Community.Contribute.Tag') }}</h2>
      </div>

      <div class="contributors-card">
        <div class="contributors-copy">
          <h3>{{ t('Community.Contribute.Title') }}</h3>
          <p>{{ t('Community.Contribute.Description') }}</p>
          <p class="contributors-summary">
            People with commits across public, non-fork projectbluefin repositories, including archived projects.
          </p>
          <div class="card-buttons">
            <a class="contributors-button" :href="bluefinOrgUrl" target="_blank" rel="noopener noreferrer">
              <IconGithub class="size-6" />
              <span>{{ t('Community.Contribute.Button') }}</span>
            </a>
            <a class="contributors-button secondary" href="https://docs.projectbluefin.io/donations" target="_blank" rel="noopener noreferrer">
              <IconHeartCircle class="size-6" />
              <span>{{ t('Community.Contribute.DonateButton') }}</span>
            </a>
          </div>
        </div>

        <div class="contributors-list" aria-live="polite" :aria-busy="loading">
          <div v-if="loading" class="contributors-state">
            Loading contributors...
          </div>
          <div v-else-if="unavailable" class="contributors-state">
            <span>The contributor list is unavailable right now.</span>
            <a :href="bluefinOrgUrl" target="_blank" rel="noopener noreferrer">Visit projectbluefin on GitHub</a>
          </div>
          <template v-else>
            <ul class="contributor-grid" role="list" aria-label="Project Bluefin contributors">
              <li v-for="contributor in contributors" :key="contributor.id">
                <a
                  class="contributor-profile"
                  :href="contributor.html_url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    class="contributor-avatar"
                    :src="`${contributor.avatar_url}${contributor.avatar_url.includes('?') ? '&' : '?'}s=160`"
                    alt=""
                    width="80"
                    height="80"
                    loading="lazy"
                    decoding="async"
                  >
                  <span class="contributor-name">{{ contributor.login }}</span>
                </a>
              </li>
            </ul>
            <a class="contributors-footer" :href="bluefinOrgUrl" target="_blank" rel="noopener noreferrer">
              Explore projectbluefin on GitHub →
            </a>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
#contributors {
  background-color: var(--color-bg);

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .contributors-header {
    margin-bottom: 32px;

    h2 {
      margin: 0;
      color: var(--color-text-light);
      font-family: Inter;
      font-size: clamp(2.4rem, 8vw, 7rem);
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
    }
  }

  .contributors-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    padding: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .contributors-copy {
    max-width: 72ch;
    min-width: 0;

    h3 {
      margin-bottom: 16px;
      color: var(--color-text);
      font-size: 2.4rem;
      font-weight: 600;
    }

    p {
      margin-bottom: 24px;
      color: var(--color-text-light);
      font-size: 1.6rem;
      line-height: 1.6;
    }

    .contributors-summary {
      color: var(--color-text);
      font-size: 1.2rem;
      opacity: 0.65;
    }
  }

  .contributors-list {
    min-width: 0;
  }

  .contributor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 96px), 1fr));
    gap: 24px 16px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      min-width: 0;
    }
  }

  .contributor-profile {
    display: flex;
    min-width: 44px;
    min-height: 44px;
    height: 100%;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--color-text-light);
    text-decoration: none;

    &:hover .contributor-name {
      color: var(--color-blue-light);
      text-decoration: underline;
    }
  }

  .contributor-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }

  .contributor-name {
    max-width: 100%;
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1.5;
    overflow-wrap: anywhere;
    text-align: center;
  }

  .contributors-footer {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    margin-top: 24px;
    color: var(--color-blue-light);
    font-size: 1.2rem;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  a:focus-visible {
    outline: 2px solid var(--color-blue-light);
    outline-offset: 4px;
  }

  .contributors-state {
    display: flex;
    min-height: 236px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-light);
    font-size: 1.4rem;

    a {
      color: var(--color-blue-light);
      text-decoration: none;
    }
  }

  .card-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .contributors-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 4px;
    background: var(--color-blue);
    color: white;
    font-size: 1.4rem;
    font-weight: 600;
    text-decoration: none;

    &.secondary {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  @media (max-width: 768px) {
    .contributors-card {
      padding: 24px;
    }

    .card-buttons {
      justify-content: center;
    }
  }
}
</style>
