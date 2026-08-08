<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { parseLoreSpeakerParagraphs, rebuildLoreSpeakerParagraph } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const spec = computed<LoreSpecEntry[]>(() => [
  ...props.record.metadata.timestamp ? [{ key: 'dateline', value: props.record.metadata.timestamp }] : [],
  ...props.record.metadata.classification ? [{ key: 'classification', value: props.record.metadata.classification }] : [],
])

const paragraphs = computed(() => parseLoreSpeakerParagraphs(props.record.body))
const page = computed(() => pickBlockPage(
  paragraphs.value,
  block => block.source,
  props.elapsed,
  props.duration,
  rebuildLoreSpeakerParagraph,
))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="news-bulletin"
  >
    <LoreRecordHeader eyebrow="NEWS BULLETIN" :title="record.metadata.title" :spec="spec" />

    <aside
      v-if="warning"
      class="lore-dossier-warning thesis-warning-fade"
      data-lore-warning
    >
      {{ warning }}
    </aside>

    <div class="lore-dossier-body" :data-lore-page-index="page.index">
      <div
        v-for="(para, index) in page.blocks"
        :key="index"
        :class="{ 'lore-speaker-message': para.isSpeaker }"
      >
        <span v-if="para.isSpeaker" class="lore-speaker-name">{{ para.speaker }}</span>
        <p v-html="para.text" />
      </div>
    </div>
  </section>
</template>
