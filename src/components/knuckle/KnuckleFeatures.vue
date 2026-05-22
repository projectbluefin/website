<script setup lang="ts">
import type { Component } from 'vue'
import {
  IconAutorenew,
  IconChip,
  IconCodeBraces,
  IconDatabase,
  IconDocker,
  IconKubernetes,
  IconMagnifyScan,
  IconMonitorMultiple,
  IconPowerCycle,
  IconServerNetwork,
  IconShieldCheck,
  IconVpn,
} from '@iconify-prerendered/vue-mdi'

const baseUrl = import.meta.env.BASE_URL

type CncfTier = 'graduated' | 'incubating' | 'sandbox'

interface SysextCard {
  name: string
  href: string
  icon: Component
  desc: string
  cncf?: CncfTier
}

const cards: SysextCard[] = [
  // CNCF Graduated
  { name: 'Falco', href: 'https://falco.org', icon: IconShieldCheck, desc: 'Runtime security & threat detection', cncf: 'graduated' },
  // CNCF Incubating
  { name: 'KubeVirt', href: 'https://kubevirt.io', icon: IconMonitorMultiple, desc: 'Virtual Machine Management', cncf: 'incubating' },
  { name: 'KubeStellar', href: 'https://kubestellar.io', icon: IconKubernetes, desc: 'Multi-cluster management and dashboard', cncf: 'incubating' },
  // CNCF Sandbox
  { name: 'k3s', href: 'https://k3s.io', icon: IconKubernetes, desc: 'Lightweight Kubernetes cluster', cncf: 'sandbox' },
  { name: 'Inspektor Gadget', href: 'https://www.inspektor-gadget.io', icon: IconMagnifyScan, desc: 'eBPF-based debugging & tracing', cncf: 'sandbox' },
  { name: 'kured', href: 'https://kured.dev', icon: IconPowerCycle, desc: 'Safe automatic node reboots for Kubernetes', cncf: 'sandbox' },
  { name: 'Podman', href: 'https://podman.io', icon: IconDocker, desc: 'Daemonless container engine', cncf: 'sandbox' },
  // Community
  { name: 'Docker', href: 'https://docker.com', icon: IconDocker, desc: 'You probably have a bunch of these' },
  { name: 'Tailscale', href: 'https://tailscale.com', icon: IconVpn, desc: 'Zero-config WireGuard mesh VPN' },
  { name: 'Incus', href: 'https://linuxcontainers.org/incus/', icon: IconServerNetwork, desc: 'Container & VM manager' },
  { name: 'ZFS', href: 'https://openzfs.org', icon: IconDatabase, desc: 'Advanced filesystem & volume manager' },
]

const tierLabel: Record<CncfTier, string> = {
  graduated: 'CNCF Graduated',
  incubating: 'CNCF Incubating',
  sandbox: 'CNCF Sandbox',
}

interface ClientCard {
  name: string
  href: string
  icon: Component
  desc: string
  org: string
  orgLabel: string
}

const clients: ClientCard[] = [
  {
    name: 'Goose',
    href: 'https://github.com/aaif-goose/goose',
    icon: IconCodeBraces,
    desc: 'Open Source AI agent, your "terminal" to your local AI network.',
    org: 'aaif',
    orgLabel: 'Agentic AI Foundation',
  },
  {
    name: 'linux-mcp-server',
    href: 'https://github.com/ublue-os/linux-mcp-server',
    icon: IconServerNetwork,
    desc: 'MCP server for Linux system diagnostics — OS, processes, services, logs, network',
    org: 'ublue',
    orgLabel: 'RHEL Lightspeed',
  },
]
</script>

