<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { useI18n } from 'vue-i18n'
import RssFeed from '../RssFeed.vue'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <section id="scene-news" class="section-wrap">
    <div class="container moderate">
      <div>
        <h2>{{ t("NewsTitle") }}</h2>
      </div>
      <RssFeed
        feed-url="https://docs.projectbluefin.io/blog/atom.xml"
        :per-page="5"
      />
    </div>
  </section>
</template>
