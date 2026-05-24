<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { useI18n } from 'vue-i18n'
import BluefinGrowthChartSvg from '@/assets/svg/growth_bluefins.svg'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

const countMeUrl = 'https://github.com/ublue-os/countme'
</script>

<template>
  <section id="flock" class="section-wrap">
    <div class="container">
      <div class="flock-header">
        <h2>{{ t("Flock.Title") }}</h2>
        <p>{{ t("Flock.Description") }}</p>
      </div>

      <div class="flock-card">
        <img class="growth-chart" :src="BluefinGrowthChartSvg" alt="Bluefin active users weekly growth chart" loading="lazy">
      </div>

      <p class="flock-attribution">
        Statistics provided by
        <a :href="countMeUrl" target="_blank" rel="noopener noreferrer">DNF Count Me</a>
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
#flock {
  background-color: var(--color-bg);

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .flock-header {
    text-align: center;
    margin-bottom: 32px;

    h2 {
      font-family: Inter;
      font-size: 7rem;
      font-weight: 700;
      line-height: 1;
      margin: 0 0 24px;
      text-transform: uppercase;
      color: var(--color-text-light);
    }

    p {
      font-size: 1.8rem;
      line-height: 1.6;
      color: var(--color-text-light);
      margin: 0 auto;
      max-width: 720px;
    }
  }

  .flock-card {
    padding: 24px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .growth-chart {
    width: 100%;
    height: auto;
    display: block;
  }

  .flock-attribution {
    margin: 24px 0 0;
    text-align: center;
    font-size: 1.6rem;
    color: var(--color-text-light);

    a {
      color: var(--color-blue-light);
      text-decoration: none;
      font-weight: 700;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  @media (max-width: 768px) {
    .flock-header h2 {
      font-size: 4rem;
    }

    .flock-header p,
    .flock-attribution {
      font-size: 1.4rem;
    }

    .flock-card {
      padding: 16px;
    }
  }
}
</style>
