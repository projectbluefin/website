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
    class="source-fragment"
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

<style scoped lang="scss">
.source-fragment {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid rgba(102, 179, 255, 0.25);
  border-radius: 16px;
  padding: 16px;
  background: rgba(16, 21, 31, 0.45);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.source-fragment header {
  border-bottom: 1px solid rgba(var(--color-blue-rgb), 0.25);
  padding-bottom: 12px;
}

.source-fragment header > p {
  margin: 0;
  color: var(--color-blue-light);
  font-size: 1.35rem;
  letter-spacing: 0.2em;
}

.source-fragment h2 {
  margin: 8px 0 0;
  color: #ffffff;
  font-size: 1.95rem;
}

.source-fragment dl {
  display: grid;
  gap: 4px;
  margin: 12px 0 0;
  color: rgba(226, 232, 240, 0.9);
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

.source-fragment dt {
  color: #bae6fd;
}

.source-fragment blockquote {
  margin: 16px 0;
  border-left: 2px solid rgba(var(--color-blue-rgb), 0.5);
  padding-left: 12px;
  color: #f1f5f9;
  font-size: 1.7rem;
  line-height: 1.65;
  white-space: pre-wrap;
}

.source-fragment footer {
  margin-top: auto;
  border-top: 1px solid rgba(var(--color-blue-rgb), 0.25);
  padding-top: 12px;
  color: #bae6fd;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}
</style>
