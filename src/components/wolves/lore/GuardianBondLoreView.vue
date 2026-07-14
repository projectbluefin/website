<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { validateGuardianBonds } from '../../../data/wolves-lore-records'

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
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="guardian-bond"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        GUARDIANBOND
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
    </header>

    <dl class="my-4 grid gap-2 rounded-lg border border-blue-300/20 bg-black/20 p-3 text-base text-slate-200">
      <div v-if="record.metadata.relations?.guardian">
        <dt class="inline text-blue-200">
          GUARDIAN /
        </dt>
        <dd class="inline">
          {{ record.metadata.relations.guardian }}
        </dd>
      </div>
      <div v-if="record.metadata.relations?.dinosaur">
        <dt class="inline text-blue-200">
          DINOSAUR /
        </dt>
        <dd class="inline">
          {{ record.metadata.relations.dinosaur }}
        </dd>
      </div>
      <div v-if="guardian?.metadata.guardian?.class">
        <dt class="inline text-blue-200">
          CLASS /
        </dt>
        <dd class="inline">
          {{ guardian.metadata.guardian.class }}
        </dd>
      </div>
      <div v-if="guardian?.metadata.guardian?.super">
        <dt class="inline text-blue-200">
          SUPER /
        </dt>
        <dd class="inline">
          {{ guardian.metadata.guardian.super }}
        </dd>
      </div>
    </dl>

    <p class="m-0 border-l-2 border-blue-300/50 pl-3 text-base text-blue-100">
      {{ validationState }}
    </p>
    <article class="mt-auto whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </article>
  </section>
</template>
