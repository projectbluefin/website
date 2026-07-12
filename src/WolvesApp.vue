<!--
README: Bluefin Wolves Teaser Landing Page Component
===================================================
- Page Path: projectbluefin.io/wolves
- Comic Content: Delegated to `src/components/wolves/WolvesComicReader.vue`.
  Keep this page shell decoupled and pass only `wolvesRelease.chapters`.
- Recovered transmissions and the embedded QR stack live in
  `src/components/wolves/WolvesLoreColumn.vue`.
- Quotes are sourced from `src/data/bazzite-quotes.json` with fields
  `quote`, `attribution`, optional `context`, and optional `date`.
- To change the donation QR target, update `scripts/generate-qrs.js` and
  re-run the generator so the SVG stays in sync with the approved URL.
- Soundtrack playlist ID: `PLA78oiE-RGAE`.
- `src/components/wolves/WolvesSoundtrack.vue` loads the YouTube IFrame API
  only after user intent, links out to YouTube Music as fallback, and YouTube
  Music playback can require Premium.
- If Spotify support is added, extend the soundtrack data/provider adapter to
  consume a Spotify URI without changing this page composition.
-->
<script setup lang="ts">
import TopNavbar from './components/TopNavbar.vue'
import WolvesComicReader from './components/wolves/WolvesComicReader.vue'
import WolvesLoreColumn from './components/wolves/WolvesLoreColumn.vue'
import WolvesSoundtrack from './components/wolves/WolvesSoundtrack.vue'
import { wolvesRelease } from './data/wolves-story'

const wolvesBackgroundImage = `url(${import.meta.env.BASE_URL}evening/10-bluefin-night.webp)`
</script>

<template>
  <div class="wolves-teaser-page" :style="{ backgroundImage: wolvesBackgroundImage }">
    <TopNavbar />

    <main class="wolves-layout">
      <header class="wolves-hero">
        <div class="hero-text">
          <h1 class="hero-title">
            Seven Days to the <span class="accent">Wolves</span>
          </h1>
          <p class="hero-description">
            In the distant future, open source maintainers are not only sought after, they are hunted. Enslaved by the very machines they created, betrayed by the societies they swore to protect. They fight alone.
            <br><br>Our Childhood's End, is their beginning.
            <br><br>A fundraising effort to immortalize contributors in legend. Issue sponsorships available.
          </p>
          <div class="hero-footnote">
            Coming 2027
          </div>
        </div>
      </header>

      <div class="wolves-content-grid">
        <section data-testid="wolves-comic-column" class="wolves-comic-column">
          <WolvesComicReader :chapters="wolvesRelease.chapters" />
          <WolvesSoundtrack data-testid="wolves-soundtrack" />
        </section>

        <aside data-testid="wolves-lore-column" class="wolves-lore-column">
          <WolvesLoreColumn />
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.wolves-teaser-page {
  background-size: 100% auto;
  background-position: top center;
  background-repeat: repeat-y;
  min-height: 100vh;
  position: relative;
  overflow-x: clip;
  box-sizing: border-box;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 600px;
    background: linear-gradient(to bottom, rgba(12, 16, 22, 0.7), transparent);
    z-index: 0;
    pointer-events: none;
  }
}

.wolves-layout {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

:global(.wolves-player-active) .wolves-layout {
  @media (max-width: 767px) {
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }
}

.wolves-hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 0 20px;
  border-bottom: 1px solid rgba(var(--color-blue-rgb), 0.2);

  .hero-text {
    text-align: center;

    @media (min-width: 768px) {
      text-align: left;
    }
  }

  .hero-title {
    font-size: clamp(2.8rem, 4.8vw, 4.2rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-transform: uppercase;
    margin-bottom: 12px;

    @media (min-width: 768px) {
      font-size: clamp(3.8rem, 5.8vw, 5.2rem);
    }

    .accent {
      color: var(--color-blue);
    }
  }

  .hero-description {
    font-size: 1.3rem;
    line-height: 1.6;
    color: #bdbdbd;
    margin-bottom: 12px;
    max-width: 600px;
  }

  .hero-footnote {
    font-size: 1rem;
    color: rgba(189, 189, 189, 0.6);
    font-style: italic;
  }
}

.wolves-content-grid {
  display: grid;
  gap: 16px;
  width: 100%;

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
    align-items: start;
  }
}

.wolves-comic-column {
  flex-direction: column;
  gap: 16px;
  display: flex;
  width: 100%;
  min-width: 0;
  :deep(.comic-viewport),
  :deep(.scroll-comic-layout),
  :deep(.reader-controls),
  :deep(.sidebar-soundtrack-card) {
    margin-left: 0;
    margin-right: 0;
    max-width: 100%;
    width: 100%;
  }
}

.wolves-lore-column {
  min-width: 0;

  @media (min-width: 1024px) {
    position: sticky;
    top: 1rem;
    align-self: start;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
  }
}
</style>
