<script setup lang="ts">
import { IconGithubCircle } from '@iconify-prerendered/vue-mdi'
import { SERVER_VERSIONS } from '../../data/server-versions'

const GITHUB_RELEASES_PAGE = 'https://github.com/projectbluefin/server/releases'
</script>

<template>
  <div class="release-widget">
    <div class="release-action">
      <div class="action-header">
        <div class="action-label">
          Releases &amp; Components
        </div>
      </div>
      <p>Choose the release asset for your hardware and follow the installation notes on GitHub.</p>

      <div class="components-section">
        <div class="section-subtitle">
          Base OS (freedesktop-sdk {{ SERVER_VERSIONS.fdsdk }})
        </div>
        <div class="components-grid">
          <div class="component-item">
            <span class="component-name">systemd</span>
            <span class="component-version">{{ SERVER_VERSIONS.systemd }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">Linux Kernel</span>
            <span class="component-version">{{ SERVER_VERSIONS.kernel }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">Ignition</span>
            <span class="component-version">{{ SERVER_VERSIONS.ignition }}</span>
          </div>
        </div>

        <div class="section-subtitle sysext-header">
          Optional Sysext Extensions
        </div>
        <div class="components-grid">
          <div class="component-item">
            <span class="component-name">k0s</span>
            <span class="component-version">{{ SERVER_VERSIONS.k0s }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">kubeadm</span>
            <span class="component-version">{{ SERVER_VERSIONS.kubeadm }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">containerd (kubeadm)</span>
            <span class="component-version">{{ SERVER_VERSIONS.containerd }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">OpenZFS</span>
            <span class="component-version">{{ SERVER_VERSIONS.zfs }}</span>
          </div>
          <div class="component-item">
            <span class="component-name">NVIDIA</span>
            <span class="component-version">{{ SERVER_VERSIONS.nvidia }}</span>
          </div>
        </div>
      </div>

      <a class="release-link" :href="GITHUB_RELEASES_PAGE" target="_blank" rel="noopener noreferrer">
        <IconGithubCircle />
        View releases on GitHub
      </a>
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-widget {
  width: 100%;
  display: flex;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
}

.release-action {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px;
  background: rgba(var(--color-bg-rgb), 0.35);
  width: 100%;
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-label {
  color: var(--color-text);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.9;
  text-transform: uppercase;
}

.components-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 10px;
}

.section-subtitle {
  font-size: 1.2rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-blue-light);
  opacity: 0.9;

  &.sysext-header {
    margin-top: 8px;
  }
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.component-item {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  border-radius: 6px;

  .component-name {
    font-size: 1.2rem;
    color: var(--color-text);
    font-weight: 500;
  }

  .component-version {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-light);
    font-family: monospace;
  }
}

.release-action p {
  margin: 0;
  color: var(--color-text);
  font-size: 1.4rem;
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
  font-size: 1.4rem;
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
</style>
