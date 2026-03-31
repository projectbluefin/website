<script setup lang="ts">
import type { MessageSchema } from '../locales/schema'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

// Left side navigation
const leftNavLinks = [
  {
    name: t('TopBar.Docs'),
    href: 'https://docs.projectbluefin.io/introduction'
  },
  { name: t('TopBar.AskBluefin'), href: 'https://ask.projectbluefin.io', external: true }
]

// Right side navigation
const rightNavLinks = [
  { name: t('TopBar.Blog'), href: 'https://docs.projectbluefin.io/blog' },
  { name: t('TopBar.Changelog'), href: 'https://docs.projectbluefin.io/changelogs' },
  {
    name: t('TopBar.Discussions'),
    href: 'https://github.com/ublue-os/bluefin/discussions',
    external: true
  },
  {
    name: t('TopBar.Feedback'),
    href: 'https://feedback.projectbluefin.io/',
    external: true
  },
  {
    name: t('TopBar.Store'),
    href: 'https://store.projectbluefin.io',
    external: true
  }
]

const allNavLinks = [...leftNavLinks, ...rightNavLinks]

const menuOpen = ref(false)
const navRef = ref<HTMLElement | null>(null)

onClickOutside(navRef, () => {
  menuOpen.value = false
})

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <nav ref="navRef" class="docusaurus-navbar navbar navbar--fixed-top">
    <div class="navbar__inner">
      <div class="navbar__items">
        <a href="https://projectbluefin.io" class="navbar__brand">
          <div class="navbar__logo">
            <img src="/img/logo.svg" alt="Bluefin" loading="eager">
          </div>
          <b class="navbar__title text--truncate">Bluefin</b>
        </a>
        <a
          v-for="link in leftNavLinks"
          :key="link.name"
          :href="link.href"
          class="navbar__item navbar__link navbar__link--desktop"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
        >
          {{ link.name }}
        </a>
      </div>

      <div class="navbar__items navbar__items--right">
        <a
          v-for="link in rightNavLinks"
          :key="link.name"
          :href="link.href"
          class="navbar__item navbar__link navbar__link--desktop"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
        >
          {{ link.name }}
        </a>
      </div>

      <!-- Hamburger button — mobile only -->
      <button
        class="navbar__toggle"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="navbar__toggle-bar" />
        <span class="navbar__toggle-bar" />
        <span class="navbar__toggle-bar" />
      </button>
    </div>

    <!-- Mobile dropdown menu -->
    <div v-if="menuOpen" class="navbar__mobile-menu">
      <a
        v-for="link in allNavLinks"
        :key="link.name"
        :href="link.href"
        class="navbar__mobile-link"
        :target="link.external ? '_blank' : undefined"
        :rel="link.external ? 'noopener noreferrer' : undefined"
        @click="closeMenu"
      >
        {{ link.name }}
      </a>
    </div>
  </nav>
</template>

<style scoped lang="scss">
// Docusaurus navbar styles - matching the docs site exactly
.docusaurus-navbar {
  // Infima CSS variables - matching Docusaurus defaults
  --ifm-navbar-background-color: #242526;
  --ifm-navbar-link-color: rgba(255, 255, 255, 0.9);
  --ifm-navbar-link-hover-color: #4a69bd;
  --ifm-navbar-height: 60px;
  --ifm-navbar-padding-horizontal: 1rem;
  --ifm-navbar-padding-vertical: calc((var(--ifm-navbar-height) - var(--ifm-navbar-item-height)) / 2);
  --ifm-navbar-item-height: 32px;
  --ifm-navbar-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1);
  --ifm-transition-fast: 200ms;
  --ifm-transition-timing-default: cubic-bezier(0.4, 0, 0.2, 1);

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--ifm-navbar-height);
  background-color: var(--ifm-navbar-background-color);
  box-shadow: var(--ifm-navbar-shadow);
  z-index: 1000;

  // Use Docusaurus/Infima system font stack
  font-family:
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Ubuntu,
    Cantarell,
    Noto Sans,
    sans-serif,
    Apple Color Emoji,
    Segoe UI Emoji,
    Segoe UI Symbol,
    Noto Color Emoji;

  // Better text rendering
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.navbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1440px;
  margin: 0 auto;
  padding: var(--ifm-navbar-padding-vertical) var(--ifm-navbar-padding-horizontal);
  height: var(--ifm-navbar-height);
}

.navbar__items {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  flex-wrap: nowrap;
}

.navbar__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  margin-right: 1rem;
  height: var(--ifm-navbar-item-height);
  transition: opacity var(--ifm-transition-fast) var(--ifm-transition-timing-default);

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    outline: 2px solid var(--ifm-navbar-link-hover-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.navbar__logo {
  display: flex;
  align-items: center;
  height: 100%;

  img {
    height: 2rem;
    width: auto;
    display: block;
    max-width: none;
  }
}

.navbar__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ifm-navbar-link-color);
  line-height: 1;
}

.text--truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar__item {
  display: inline-flex;
  align-items: center;
}

.navbar__link {
  color: var(--ifm-navbar-link-color);
  text-decoration: none;
  font-size: 12pt;
  font-weight: 400;
  padding: 0 0.75rem;
  line-height: 1.5;
  display: flex;
  align-items: center;
  height: 100%;
  transition: color var(--ifm-transition-fast) var(--ifm-transition-timing-default);

  &:hover {
    color: var(--ifm-navbar-link-hover-color);
  }

  &:focus-visible {
    outline: 2px solid var(--ifm-navbar-link-hover-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.navbar__items--right {
  flex: 1;
  justify-content: flex-end;
}

// Hamburger button — hidden on desktop
.navbar__toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}

.navbar__toggle-bar {
  display: block;
  width: 22px;
  height: 2px;
  background-color: var(--ifm-navbar-link-color);
  border-radius: 2px;
  transition: background-color var(--ifm-transition-fast) var(--ifm-transition-timing-default);
}

.navbar__toggle:hover .navbar__toggle-bar {
  background-color: var(--ifm-navbar-link-hover-color);
}

// Mobile dropdown
.navbar__mobile-menu {
  display: none;
  flex-direction: column;
  background-color: var(--ifm-navbar-background-color);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem 1rem;
}

.navbar__mobile-link {
  color: var(--ifm-navbar-link-color);
  text-decoration: none;
  font-size: 14pt;
  font-weight: 400;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: color var(--ifm-transition-fast) var(--ifm-transition-timing-default);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    color: var(--ifm-navbar-link-hover-color);
  }
}

// Mobile responsive - matching Docusaurus breakpoints exactly
@media (max-width: 996px) {
  .docusaurus-navbar {
    --ifm-navbar-padding-horizontal: 0.5rem;
  }

  .navbar__link {
    font-size: 11pt;
    padding: 0 0.5rem;
  }

  .navbar__brand {
    margin-right: 0.5rem;
  }
}

@media (max-width: 768px) {
  .docusaurus-navbar {
    height: auto;
    min-height: var(--ifm-navbar-height);
  }

  .navbar__inner {
    height: var(--ifm-navbar-height);
  }

  .navbar__link--desktop {
    display: none;
  }

  .navbar__items--right {
    display: none;
  }

  .navbar__brand {
    margin: 0;
  }

  .navbar__toggle {
    display: flex;
  }

  .navbar__mobile-menu {
    display: flex;
  }
}
</style>
