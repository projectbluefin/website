<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IconCheckCircleOutline,
  IconDownload,
} from '@iconify-prerendered/vue-mdi'
import { getDakotaVersions } from '../../composables'
import DakotaVersionChips from './DakotaVersionChips.vue'

interface DakotaVersions {
  generatedAt: string
  packages: Record<string, string>
}

interface DownloadEntry {
  label: string
  isoUrl: string
  isoFilename: string
  checksumUrl: string
}

const BASE = 'https://projectbluefin.dev'

const versions = ref<DakotaVersions | null>(null)
const showDownloads = ref(false)

const cardImageStyle = computed(() => ({
  backgroundImage: `url(${import.meta.env.BASE_URL}characters/dakota.webp)`,
}))

const entries: DownloadEntry[] = [
  {
    label: 'AMD / Intel',
    isoUrl: `${BASE}/dakota-live-alpha2.iso`,
    isoFilename: 'dakota-live-alpha2.iso',
    checksumUrl: `${BASE}/dakota-live-alpha2.iso-CHECKSUM`,
  },
  {
    label: 'NVIDIA',
    isoUrl: `${BASE}/dakota-nvidia-live-alpha2.iso`,
    isoFilename: 'dakota-nvidia-live-alpha2.iso',
    checksumUrl: `${BASE}/dakota-nvidia-live-alpha2.iso-CHECKSUM`,
  },
]

const VERSION_LABELS: Record<string, string> = {
  'kernel': 'Kernel',
  'gnome': 'GNOME',
  'mesa': 'Mesa',
  'nvidia': 'NVIDIA',
  'freedesktop-sdk': 'Freedesktop SDK',
  'bootc': 'bootc',
}

const versionRows = computed(() => {
  if (!versions.value) {
    return []
  }
  return Object.entries(versions.value.packages)
    .filter(([key]) => key in VERSION_LABELS)
    .map(([key, value]) => ({
      label: VERSION_LABELS[key],
      value,
    }))
})

onMounted(async () => {
  try {
    versions.value = await getDakotaVersions()
  }
  catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[DakotaVersionCard] failed to load versions', e)
    }
  }
})

function openDownloads() {
  showDownloads.value = true
}

function backToCard() {
  showDownloads.value = false
}
</script>

<template>
  <div class="dakota-version-card">
    <!-- Card view (character art + version info) -->
    <div
      v-if="!showDownloads"
      class="card-box"
      @click="openDownloads"
    >
      <div class="alpha-badge">
        <span class="alpha-badge-title">⚠️ Alpha.</span>
        <span class="alpha-badge-sub">Take appropriate precautions.</span>
      </div>
      <div
        class="card-image"
        :style="cardImageStyle"
      >
        <div class="card-overlay">
          <div class="card-header">
            <h3 class="card-title">Dakota</h3>
            <span class="card-subtitle">For the brave soul</span>
          </div>

          <p class="card-description">
            The Final Form. Bluefin Perfected.
          </p>

          <!-- Version Information -->
          <div v-if="versionRows.length" class="version-info">
            <div
              v-for="row in versionRows"
              :key="row.label"
              class="version-row"
            >
              <span class="version-label">{{ row.label }}</span>
              <span class="version-value">{{ row.value }}</span>
            </div>
          </div>

          <div class="click-hint">
            Click to download ↓
          </div>
        </div>
      </div>
    </div>

    <!-- Download view -->
    <div v-else class="download-view">
      <div class="entries-wrapper">
        <DakotaVersionChips
          class="secondary-chips"
          :keys="['systemd', 'podman', 'pipewire', 'flatpak', 'baseline']"
        />
        <div class="download-entries">
          <div
            v-for="entry in entries"
            :key="entry.label"
            class="download-entry"
          >
            <div class="entry-header">
              <span class="entry-label">{{ entry.label }}</span>
              <span class="entry-filename">{{ entry.isoFilename }}</span>
            </div>
            <div class="entry-buttons">
              <a
                class="btn filled entry-dl"
                :href="entry.isoUrl"
                :download="entry.isoFilename"
              >
                <IconDownload />
                Download ISO
              </a>
              <a
                class="btn entry-checksum"
                :href="entry.checksumUrl"
                title="Verify checksum"
              >
                <IconCheckCircleOutline />
                Verify
              </a>
            </div>
          </div>
        </div>
      </div>

      <button class="back-button" @click="backToCard">
        ← Back
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dakota-version-card {
  width: 100%;
}

/* ── Card View ── */

.card-box {
  position: relative;
  height: 400px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 2px solid rgba(var(--color-blue-rgb), 0.25);
  background: #1f2937;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    border-color: rgba(var(--color-blue-rgb), 0.5);
  }
}

.card-image {
  width: 100%;
  height: 100%;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.15) 0%,
    rgba(0, 0, 0, 0.4) 30%,
    rgba(0, 0, 0, 0.92) 100%
  );
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.5rem;
  color: var(--color-text-light);
  border-radius: 12px;
}

.card-header {
  margin-bottom: 0.5rem;
}

.card-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.card-subtitle {
  font-size: 1.5rem;
  opacity: 0.9;
  display: block;
  margin-bottom: 0.5rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.card-description {
  font-size: 1.5rem;
  line-height: 1.4;
  opacity: 0.85;
  margin: 0 0 0.75rem 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  text-align: center;
}

/* Version rows */
.version-info {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 0.4rem;
  font-size: 1.55rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.version-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.version-value {
  font-family: 'Courier New', monospace;
  color: #93c5fd;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 1.55rem;
}

.alpha-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: max-content;
  max-width: calc(100% - 24px);
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: baseline;
  column-gap: 0.3em;
  white-space: normal;
  font-size: 1.2rem;
  line-height: 1.3;
  color: var(--color-text-light);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 5px 10px;
  pointer-events: none;
  text-align: right;

  .alpha-badge-title {
    font-weight: 600;
  }

  .alpha-badge-sub {
    opacity: 0.9;
  }
}

.click-hint {
  margin-top: 0.75rem;
  font-size: 1.3rem;
  font-weight: 600;
  text-align: center;
  color: rgba(147, 197, 253, 0.8);
  animation: pulse-hint 2s ease-in-out infinite;
}

@keyframes pulse-hint {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* ── Download View ── */

.download-view {
  min-height: 400px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: rgba(31, 41, 55, 0.6);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(var(--color-blue-rgb), 0.25);
  border-radius: 12px;
  padding: 1.25rem;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.entries-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.secondary-chips {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 16px;
}

.download-entries {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  padding: 0 8px;
}

.download-entry {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.download-entry + .download-entry {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.entry-label {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-text-light);
}

.entry-filename {
  font-size: 1.1rem;
  font-family: 'Courier New', monospace;
  color: var(--color-text);
}

.entry-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100%;
}

.entry-dl {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 1.3rem;
  flex: 1 1 0%;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.entry-checksum {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 1.3rem;
  flex: 0 1 auto;
  max-width: 160px;
}

.back-button {
  display: block;
  margin-top: auto;
  margin-bottom: 0;
  margin-left: auto;
  margin-right: auto;
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(147, 197, 253, 0.8);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;

  &:hover {
    color: rgba(147, 197, 253, 1);
  }
}

/* ── Responsive ── */

@media (max-width: 500px) {
  .card-title {
    font-size: 1.7rem;
  }

  .card-subtitle {
    font-size: 1.3rem;
  }

  .card-description {
    font-size: 1.3rem;
  }

  .version-row {
    font-size: 1.35rem;
  }

  .version-value {
    font-size: 1.35rem;
  }

  .download-view {
    padding: 1rem;
  }
}
</style>
