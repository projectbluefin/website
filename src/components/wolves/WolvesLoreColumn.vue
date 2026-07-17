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

const activeTab = ref<'narrative' | 'database'>('narrative')
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

const dossierLoreView = computed(() => {
  const record = selectedDossierRecord.value
  if (!record) {
    return null
  }
  if (record.kind === 'character-sheet' && record.metadata.subject_kind === 'dinosaur') {
    return DinosaurDossierView
  }
  return loreViewByKind[record.kind]
})

const teams = [
  {
    name: 'TEAM ALPHA: SYSTEMS & POWER GRID',
    members: [
      { id: 'subjectprofile/kat-cosgrove', label: 'Kat Cosgrove (Guardian / Titan)' },
      { id: 'subjectprofile/karl', label: 'Karl (Amargasaurus)' },
      { id: 'guardian-bond/kat-cosgrove-karl', label: 'Kat ↔ Karl GuardianBond' },
      { id: 'subjectprofile/robert-killen', label: 'Robert Killen (Guardian / Warlock)' },
    ],
  },
  {
    name: 'TEAM BETA: OPERATION & DEPLOYMENT',
    members: [
      { id: 'subjectprofile/jeefy', label: 'Jeefy (Guardian / Hunter)' },
      { id: 'subjectprofile/mountaintop', label: 'Mountaintop (Torosaurus)' },
      { id: 'guardian-bond/jeefy-mountaintop', label: 'Jeefy ↔ Mountaintop GuardianBond' },
      { id: 'subjectprofile/laura-santamaria', label: 'Laura Santamaria (Guardian / Warlock)' },
    ],
  },
  {
    name: 'TEAM OMEGA: RECONCILIATION & ANCHORING',
    members: [
      { id: 'subjectprofile/natalie', label: 'Natalie / Natali Vlatko (Guardian / Titan)' },
      { id: 'subjectprofile/alamo', label: 'Alamo (Alamosaurus)' },
      { id: 'guardian-bond/natalie-alamo', label: 'Natalie ↔ Alamo GuardianBond' },
      { id: 'subjectprofile/kaslin-fields', label: 'Kaslin Fields (Guardian / Warlock)' },
      { id: 'subjectprofile/christopher-blecker', label: 'Christoph Blecker (Guardian / Warlock)' },
    ],
  },
]

function findRecordById(id: string) {
  return records.value.find(r => r.id === id) ?? null
}

watch(() => props.artifactId, () => {
  activeTab.value = 'narrative'
  selectedDossierRecord.value = null
})
</script>

<template>
  <div class="wolves-lore-column">
    <!-- Futurist HUD Tab Selector -->
    <div class="lore-tab-bar font-mono">
      <button
        class="lore-tab-btn"
        :class="{ active: activeTab === 'narrative' }"
        @click="activeTab = 'narrative'; selectedDossierRecord = null"
      >
        [ NARRATIVE FEED ]
      </button>
      <button
        class="lore-tab-btn text-cyan"
        :class="{ active: activeTab === 'database' }"
        @click="activeTab = 'database'"
      >
        [ DOSSIER ARCHIVE ]
      </button>
    </div>

    <!-- Tab Contents -->
    <div v-if="activeTab === 'narrative'" class="tab-content flex flex-1 flex-col min-h-0">
      <component
        :is="selectedLoreView"
        v-if="currentRecord"
        :record="currentRecord"
        :records="records"
        :duration="duration"
        :warning="warning"
      />
    </div>

    <div v-else-if="activeTab === 'database'" class="tab-content flex flex-1 flex-col min-h-0">
      <!-- Detail Card View -->
      <div v-if="selectedDossierRecord" class="flex flex-1 flex-col min-h-0">
        <button
          class="back-to-archive-btn font-mono"
          @click="selectedDossierRecord = null"
        >
          &laquo; [ BACK TO DOSSIER ARCHIVE ]
        </button>
        <component
          :is="dossierLoreView"
          :record="selectedDossierRecord"
          :records="records"
          :duration="duration"
        />
      </div>

      <!-- Main Directory List View -->
      <div v-else class="dossier-archive-directory font-mono">
        <h3 class="directory-title">
          // OUTPOST-6 SECURE DATABASE
        </h3>
        <p class="directory-subtitle">
          SELECT COGNITIVE FILE INDEX OR DEPLOYED BOND TO EXTRACT CORE TELEMETRY
        </p>

        <div v-for="team in teams" :key="team.name" class="team-group">
          <div class="team-header font-bold text-blue-300">
            {{ team.name }}
          </div>
          <div class="team-members">
            <button
              v-for="member in team.members"
              :key="member.id"
              class="dossier-link-btn"
              @click="selectedDossierRecord = findRecordById(member.id)"
            >
              &gt; {{ member.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-lore-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 16px;
  min-height: 0;
}

.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.lore-tab-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.lore-tab-btn {
  background: transparent;
  border: 1px solid rgba(102, 179, 255, 0.2);
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(102, 179, 255, 0.5);
    color: #ffffff;
  }

  &.active {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.15);
    color: #ffffff;
  }
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
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #272727;
  background: #10151f;
  overflow-y: auto;
  flex: 1;
}

.directory-title {
  margin: 0;
  color: #38bdf8;
  font-size: 1.2rem;
  letter-spacing: 0.05em;
}

.directory-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.4;
}

.team-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.team-header {
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(147, 197, 253, 0.2);
  padding-bottom: 4px;
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
