<script setup lang="ts">
import {
  IconAccountGroup,
  IconGnome,
  IconLayers,
  IconShieldCheck,
  IconSourceBranch,
} from '@iconify-prerendered/vue-mdi'
</script>

<template>
  <section class="section-wrap dakota-highlights">
    <div class="container">
      <div class="scene-content visible">
        <div>
          <div>
            <div class="brand-grid">
              <!-- GNOME: full-width hero item -->
              <div class="brand-item brand-gnome">
                <div>
                  <div class="icon-wrap">
                    <IconGnome />
                  </div>
                  <a class="brand-title" href="https://os.gnome.org" target="_blank" rel="noopener noreferrer">GNOME OS</a>
                </div>
                <p>The latest stable release of GNOME, no delays</p>
              </div>

              <!-- Left: primary — freedesktop-sdk -->
              <div class="brand-item brand-primary">
                <div>
                  <div class="icon-wrap">
                    <IconLayers />
                  </div>
                  <a class="brand-title" href="https://freedesktop-sdk.io" target="_blank" rel="noopener noreferrer">Freedesktop SDK</a>
                </div>
                <p>Same battle tested libraries as Flathub. Continuously upgraded, always up to date.</p>
              </div>

              <!-- Right: uutils-coreutils + sudo-rs -->
              <div class="brand-item">
                <div>
                  <div class="icon-wrap">
                    <IconShieldCheck />
                  </div>
                  <a class="brand-title" href="https://github.com/uutils/coreutils" target="_blank" rel="noopener noreferrer">Modern Userspace</a>
                </div>
                <p>bootc, brew, uutils, systemd-boot, container first, and legacy-free</p>
              </div>

              <!-- Left: Designed for Contributors -->
              <div class="brand-item">
                <div>
                  <div class="icon-wrap">
                    <IconAccountGroup />
                  </div>
                  <span class="brand-title">Designed for Contributors</span>
                </div>
                <p>Your path to contributing to some of the coolest projects in desktop Linux. Start here, then level up and become part of the upstream teams.</p>
              </div>

              <!-- Right: BuildStream 2 -->
              <div class="brand-item">
                <div>
                  <div class="icon-wrap">
                    <IconSourceBranch />
                  </div>
                  <span class="brand-title">
                    <a href="https://buildstream.build" target="_blank" rel="noopener noreferrer">BuildStream</a>
                    &amp;
                    <a href="https://buildgrid.build" target="_blank" rel="noopener noreferrer">BuildGrid</a>
                  </span>
                </div>
                <p>Hermetic sandbox builds with distributed execution, reproducible and fully auditable</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.dakota-highlights {
  min-height: auto;
  padding: 24px;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
  border-radius: 12px;

  :deep(.container) {
    padding: 0;
  }

  .icon-wrap {
    svg {
      display: block;
      height: 32px;
      width: 32px;
      color: var(--color-text-light);
    }
  }

  :deep(.brand-item) {
    padding: 14px 20px;
    border-right: none;

    &:nth-child(odd) {
      border-right: none;
    }
  }

  :deep(.brand-gnome) {
    grid-column: 1 / -1;
    border-right: none;

    .icon-wrap svg {
      height: 48px;
      width: 48px;
    }

    p {
      font-weight: 400;
    }
  }

  :deep(.brand-primary) {
    p {
      font-weight: 400;
    }
  }

  :deep(.brand-title) {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--color-text-light);
    align-self: center;
    text-decoration: none;

    &[href]:hover {
      text-decoration: underline;
      opacity: 0.85;
    }

    a {
      color: var(--color-text-light);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
        opacity: 0.85;
      }
    }
  }

  :deep(.brand-grid) {
    margin-bottom: 0;
  }
}

@media (min-width: 957px) {
  .dakota-highlights {
    :deep(.brand-gnome) {
      display: flex;
      flex-direction: row;
      align-items: center;

      & > div {
        margin-bottom: 0;
        flex-shrink: 0;
      }

      p {
        margin-left: auto;
        text-align: right;
        padding-left: 40px;
        font-size: 1.6rem !important;
      }
    }
  }
}

@media (max-width: 956px) {
  .dakota-highlights {
    :deep(.brand-grid) {
      grid-template-columns: 1fr !important;
    }

    :deep(.brand-gnome) {
      p {
        font-size: 1.6rem !important;
      }
    }

    :deep(.brand-item) {
      &:nth-last-child(2) {
        border-bottom: 1px solid var(--color-border-light);
      }
    }
  }
}
</style>
