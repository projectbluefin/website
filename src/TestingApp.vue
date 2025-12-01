<script setup lang="ts">
import type { MessageSchema } from './locales/schema'
import { marked } from 'marked'

import { useI18n } from 'vue-i18n'
import ImageChooser from './components/ImageChooser.vue'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <div class="testing-app">
    <section class="section-wrap">
      <div class="container">
        <div>
          <h2>{{ t("TryBluefin.Title") }}</h2>
          <p v-html="marked.parse(t('TryBluefin.Description'))" />
        </div>
        <ImageChooser />
      </div>
    </section>
  </div>
</template>

<style scoped>
.testing-app {
  min-height: 50vh;
}

.section-wrap {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.container h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  text-align: center;
  color: white;
}

.container p {
  text-align: center;
  font-size: 1.1rem;
  opacity: 0.9;
  margin-bottom: 2rem;
  color: white;
}

.container :deep(a) {
  color: #93c5fd;
}
</style>
