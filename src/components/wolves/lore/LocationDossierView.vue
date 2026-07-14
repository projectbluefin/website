<script setup lang="ts">
import type { LoreViewProps } from '../lore'

defineProps<LoreViewProps>()
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="location-dossier"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        LOCATION DOSSIER
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
    </header>

    <dl class="my-4 grid gap-2 rounded-lg border border-blue-300/20 bg-black/20 p-3 text-base text-slate-200">
      <div v-if="record.metadata.subject">
        <dt class="inline text-blue-200">
          SITE /
        </dt>
        <dd class="inline">
          {{ record.metadata.subject }}
        </dd>
      </div>
      <div v-if="record.metadata.affiliation">
        <dt class="inline text-blue-200">
          CONTROL /
        </dt>
        <dd class="inline">
          {{ record.metadata.affiliation }}
        </dd>
      </div>
      <div v-if="record.metadata.classification">
        <dt class="inline text-blue-200">
          CLASSIFICATION /
        </dt>
        <dd class="inline">
          {{ record.metadata.classification }}
        </dd>
      </div>
    </dl>

    <article class="mt-auto whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </article>
  </section>
</template>
