<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import { computed } from 'vue'
import { deriveLoreTelemetry } from '../../../data/wolves-lore-records'

const props = defineProps<LoreViewProps>()

const telemetry = computed(() => deriveLoreTelemetry(props.record))
const specializations = computed(() => props.record.metadata.guardian?.specializations ?? [])
const guardianReference = computed(() => props.record.metadata.subject)
const bond = computed(() =>
  props.records?.find(record =>
    record.kind === 'guardian-bond'
    && record.metadata.relations?.guardian === guardianReference.value,
  ),
)
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#272727] bg-[#10151f] p-4 font-mono shadow-xl"
    data-lore-view="guardian-dossier"
  >
    <header class="border-b border-blue-300/25 pb-3">
      <p class="m-0 text-base tracking-[0.2em] text-blue-300">
        GUARDIAN // MAINTAINER
      </p>
      <h2 v-if="record.metadata.title" class="mb-0 mt-2 text-3xl text-white">
        {{ record.metadata.title }}
      </h2>
      <p v-if="specializations.length" class="mb-0 mt-3 text-lg tracking-wide text-slate-100">
        {{ specializations.join(' · ').toUpperCase() }}
      </p>
    </header>

    <div class="my-4 grid gap-4">
      <dl class="lore-spec grid gap-1 rounded-lg border border-blue-300/20 bg-black/20 p-3 text-base text-slate-200">
        <div v-if="record.metadata.guardian?.class">
          <dt class="inline text-blue-200">
            class:
          </dt>
          <dd class="inline">
            {{ record.metadata.guardian.class }}
          </dd>
        </div>
        <div v-if="record.metadata.guardian?.super">
          <dt class="inline text-blue-200">
            super:
          </dt>
          <dd class="inline">
            {{ record.metadata.guardian.super }}
          </dd>
        </div>
        <div v-if="record.metadata.aliases?.length">
          <dt class="inline text-blue-200">
            aliases:
          </dt>
          <dd class="inline">
            [{{ record.metadata.aliases.join(', ') }}]
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
        <div v-if="bond">
          <dt class="inline text-blue-200">
            GuardianBond:
          </dt>
          <dd class="inline">
            {{ bond.id }}
          </dd>
        </div>
      </dl>

      <aside class="border-l-2 border-blue-300/50 pl-3 text-base text-slate-300">
        <p class="m-0 text-blue-200">
          STATUS RAIL
        </p>
        <p class="mb-0 mt-1">
          {{ telemetry.phase }} · {{ telemetry.controller }}
        </p>
        <p class="mb-0 mt-1">
          {{ telemetry.recordFingerprint }}
        </p>
      </aside>
    </div>

    <article class="mt-auto whitespace-pre-wrap text-lg leading-6 text-slate-100">
      {{ record.body }}
    </article>
  </section>
</template>
