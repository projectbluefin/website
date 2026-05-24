<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { IconGithub, IconHeartCircle } from '@iconify-prerendered/vue-mdi'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

const bluefinRepoUrl = 'https://github.com/ublue-os/bluefin'
const bluefinPulseUrl = 'https://github.com/ublue-os/bluefin/pulse'
const repoBeatsEmbedUrl = 'https://repobeats.axiom.co/api/embed/40b85b252bf6ea25eb90539d1adcea013ccae69a.svg'
</script>

<template>
  <section id="contributors" class="section-wrap">
    <div class="container">
      <div class="contributors-header">
        <h2>Our Contributors</h2>
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

        <a class="contributors-embed" :href="bluefinPulseUrl" target="_blank" rel="noopener noreferrer" title="View Bluefin repository activity on GitHub">
          <img :src="repoBeatsEmbedUrl" alt="RepoBeats activity for the Bluefin repository" loading="lazy">
        </a>
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

  .contributors-embed {
    display: block;

    img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 8px;
      background: white;
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

    .card-buttons {
      justify-content: center;
    }
  }
}
</style>
