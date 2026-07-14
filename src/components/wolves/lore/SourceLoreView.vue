<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { deriveLoreTelemetry } from '../../../data/wolves-lore-records'
import { getSourceProvenance } from '../lore'

const props = defineProps<LoreViewProps>()

const telemetry = computed(() => deriveLoreTelemetry(props.record))
const provenance = computed(() => getSourceProvenance(props.record))
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="source-fragment"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        SOURCE FRAGMENT
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
      <dl class="mb-0 mt-3 grid gap-1 text-base text-slate-300">
        <div v-if="provenance">
          <dt class="inline text-blue-200">
            PROVENANCE /
          </dt>
          <dd class="inline">
            {{ provenance }}
          </dd>
        </div>
        <div v-if="record.metadata.channel">
          <dt class="inline text-blue-200">
            COLLECTION /
          </dt>
          <dd class="inline">
            {{ record.metadata.channel }}
          </dd>
        </div>
      </dl>
    </header>

    <blockquote class="my-4 whitespace-pre-wrap border-l-2 border-blue-300/50 pl-3 text-lg leading-6 text-slate-100">
      {{ record.body }}
    </blockquote>

    <footer class="mt-auto border-t border-blue-300/25 pt-3 text-base text-blue-200">
      ARCHIVE FINGERPRINT / {{ telemetry.recordFingerprint }}
    </footer>
  </section>
</template>
