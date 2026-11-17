<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { validateGuardianBonds } from '../../../data/wolves-lore-records'
import { renderLoreParagraphs } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const guardian = computed(() => {
  const reference = props.record.metadata.relations?.guardian
  return props.records?.find(record =>
    record.id === reference || record.metadata.subject === reference,
  )
})
const dinosaur = computed(() => {
  const reference = props.record.metadata.relations?.dinosaur
  return props.records?.find(record =>
    record.id === reference || record.metadata.subject === reference,
  )
})
const validationState = computed(() => {
  if (!guardian.value || !dinosaur.value) {
    return 'UNRESOLVED'
  }

  try {
    validateGuardianBonds([guardian.value, dinosaur.value, props.record])
    return 'RECIPROCAL / VALID'
  }
  catch {
    return 'RECIPROCAL / INVALID'
  }
})

const spec = computed<LoreSpecEntry[]>(() => [
  ...props.record.metadata.relations?.guardian
    ? [
        { key: 'guardian', value: props.record.metadata.relations.guardian }
      ]
    : [],
  ...props.record.metadata.relations?.dinosaur
    ? [
        { key: 'dinosaur', value: props.record.metadata.relations.dinosaur }
      ]
    : [],
  { key: 'validation', value: validationState.value },
])

const paragraphs = computed(() => renderLoreParagraphs(props.record.body))
const page = computed(() => pickBlockPage(paragraphs.value, para => para, props.elapsed, props.duration))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="guardian-bond"
  >
    <LoreRecordHeader eyebrow="GUARDIAN BOND" :title="record.metadata.title" :spec="spec" />

    <article class="lore-dossier-body" :data-lore-page-index="page.index">
      <p
        v-for="(para, index) in page.blocks"
        :key="index"

        v-html="para"
      />
    </article>
  </section>
</template>
