<script setup lang="ts">
import type { Component } from 'vue'
import type { LoreKind, LoreRecord } from '../../data/wolves-lore-records'
import { computed, ref, watch } from 'vue'
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

const props = defineProps<{
  artifactId: string
  duration: number
  warning?: string
  records?: readonly LoreRecord[]
}>()

const selectedDossierRecord = ref<LoreRecord | null>(null)

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

const selectedRecord = computed(() => selectedDossierRecord.value ?? currentRecord.value)

const selectedLoreView = computed(() => {
  const record = selectedRecord.value
  if (!record) {
    return null
  }
  if (record.kind === 'character-sheet' && record.metadata.subject_kind === 'dinosaur') {
    return DinosaurDossierView
  }
  return loreViewByKind[record.kind]
})

const dossierRecords = computed(() => records.value.filter(record =>
  record.kind === 'character-sheet' || record.kind === 'guardian-bond',
))

watch(() => props.artifactId, () => {
  selectedDossierRecord.value = null
})
</script>

<template>
  <div class="wolves-lore-column">
    <details class="dossier-archive-directory font-mono" data-dossier-directory>
      <summary class="directory-title">
        [ DOSSIER INDEX · {{ dossierRecords.length }} RECORDS ]
      </summary>
      <p class="directory-subtitle">
        SELECT A GUARDIAN, DINOSAUR, OR DEPLOYED BOND
      </p>
      <div class="team-members">
        <button
          v-for="record in dossierRecords"
          :key="record.id"
          class="dossier-link-btn"
          :data-dossier-record-id="record.id"
          @click="selectedDossierRecord = record"
        >
          &gt; {{ record.metadata.title ?? record.id }}
        </button>
      </div>
    </details>

    <div class="tab-content flex flex-1 flex-col min-h-0" data-unified-lore-feed>
      <button
        v-if="selectedDossierRecord"
        class="back-to-archive-btn font-mono"
        data-back-to-current-record
        @click="selectedDossierRecord = null"
      >
        &laquo; [ RETURN TO CURRENT RECORD ]
      </button>
      <component
        :is="selectedLoreView"
        v-if="selectedRecord"
        :record="selectedRecord"
        :records="records"
        :duration="duration"
        :warning="selectedDossierRecord ? undefined : warning"
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

.back-to-archive-btn {
  background: transparent;
  border: 1px solid rgba(102, 179, 255, 0.3);
  color: #38bdf8;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 12px;
  align-self: flex-start;
  transition: all 0.2s;

  &:hover {
    background: rgba(56, 189, 248, 0.1);
    border-color: #38bdf8;
    color: #ffffff;
  }
}

.dossier-archive-directory {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #272727;
  background: #10151f;
  max-height: 34%;
  overflow-y: auto;
}

.directory-title {
  cursor: pointer;
  color: #38bdf8;
  font-size: 1rem;
  letter-spacing: 0.05em;
}

.directory-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.4;
}

.team-members {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
}

.dossier-link-btn {
  text-align: left;
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 1.15rem;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.2s;

  &:hover {
    color: #38bdf8;
  }
}
</style>
