<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { renderLoreParagraphs } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const spec = computed<LoreSpecEntry[]>(() => [
  ...props.record.metadata.subject
    ? [
        { key: 'site', value: props.record.metadata.subject }
      ]
    : [],
  ...props.record.metadata.affiliation
    ? [
        { key: 'control', value: props.record.metadata.affiliation }
      ]
    : [],
  ...props.record.metadata.classification
    ? [
        { key: 'classification', value: props.record.metadata.classification }
      ]
    : [],
])

const paragraphs = computed(() => renderLoreParagraphs(props.record.body))
const page = computed(() => pickBlockPage(paragraphs.value, para => para, props.elapsed, props.duration))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="location-dossier"
  >
    <LoreRecordHeader eyebrow="LOCATION DOSSIER" :title="record.metadata.title" :spec="spec" />

    <article class="lore-dossier-body" :data-lore-page-index="page.index">
      <p
        v-for="(para, index) in page.blocks"
        :key="index"

        v-html="para"
      />
    </article>
  </section>
</template>
