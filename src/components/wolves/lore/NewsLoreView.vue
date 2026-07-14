<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { deriveLoreTelemetry } from '../../../data/wolves-lore-records'

const props = defineProps<LoreViewProps>()

const telemetry = computed(() => deriveLoreTelemetry(props.record))
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="news-bulletin"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        NEWS BULLETIN
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-base text-slate-300">
        <time v-if="record.metadata.timestamp" :datetime="record.metadata.timestamp">
          DATELINE / {{ record.metadata.timestamp }}
        </time>
        <span v-if="record.metadata.classification">
          CLASSIFICATION / {{ record.metadata.classification }}
        </span>
      </div>
    </header>

    <aside
      v-if="warning"
      class="thesis-warning-fade mt-4 border-l-2 border-blue-300 pl-3 text-lg italic leading-6 text-blue-100"
      data-lore-warning
    >
      {{ warning }}
    </aside>

    <p class="my-4 whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </p>

    <footer class="mt-auto border-t border-blue-300/25 pt-3 text-base text-blue-200">
      STATUS / {{ telemetry.phase }} · {{ telemetry.resourceName }} · {{ telemetry.recordFingerprint }}
    </footer>
  </section>
</template>

<style scoped>
.thesis-warning-fade {
  animation: thesis-warning-fade 20s linear forwards;
}

@keyframes thesis-warning-fade {
  from {
    opacity: 1;
  }

  to {
    opacity: 0.35;
  }
}
</style>
