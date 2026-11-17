<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { dinosaurSpecies } from '../../../data/wolves-dinosaur-species'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

const props = defineProps<LoreViewProps>()

const species = computed(() =>
  dinosaurSpecies.find(entry => entry.id === props.record.metadata.species),
)
const bond = computed(() => {
  const rider = props.record.metadata.relations?.riders?.[0]
  return props.records?.find(record => record.id === rider)
})
const guardian = computed(() => {
  const guardianReference = bond.value?.metadata.relations?.guardian
  return props.records?.find(record =>
    record.id === guardianReference || record.metadata.subject === guardianReference,
  )
})
const artworkSource = computed(() =>
  species.value
    ? `${import.meta.env.BASE_URL}${species.value.artwork.slice(2)}`
    : undefined,
)

const spec = computed<LoreSpecEntry[]>(() => [
  ...species.value
    ? [
        { key: 'species', value: species.value.scientificName }
      ]
    : [],
  ...guardian.value
    ? [
        { key: 'rider', value: guardian.value.metadata.title || guardian.value.metadata.subject || '' }
      ]
    : [],
  ...bond.value
    ? [
        { key: 'bond', value: bond.value.id }
      ]
    : [],
])

const paragraphs = computed(() => props.record.body.split(/\n{2,}/).map(para => para.trim()).filter(Boolean))
const page = computed(() => pickBlockPage(paragraphs.value, para => para, props.elapsed, props.duration))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="dinosaur-dossier"
  >
    <LoreRecordHeader
      eyebrow="DINOSAUR // SUBJECT PROFILE"
      :title="record.metadata.epic_name"
      :spec="spec"
    />

    <dl v-if="record.metadata.titles?.length" class="lore-spec lore-spec--boxed">
      <div>
        <dt>
          titles:
        </dt>
        <dd>
          [{{ record.metadata.titles.join(', ') }}]
        </dd>
      </div>
    </dl>

    <article class="lore-dossier-body" :data-lore-page-index="page.index">
      <p v-for="(para, index) in page.blocks" :key="index">
        {{ para }}
      </p>
    </article>

    <figure v-if="species && artworkSource" class="lore-dossier-figure">
      <img
        :src="artworkSource"
        :alt="species.scientificName"
        data-species-artwork
      >
    </figure>
  </section>
</template>
