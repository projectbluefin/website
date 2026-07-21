<script setup lang="ts">
import { IconGithubCircle, IconLoading } from '@iconify-prerendered/vue-mdi'
import { computed, onMounted, ref } from 'vue'

interface StreamData {
  version: string
  buildDate: string
  kernel: string
  systemd: string
  docker: string
  containerd: string
  ignition: string
  etcd: string
}

interface ServerVersions {
  streams: Record<string, StreamData>
}

const GITHUB_RELEASES_PAGE = 'https://github.com/projectbluefin/server/releases'

const componentFields: { key: keyof StreamData, label: string }[] = [
  { key: 'kernel', label: 'Kernel' },
  { key: 'systemd', label: 'systemd' },
  { key: 'containerd', label: 'containerd' },
  { key: 'docker', label: 'Docker' },
  { key: 'ignition', label: 'Ignition' },
  { key: 'etcd', label: 'etcd' },
]

const versions = ref<ServerVersions | null>(null)
const stableBuild = computed(() => versions.value?.streams.stable ?? null)

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}server-versions.json`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    versions.value = await response.json()
  }
  catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[ServerVersion] failed to load versions', error)
    }
  }
})
</script>

<template>
  <div class="release-widget">
    <div v-if="stableBuild" class="release-panel">
      <div class="build-info">
        <div class="release-heading">
          <span class="release-badge">Stable release</span>
          <span class="version mono">{{ stableBuild.version }}</span>
        </div>
        <div class="meta">
          freedesktop-sdk Server Linux
          <span v-if="stableBuild.buildDate"> · Built {{ stableBuild.buildDate }}</span>
        </div>

        <div class="component-grid">
          <div v-for="field in componentFields" :key="field.key" class="component">
            <span class="component-label">{{ field.label }}</span>
            <span class="component-value mono">{{ stableBuild[field.key] || '-' }}</span>
          </div>
        </div>
      </div>

      <div class="release-action">
        <div class="action-label">Install freedesktop-sdk Server Linux</div>
        <p>Choose the release asset for your hardware and follow the installation notes on GitHub.</p>
        <a class="release-link" :href="GITHUB_RELEASES_PAGE" target="_blank" rel="noopener noreferrer">
          <IconGithubCircle />
          View releases on GitHub
        </a>
      </div>
    </div>

    <div v-else class="loading-state">
      <IconLoading class="spin" />
      <span>Loading release information...</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-widget {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
}

.release-panel {
  display: grid;
  grid-template-columns: 1fr 220px;
}

.build-info,
.release-action {
  padding: 16px 18px;
}

.build-info {
  border-right: 1px solid var(--color-border-light);
}

.release-action {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(var(--color-bg-rgb), 0.35);
}

.release-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.release-badge {
  padding: 3px 8px;
  border: 1px solid rgba(80, 200, 120, 0.3);
  border-radius: 4px;
  background: rgba(80, 200, 120, 0.2);
  color: rgb(120, 220, 150);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.version {
  color: var(--color-text-light);
  font-size: 1.9rem;
  line-height: 1;
}

.meta {
  margin-top: 5px;
  color: var(--color-text);
  font-size: 1.1rem;
  opacity: 0.55;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 20px;
  margin-top: 18px;
}

.component {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.component-label {
  color: var(--color-text);
  font-size: 1rem;
  letter-spacing: 0.06em;
  opacity: 0.45;
  text-transform: uppercase;
}

.component-value {
  color: var(--color-blue-light);
  font-size: 1.2rem;
}

.action-label {
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.65;
  text-transform: uppercase;
}

.release-action p {
  margin: 0;
  color: var(--color-text);
  font-size: 1.15rem;
  line-height: 1.5;
}

.release-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: auto;
  padding: 10px 12px;
  border: 1px solid rgba(var(--color-blue-rgb), 0.5);
  border-radius: 7px;
  background: rgba(var(--color-blue-rgb), 0.9);
  color: white;
  font-size: 1.15rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: rgba(var(--color-blue-rgb), 1);
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 18px;
  color: var(--color-text);
  font-size: 1.2rem;
}

.spin {
  width: 1.5rem;
  height: 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .release-panel {
    grid-template-columns: 1fr;
  }

  .build-info {
    border-right: none;
    border-bottom: 1px solid var(--color-border-light);
  }

  .component-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
