<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { IconGithub, IconHeartCircle } from '@iconify-prerendered/vue-mdi'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

const bluefinRepoUrl = 'https://github.com/ublue-os/bluefin'
const bluefinPulseUrl = 'https://github.com/ublue-os/bluefin/pulse'

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
  contributions: number
}

const contributors = ref<Contributor[]>([])
const contributorsLoading = ref(true)
const contributorsError = ref(false)
const highestContributionCount = computed(() => Math.max(...contributors.value.map(contributor => contributor.contributions), 1))

onMounted(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/ublue-os/bluefin/contributors?per_page=8', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const contributorData: Contributor[] = await response.json()
    contributors.value = contributorData
      .filter(contributor => !contributor.login.endsWith('[bot]'))
      .slice(0, 8)
  }
  catch (error) {
    contributorsError.value = true
    if (import.meta.env.DEV) {
      console.warn('[SectionContributors] failed to load contributors', error)
    }
  }
  finally {
    contributorsLoading.value = false
  }
})
</script>

<template>
  <section id="contributors" class="section-wrap">
    <div class="container">
      <div class="contributors-header">
        <h2>{{ t("Community.Contribute.Tag") }}</h2>
      </div>

      <div class="contributors-card">
        <div class="contributors-copy">
          <h3>{{ t("Community.Contribute.Title") }}</h3>
          <p>{{ t("Community.Contribute.Description") }}</p>
          <div class="card-buttons">
            <a class="contributors-button" :href="bluefinRepoUrl" target="_blank" rel="noopener noreferrer">
              <span class="button-icon">
                <IconGithub class="size-6" />
              </span>
              <span class="button-label">{{ t("Community.Contribute.Button") }}</span>
            </a>
            <a class="contributors-button secondary" href="https://docs.projectbluefin.io/donations" target="_blank" rel="noopener noreferrer">
              <span class="button-icon">
                <IconHeartCircle class="size-6" />
              </span>
              <span class="button-label">{{ t("Community.Contribute.DonateButton") }}</span>
            </a>
          </div>
        </div>

        <div class="contributors-chart" aria-live="polite">
          <div v-if="contributorsLoading" class="chart-state">
            Loading contributor activity...
          </div>
          <div v-else-if="contributorsError" class="chart-state">
            <span>Contributor activity is unavailable right now.</span>
            <a :href="bluefinPulseUrl" target="_blank" rel="noopener noreferrer">View activity on GitHub</a>
          </div>
          <div v-else class="chart-list">
            <a
              v-for="contributor in contributors"
              :key="contributor.login"
              class="contributor-row"
              :href="contributor.html_url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img :src="contributor.avatar_url" :alt="`${contributor.login} avatar`" loading="lazy">
              <span class="contributor-name">{{ contributor.login }}</span>
              <span class="contribution-track">
                <span
                  class="contribution-bar"
                  :style="{ width: `${(contributor.contributions / highestContributionCount) * 100}%` }"
                />
              </span>
              <span class="contribution-count">{{ contributor.contributions }}</span>
            </a>
            <a class="chart-footer" :href="bluefinPulseUrl" target="_blank" rel="noopener noreferrer">
              View full repository activity on GitHub →
            </a>
          </div>
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
      font-family: Inter;
      font-size: 7rem;
      font-weight: 700;
      line-height: 1;
      margin: 0;
      text-transform: uppercase;
      color: var(--color-text-light);
    }
  }

  .contributors-card {
    display: grid;
    grid-template-columns: minmax(280px, 360px) 1fr;
    gap: 32px;
    align-items: start;
    padding: 40px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .contributors-copy {
    h3 {
      font-size: 2.4rem;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 16px;
    }

    p {
      font-size: 1.6rem;
      line-height: 1.6;
      color: var(--color-text-light);
      margin-bottom: 24px;
    }
  }

  .contributors-chart {
    min-height: 276px;
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
  }

  .chart-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .contributor-row {
    display: grid;
    grid-template-columns: 28px minmax(100px, 150px) minmax(80px, 1fr) 48px;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    color: var(--color-text-light);
    text-decoration: none;

    &:hover {
      .contributor-name {
        color: var(--color-blue-light);
      }

      .contribution-bar {
        background: var(--color-blue-light);
      }
    }

    img {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--color-border);
    }
  }

  .contributor-name {
    overflow: hidden;
    color: var(--color-text-light);
    font-size: 1.3rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s ease;
  }

  .contribution-track {
    height: 10px;
    overflow: hidden;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
  }

  .contribution-bar {
    display: block;
    height: 100%;
    min-width: 3px;
    border-radius: inherit;
    background: var(--color-blue);
    transition:
      width 0.3s ease,
      background 0.15s ease;
  }

  .contribution-count {
    color: var(--color-text);
    font-family: 'Courier New', monospace;
    font-size: 1.2rem;
    text-align: right;
  }

  .chart-footer {
    align-self: flex-start;
    margin-top: 8px;
    color: var(--color-blue-light);
    font-size: 1.2rem;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .chart-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-height: 236px;
    gap: 12px;
    color: var(--color-text-light);
    font-size: 1.4rem;

    a {
      color: var(--color-blue-light);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .card-buttons {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .contributors-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: var(--color-blue);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 1.4rem;
    font-weight: 600;
    transition: background 0.3s ease;

    &:hover {
      background: var(--color-blue-dark, #0056b3);
    }

    &.secondary {
      background: rgba(255, 255, 255, 0.08);
    }

    .button-icon {
      display: flex;
      align-items: center;
    }
  }

  @media (max-width: 768px) {
    .contributors-header h2 {
      font-size: 4rem;
    }

    .contributors-card {
      grid-template-columns: 1fr;
      padding: 24px;
    }

    .contributors-chart {
      padding: 16px;
    }

    .contributor-row {
      grid-template-columns: 28px minmax(80px, 1fr) 84px 42px;
    }

    .card-buttons {
      justify-content: center;
    }
  }
}
</style>
