<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { getSourceProvenance, parseLoreSpeakerParagraphs, rebuildLoreSpeakerParagraph } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const provenance = computed(() => getSourceProvenance(props.record))
const spec = computed<LoreSpecEntry[]>(() => [
  ...provenance.value ? [{ key: 'provenance', value: provenance.value }] : [],
  ...props.record.metadata.channel ? [{ key: 'collection', value: props.record.metadata.channel }] : [],
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
    data-lore-view="source-fragment"
  >
    <LoreRecordHeader eyebrow="SOURCE FRAGMENT" :title="record.metadata.title" :spec="spec" />

    <aside
      v-if="warning"
      class="lore-dossier-warning thesis-warning-fade"
      data-lore-warning
    >
      {{ warning }}
    </aside>

    <blockquote class="lore-dossier-body source-body" :data-lore-page-index="page.index">
      <div
        v-for="(para, index) in page.blocks"
        :key="index"
        :class="{ 'lore-speaker-message': para.isSpeaker }"
      >
        <span v-if="para.isSpeaker" class="lore-speaker-name">{{ para.speaker }}</span>
        <p v-html="para.text" />
      </div>
    </blockquote>
  </section>
</template>

<style scoped lang="scss">
.source-body {
  border-left: 2px solid rgba(var(--color-blue-rgb), 0.5);
  padding-left: 12px;
}
</style>
