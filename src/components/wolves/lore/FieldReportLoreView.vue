<script setup lang="ts">
import type { LoreViewProps } from '../lore'

defineProps<LoreViewProps>()
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="field-report"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        FIELD REPORT
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
      <dl class="mb-0 mt-3 grid gap-1 text-base text-slate-300">
        <div v-if="record.metadata.sender">
          <dt class="inline text-blue-200">
            OBSERVER /
          </dt>
          <dd class="inline">
            {{ record.metadata.sender }}
          </dd>
        </div>
        <div v-if="record.metadata.location">
          <dt class="inline text-blue-200">
            LOCATION /
          </dt>
          <dd class="inline">
            {{ record.metadata.location }}
          </dd>
        </div>
        <div v-if="record.metadata.subject">
          <dt class="inline text-blue-200">
            SUBJECT /
          </dt>
          <dd class="inline">
            {{ record.metadata.subject }}
          </dd>
        </div>
      </dl>
    </header>

    <article class="my-4 whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </article>
  </section>
</template>
