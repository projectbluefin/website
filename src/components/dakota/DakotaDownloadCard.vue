<script setup lang="ts">
import {
  IconCheckCircleOutline,
  IconDownload,
  IconGithubCircle,
} from '@iconify-prerendered/vue-mdi'

interface DownloadEntry {
  label: string
  isoUrl: string
  isoFilename: string
  checksumUrl: string
}

const BASE = 'https://projectbluefin.dev'

const entries: DownloadEntry[] = [
  {
    label: 'AMD / Intel',
    isoUrl: `${BASE}/dakota-live-alpha2.iso`,
    isoFilename: 'dakota-live-alpha2.iso',
    checksumUrl: `${BASE}/dakota-live-alpha2.iso-CHECKSUM`,
  },
  {
    label: 'Nvidia',
    isoUrl: `${BASE}/dakota-nvidia-live-alpha2.iso`,
    isoFilename: 'dakota-nvidia-live-alpha2.iso',
    checksumUrl: `${BASE}/dakota-nvidia-live-alpha2.iso-CHECKSUM`,
  },
]
</script>

<template>
  <div id="dakota-download" class="dakota-download">
    <div class="download-title">
      Download
    </div>
    <div class="entries">
      <div
        v-for="entry in entries"
        :key="entry.label"
        class="entry"
      >
        <div class="entry-info">
          <span class="entry-gpu">{{ entry.label }}</span>
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
    <a
      class="github-link"
      href="https://github.com/projectbluefin/dakota"
      target="_blank"
      rel="noopener noreferrer"
    >
      <IconGithubCircle />
      View on GitHub
    </a>
  </div>
</template>

<style scoped lang="scss">
.dakota-download {
  border-top: 1px solid var(--color-border-light);
  padding-top: 16px;
  margin-top: 16px;
}

.download-title {
  font-size: 1.2rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text);
  margin-bottom: 12px;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-gpu {
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
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.entry-dl,
.entry-checksum {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.3rem;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 1.2rem;
  color: var(--color-text);
  text-decoration: none;
  opacity: 0.6;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  svg {
    width: 1.4rem;
    height: 1.4rem;
  }
}

@media (max-width: 700px) {
  .entry {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 16px 0;
  }

  .entry-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }

  .btn {
    white-space: nowrap;
    flex: 0 0 auto;
  }
}
</style>
