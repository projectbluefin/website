<script setup lang="ts">
import SceneVisibilityChecker from "../common/SceneVisibilityChecker.vue"
import ImageChooser from "../ImageChooser.vue"
import { marked } from "marked"

import { useI18n } from "vue-i18n"
import type { MessageSchema } from "../../locales/schema"
const { t } = useI18n<MessageSchema>({
  useScope: "global"
})
</script>

<style scoped>
.picker-header {
  max-width: 800px;
  margin: 0 auto;

  .picker-tag,
  h2 {
    text-align: left;
  }

  p {
    text-align: center;
  }
}

p :deep(a) {
  @include font(700);
  color: var(--color-blue-light);

  &:hover {
    text-decoration: none;
  }
}
</style>

<template>
  <section id="scene-picker" class="section-wrap">
    <div class="container">
      <div class="picker-header">
        <div class="picker-tag">
          <strong>{{ t("TryBluefin.Tag") }}</strong>
        </div>
        <h2>{{ t("TryBluefin.Title") }}</h2>
        <p v-html="marked.parse(t('TryBluefin.Description'))" />
      </div>
      <ImageChooser />
    </div>
    <SceneVisibilityChecker name="#scene-picker" />
  </section>
</template>