<template>
  <section class="knuckle-features">
    <div class="container">
      <div class="features-header">
        <div class="icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
        <span class="brand-title">Extend with Industry Standard Components</span>
      </div>
      <p class="features-desc">
        Everything is optional. Start with a blank OS and then bolt on what you need. System Extensions activate on boot and extend the core system as needed. Only use what you need. Start with a simple set of containers for a single homeserver or scale up to an entire self healing cluster for your self hosting needs. Over a decade of production use:
      </p>

      <div class="app-grid">
        <a
          v-for="card in cards"
          :key="card.name"
          :href="card.href"
          target="_blank"
          rel="noopener noreferrer"
          class="app-card"
          :class="card.cncf ?? 'other'"
        >
          <div class="app-card-top">
            <div class="app-icon">
              <component :is="card.icon" />
            </div>
            <span v-if="card.cncf" class="app-badge" :class="card.cncf">{{ tierLabel[card.cncf] }}</span>
          </div>
          <div class="app-name">{{ card.name }}</div>
          <div class="app-desc">{{ card.desc }}</div>
        </a>
      </div>

      <!-- AI Clients section -->
      <div class="section-divider" />
      <div class="features-header">
        <div class="icon-wrap">
          <IconCodeBraces />
        </div>
        <span class="brand-title">Agent Endpoints</span>
      </div>
      <p class="features-desc">
        Bring your own LLM. Optimized for local workloads, clients wire into your infrastructure out of the box.
      </p>

      <div class="app-grid">
        <a
          v-for="card in clients"
          :key="card.name"
          :href="card.href"
          target="_blank"
          rel="noopener noreferrer"
          class="app-card"
          :class="`org-${card.org}`"
        >
          <div class="app-card-top">
            <div class="app-icon">
              <component :is="card.icon" />
            </div>
            <span class="app-badge" :class="`org-${card.org}`">{{ card.orgLabel }}</span>
          </div>
          <div class="app-name">{{ card.name }}</div>
          <div class="app-desc">{{ card.desc }}</div>
        </a>
      </div>

      <!-- RHEL Lightspeed shoutout -->
      <div class="lightspeed-row">
        <img
          :src="`${baseUrl}brands/alumni/redhat.svg`"
          alt="Red Hat"
          class="lightspeed-logo"
        >
        <span class="lightspeed-text">Thanks to the <a href="https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/lightspeed" target="_blank" rel="noopener noreferrer">RHEL Lightspeed</a> team!</span>
      </div>

      <div class="brand-grid brand-grid-lower">
        <div class="brand-item-row">
          <div class="brand-item">
            <div>
              <div class="icon-wrap">
                <IconAutorenew />
              </div>
              <a class="brand-title" href="https://www.flatcar.org/docs/latest/setup/releases/update-conf/" target="_blank" rel="noopener noreferrer">Automatic Updates</a>
            </div>
            <p>A/B partition scheme. Always running a supported, secure release.</p>
          </div>
          <div class="brand-item">
            <div>
              <div class="icon-wrap">
                <IconChip />
              </div>
              <span class="brand-title">amd64 + ARM64</span>
            </div>
            <p>Bootable ISOs for both architectures. Same install experience everywhere.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.knuckle-features {
  min-height: auto;
  padding: 0;

  .container {
    padding: 16px 20px;
  }

  .icon-wrap {
    svg {
      display: block;
      height: 24px;
      width: 24px;
      color: var(--color-text-light);
    }
  }

  .features-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .features-desc {
    font-size: 1.3rem;
    color: var(--color-text);
    opacity: 0.65;
    margin: 0 0 16px;
    line-height: 1.5;
  }

  // App-store card grid
  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    border: 1px solid var(--color-border-light);
    background: rgba(255, 255, 255, 0.03);
    transition:
      background 0.15s,
      border-color 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.07);
    }

    &.graduated {
      border-color: rgba(77, 184, 160, 0.35);
      background: rgba(77, 184, 160, 0.05);
      &:hover {
        background: rgba(77, 184, 160, 0.1);
      }
    }
    &.incubating {
      border-color: rgba(240, 160, 64, 0.35);
      background: rgba(240, 160, 64, 0.05);
      &:hover {
        background: rgba(240, 160, 64, 0.1);
      }
    }
    &.sandbox {
      border-color: rgba(136, 153, 187, 0.35);
      background: rgba(136, 153, 187, 0.05);
      &:hover {
        background: rgba(136, 153, 187, 0.1);
      }
    }
  }

  .app-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
  }

  .app-icon {
    svg {
      display: block;
      width: 20px;
      height: 20px;
      color: var(--color-text-light);
      opacity: 0.8;
    }
  }

  .app-badge {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;

    &.graduated {
      color: #4db8a0;
      background: rgba(77, 184, 160, 0.15);
    }
    &.incubating {
      color: #f0a040;
      background: rgba(240, 160, 64, 0.15);
    }
    &.sandbox {
      color: #8899bb;
      background: rgba(136, 153, 187, 0.15);
    }
    // AAIF badge
    &.org-aaif {
      color: #c084fc;
      background: rgba(192, 132, 252, 0.15);
    }
    // Universal Blue badge
    &.org-ublue {
      color: #60a5fa;
      background: rgba(96, 165, 250, 0.15);
    }
  }

  // org-aaif card
  .app-card.org-aaif {
    border-color: rgba(192, 132, 252, 0.35);
    background: rgba(192, 132, 252, 0.05);
    &:hover {
      background: rgba(192, 132, 252, 0.1);
    }
  }

  // org-ublue card
  .app-card.org-ublue {
    border-color: rgba(96, 165, 250, 0.35);
    background: rgba(96, 165, 250, 0.05);
    &:hover {
      background: rgba(96, 165, 250, 0.1);
    }
  }

  .section-divider {
    height: 1px;
    background: var(--color-border-light);
    margin: 16px 0;
  }

  .lightspeed-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-border-light);
    background: rgba(255, 255, 255, 0.02);

    .lightspeed-logo {
      height: 18px;
      width: auto;
      opacity: 0.7;
      flex-shrink: 0;
      filter: brightness(0) invert(1);
    }

    .lightspeed-text {
      font-size: 1.1rem;
      color: var(--color-text);
      opacity: 0.55;
      line-height: 1.4;

      a {
        color: var(--color-text-light);
        text-decoration: none;
        opacity: 0.8;
        &:hover {
          opacity: 1;
          text-decoration: underline;
        }
      }
    }
  }

  .app-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-text-light);
    line-height: 1.2;
  }

  .app-desc {
    font-size: 1.1rem;
    color: var(--color-text);
    opacity: 0.55;
    line-height: 1.35;
  }

  // Bottom 3-col feature row
  :deep(.brand-item) {
    padding: 20px;
    border: none !important;

    & > div {
      margin-bottom: 10px;
    }

    p {
      margin: 0;
      font-size: 1.4rem !important;
      line-height: 1.5;
    }
  }

  :deep(.brand-item-row) {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid var(--color-border-light);
    margin-top: 16px;

    .brand-item {
      border: none !important;
      padding-top: 16px;

      &:not(:last-child) {
        border-right: 1px solid var(--color-border-light) !important;
      }
    }
  }

  :deep(.brand-grid) {
    margin-bottom: 0;
    gap: 0;
    border-top: none !important;
    border-bottom: none !important;
  }

  :deep(.brand-grid-lower) {
    margin-top: 0;
  }

  :deep(.brand-title) {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-text-light);
    align-self: center;
    text-decoration: none;

    &[href]:hover {
      text-decoration: underline;
      opacity: 0.85;
    }
  }
}

@media (max-width: 600px) {
  .knuckle-features {
    .app-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }

    :deep(.brand-item-row) {
      grid-template-columns: 1fr !important;

      .brand-item {
        border-right: none !important;
      }
    }
  }
}
</style>
