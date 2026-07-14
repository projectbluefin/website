<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { dinosaurSpecies } from '../../../data/wolves-dinosaur-species'

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
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="dinosaur-dossier"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        DINOSAUR // SUBJECT PROFILE
      </p>
      <h2 v-if="record.metadata.epic_name" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.epic_name }}
      </h2>
      <p v-if="bond?.metadata.relations?.guardian" class="mb-0 mt-3 text-base text-slate-100">
        GUARDIANBOND / {{ bond.id }}
        <br>
        {{ record.metadata.subject }} ↔ GUARDIAN {{ bond.metadata.relations.guardian }}
      </p>
    </header>

    <dl class="lore-spec my-4 grid gap-1 rounded-lg border border-blue-300/20 bg-black/20 p-3 text-base text-slate-200">
      <div v-if="species">
        <dt class="inline text-blue-200">
          species:
        </dt>
        <dd class="inline">
          {{ species.scientificName }}
        </dd>
      </div>
      <div v-if="guardian">
        <dt class="inline text-blue-200">
          rider:
        </dt>
        <dd class="inline">
          {{ guardian.metadata.title || guardian.metadata.subject }}
        </dd>
      </div>
      <div v-if="record.metadata.titles?.length">
        <dt class="inline text-blue-200">
          titles:
        </dt>
        <dd class="inline">
          [{{ record.metadata.titles.join(', ') }}]
        </dd>
      </div>
    </dl>

    <article class="whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </article>

    <figure v-if="species && artworkSource" class="mb-0 mt-auto pt-4">
      <img
        :src="artworkSource"
        :alt="species.scientificName"
        class="mx-auto block max-h-56 w-full object-contain object-bottom"
        data-species-artwork
      >
      <figcaption class="mt-2 text-center text-base text-slate-300">
        BONDED RIDER / {{ guardian?.metadata.title || bond?.metadata.relations?.guardian }}
      </figcaption>
    </figure>
  </section>
</template>
