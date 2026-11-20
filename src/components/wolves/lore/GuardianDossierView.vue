<script setup lang="ts">
import type { LoreViewProps } from '../lore'
import type { LoreSpecEntry } from './LoreRecordHeader.vue'
import { computed } from 'vue'
import { deriveLoreTelemetry } from '../../../data/wolves-lore-records'
import { renderLoreParagraphs } from '../lore'
import { pickBlockPage } from './lore-pages'
import LoreRecordHeader from './LoreRecordHeader.vue'

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

const spec = computed<LoreSpecEntry[]>(() => [
  ...specializations.value.length
    ? [
        {
          key: 'specializations',
          value: specializations.value.join(' · ').toUpperCase()
        }
      ]
    : [],
  ...props.record.metadata.guardian?.class
    ? [
        { key: 'class', value: props.record.metadata.guardian.class }
      ]
    : [],
  ...props.record.metadata.guardian?.super
    ? [
        { key: 'super', value: props.record.metadata.guardian.super }
      ]
    : [],
])

const paragraphs = computed(() => renderLoreParagraphs(props.record.body))
const page = computed(() => pickBlockPage(paragraphs.value, para => para, props.elapsed, props.duration))
</script>

<template>
  <section
    class="lore-dossier-panel"
    data-lore-view="guardian-dossier"
  >
    <LoreRecordHeader eyebrow="MAINTAINER // GUARDIAN" :title="record.metadata.title" :spec="spec" />

    <dl class="lore-spec lore-spec--boxed">
      <div v-if="record.metadata.aliases?.length">
        <dt>
          aliases:
        </dt>
        <dd>
          [{{ record.metadata.aliases.join(', ') }}]
        </dd>
      </div>
      <div v-if="record.metadata.titles?.length">
        <dt>
          titles:
        </dt>
        <dd>
          [{{ record.metadata.titles.join(', ') }}]
        </dd>
      </div>
      <div v-if="bond">
        <dt>
          GuardianBond:
        </dt>
        <dd>
          {{ bond.id }}
        </dd>
      </div>
      <div>
        <dt>
          status:
        </dt>
        <dd>
          {{ telemetry.phase }} · {{ telemetry.controller }} · {{ telemetry.recordFingerprint }}
        </dd>
      </div>
    </dl>

    <article class="lore-dossier-body" :data-lore-page-index="page.index">
      <p
        v-for="(para, index) in page.blocks"
        :key="index"

        v-html="para"
      />
    </article>
  </section>
</template>
