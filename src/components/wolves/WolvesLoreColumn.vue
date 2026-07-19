<script setup lang="ts">
import type { Component } from 'vue'
import type { LoreKind, LoreRecord } from '../../data/wolves-lore-records'
import { computed } from 'vue'
import { loreRecords } from './lore'
import ChatlogLoreView from './lore/ChatlogLoreView.vue'
import DinosaurDossierView from './lore/DinosaurDossierView.vue'
import FieldReportLoreView from './lore/FieldReportLoreView.vue'
import GuardianBondLoreView from './lore/GuardianBondLoreView.vue'
import GuardianDossierView from './lore/GuardianDossierView.vue'
import LocationDossierView from './lore/LocationDossierView.vue'
import NewsLoreView from './lore/NewsLoreView.vue'
import QuoteLoreView from './lore/QuoteLoreView.vue'
import SourceLoreView from './lore/SourceLoreView.vue'
import './lore/lore-dossier.scss'

const props = defineProps<{
  artifactId: string
  duration: number
  warning?: string
  records?: readonly LoreRecord[]
}>()

const loreViewByKind: Record<LoreKind, Component> = {
  'chatlog': ChatlogLoreView,
  'quote': QuoteLoreView,
  'news': NewsLoreView,
  'source': SourceLoreView,
  'character-sheet': GuardianDossierView,
  'field-report': FieldReportLoreView,
  'location-dossier': LocationDossierView,
  'guardian-bond': GuardianBondLoreView,
}

const records = computed(() => props.records ?? loreRecords)

const currentRecord = computed(() =>
  records.value.find(record => record.id === props.artifactId) ?? null,
)

const selectedLoreView = computed(() => {
  const record = currentRecord.value
  if (!record) {
    return null
  }
  if (record.kind === 'character-sheet' && record.metadata.subject_kind === 'dinosaur') {
    return DinosaurDossierView
  }
  return loreViewByKind[record.kind]
})
</script>

<template>
  <div class="wolves-lore-column">
    <div class="tab-content flex flex-1 flex-col min-h-0" data-unified-lore-feed>
      <component
        :is="selectedLoreView"
        v-if="currentRecord"
        :record="currentRecord"
        :records="records"
        :duration="duration"
        :warning="warning"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-lore-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
