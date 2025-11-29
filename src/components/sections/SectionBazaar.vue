<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <section id="bazaar" class="section-wrap bazaar-section">
    <div class="container bazaar-content">
      <div class="bazaar-header">
        <div class="bazaar-tag">
          <strong>{{ t("Bazaar.Header.Tag") }}</strong>
        </div>
        <h2 class="title-apps">
          {{ t("Bazaar.Header.Title") }}
        </h2>
      </div>

      <div class="bazaar-main">
        <div class="bazaar-description">
          <p v-html="t('Bazaar.Description')" />
          <div class="bazaar-screenshot">
            <img
              src="/img/bazaar.png"
              alt="Screenshot of Bluefin's Flatpak Store, Bazaar"
              loading="lazy"
            >
            <img
              src="/img/bazaar.svg"
              class="bazaar-icon"
              alt="Bazaar's Icon"
              loading="lazy"
            >
          </div>
        </div>
      </div>

      <div class="bazaar-additional">
        <p v-html="t('Bazaar.Additional')" />
      </div>

      <div class="bazaar-buttons">
        <a class="bazaar-button" href="https://flathub.org/" target="_blank">
          <span class="button-label">{{ t("Bazaar.Button1") }}</span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.bazaar-section {
  background-color: var(--color-bg);
  position: relative;
  overflow: hidden;
  padding: 128px 0;
}

.bazaar-content {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
}

.bazaar-header {
  text-align: left;
  margin-bottom: 60px;

  .bazaar-tag {
    margin-bottom: 10px;

    strong {
      font-size: 2rem;
      font-weight: 400;
      text-transform: uppercase;
      color: var(--color-text-light);
      display: block;
    }
  }

  .title-apps {
    font-family: Inter;
    font-weight: 700;
    font-size: 7rem;
    text-transform: uppercase;
    color: var(--color-text-light);
    margin: 0;
  }
}

.bazaar-main {
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
}

.bazaar-description {
  max-width: 800px;
  text-align: center;

  p {
    font-size: 1.8rem;
    line-height: 1.6;
    color: var(--color-text-light);
    margin-bottom: 20px;
  }

  :deep(a) {
    color: var(--color-blue-light);
    text-decoration: none;
    font-weight: 700;

    &:hover {
      text-decoration: underline;
    }
  }
}

.bazaar-screenshot {
  position: relative;
  margin-top: 20px;

  img:first-child {
    width: 100%;
    height: auto;
    border-radius: 10px;
    box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.5);
    display: block;
  }
}

.bazaar-icon {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 64px !important;
  height: 64px !important;
  filter: drop-shadow(0px 0px 10px rgba(0, 0, 0, 0.5));
}

.bazaar-additional {
  max-width: 800px;
  margin: 0 auto 40px;
  text-align: center;

  p {
    font-size: 1.8rem;
    line-height: 1.6;
    color: var(--color-text-light);
  }

  :deep(a) {
    color: var(--color-blue-light);
    text-decoration: none;
    font-weight: 700;

    &:hover {
      text-decoration: underline;
    }
  }
}

.bazaar-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 40px;
}

.bazaar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 32px;
  background: var(--color-blue);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 1.6rem;
  font-weight: 600;
  transition: background 0.3s ease;
  min-width: 200px;

  &:hover {
    background: var(--color-blue-dark, #0056b3);
  }
}

@media (max-width: 768px) {
  .bazaar-header .title-apps {
    font-size: 4rem;
  }

  .bazaar-description p {
    font-size: 1.6rem;
  }

  .bazaar-additional p {
    font-size: 1.4rem;
  }

  .bazaar-buttons {
    flex-direction: column;
    align-items: center;
  }

  .bazaar-button {
    width: 100%;
    max-width: 300px;
  }
}
</style>
