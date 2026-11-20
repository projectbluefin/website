<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { renderLoreParagraphs } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const spec = computed<LoreSpecEntry[]>(() => [
  ...props.record.metadata.sender
    ? [
        { key: 'observer', value: props.record.metadata.sender }
      ]
    : [],
  ...props.record.metadata.location
    ? [
        { key: 'location', value: props.record.metadata.location }
      ]
    : [],
  ...props.record.metadata.subject
    ? [
        { key: 'subject', value: props.record.metadata.subject }
      ]
    : [],
])

const paragraphs = computed(() => renderLoreParagraphs(props.record.body))
const page = computed(() => pickBlockPage(paragraphs.value, para => para, props.elapsed, props.duration))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="field-report"
  >
    <LoreRecordHeader eyebrow="FIELD REPORT" :title="record.metadata.title" :spec="spec" />

    <article class="lore-dossier-body" :data-lore-page-index="page.index">
      <p
        v-for="(para, index) in page.blocks"
        :key="index"

        v-html="para"
      />
    </article>
  </section>
</template>
