<!--
README: Bluefin Wolves Teaser Landing Page Component
===================================================
- Page Path: projectbluefin.io/wolves
- Comic Content: Delegated to WolvesComicReader.vue. PDF URL is managed
  by the component itself (BASE_URL + color-with-bluefin.pdf).
- Intercepted Communications: Rendered by `src/components/wolves/WolvesLoreColumn.vue`.
- QR Sidebar: Rendered by `src/components/wolves/WolvesQrCodes.vue`.
- Quotes: Sourced from `src/data/bazzite-quotes.json` with fields
`quote`, `attribution`, optional `context`, and optional `date`.
- Donate QR Code: Placeholder target is `#` until the final donation URL is approved.
  To change the donation target URL, update `scripts/generate-qrs.js` and re-run.
- Playlist ID in use: `PLA78oiE-RGAE` ("Bluefin: Seven Days to the Wolves" on YouTube).
-->
<script setup lang="ts">
import { ref } from 'vue'
import TopNavbar from './components/TopNavbar.vue'
import WolvesComicReader from './components/wolves/WolvesComicReader.vue'
import WolvesLoreColumn from './components/wolves/WolvesLoreColumn.vue'
import WolvesQrCodes from './components/wolves/WolvesQrCodes.vue'
import WolvesSoundtrack from './components/wolves/WolvesSoundtrack.vue'
import { wolvesRelease } from './data/wolves-story'

// Console Email Submission
const emailInput = ref('')
const isSubmittingEmail = ref(false)
const emailSubmitted = ref(false)
const emailFeedback = ref('')

function handleEmailSubmit() {
  if (!emailInput.value || !emailInput.value.includes('@')) {
    emailFeedback.value = 'Error from server (BadRequest): invalid email coordinate'
    return
  }
  isSubmittingEmail.value = true
  emailFeedback.value = 'kubectl rollout status deployment/comms-relay-agent -n bazzite'
  setTimeout(() => {
    isSubmittingEmail.value = false
    emailSubmitted.value = true
    emailFeedback.value = 'deployment "comms-relay-agent" successfully rolled out // CONNECTION SECURED.'
  }, 1500)
}
</script>

<template>
  <div class="wolves-teaser-page">
    <TopNavbar />

    <div class="wolves-layout">
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

      <div class="content-grid">
        <div class="col-left">
          <WolvesComicReader
            :chapters="wolvesRelease.chapters"
          />

          <WolvesSoundtrack />
        </div>

        <div class="col-right">
          <WolvesLoreColumn />
          <WolvesQrCodes />

          <div class="decryption-meter-card">
            <div class="meter-header">
              <span class="meter-title font-mono">DECRYPTION_STATUS // CHAPTER_02</span>
              <span class="meter-percentage font-mono">84%</span>
            </div>
            <div class="meter-bar-container">
              <div class="meter-bar-fill" style="width: 84%" />
            </div>
            <p class="meter-details font-mono">
              Operatives active: 1,337 // Decoding node: PROMETHEUS-7
            </p>
          </div>
        </div>
      </div>

      <section id="wolves-support" class="comic-reader-section">
        <div class="support-wrap">
          <h2 class="title-h2">
            Establish Secure Channel
          </h2>
          <p class="title-p">
            Subscribe to receive decrypted transmissions and critical notifications when Chapter 1 launches. Or connect to the operative mesh directly on Discord.
          </p>
        </div>

        <div class="community-console-grid">
          <div class="terminal-console-card">
            <div class="console-header">
              <span class="console-title font-mono">nimbinatus@blue-universal:~</span>
              <div class="gnome-window-controls">
                <button class="gnome-control-btn minimize" aria-label="Minimize" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="5.5" width="8" height="1" fill="currentColor" /></svg>
                </button>
                <button class="gnome-control-btn maximize" aria-label="Maximize" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1" /></svg>
                </button>
                <button class="gnome-control-btn close" aria-label="Close" tabindex="-1" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" /></svg>
                </button>
              </div>
            </div>
            <div class="console-body">
              <p class="console-text font-mono text-cyan">
                nimbinatus@blue-universal:~$ kubectl apply -f bazzite-comms.yaml
              </p>
              <p class="console-text font-mono text-green">
                configmap/bazzite-comms-config created
                <br>deployment.apps/comms-relay-agent created
              </p>
              <p class="console-text font-mono text-gray">
                [SYSTEM] Enter operative email to launch deployment:
              </p>

              <form v-if="!emailSubmitted" class="console-form" @submit.prevent="handleEmailSubmit">
                <span class="console-prompt font-mono">&gt;</span>
                <input
                  v-model="emailInput"
                  type="email"
                  placeholder="operative@domain.xyz"
                  class="console-input font-mono"
                  :disabled="isSubmittingEmail"
                  required
                >
                <button
                  type="submit"
                  class="console-submit-btn font-mono"
                  :disabled="isSubmittingEmail"
                >
                  [ APPLY ]
                </button>
              </form>

              <div v-if="emailFeedback" class="console-feedback font-mono" :class="{ success: emailSubmitted }">
                {{ emailFeedback }}
              </div>
            </div>
          </div>

          <div class="discord-invite-card">
            <h3 class="discord-title font-mono">
              [ SECURE_MESH_LINK ]
            </h3>
            <p class="discord-desc">
              Connect to the live mesh. Chat with core maintainers, coordinate Linux workstation factory builds, and decrypt incoming lore with the community.
            </p>
            <div class="discord-action-wrap">
              <a
                href="https://discord.gg/projectbluefin"
                target="_blank"
                rel="noopener noreferrer"
                class="discord-btn"
              >
                JOIN THE MESH (DISCORD) &rarr;
              </a>
              <span class="discord-coords font-mono">COORDS: 42.109 / -83.045 // MESH_ACTIVE</span>
            </div>
          </div>
        </div>

        <div class="support-links font-mono">
          <a href="https://store.projectbluefin.io" target="_blank" rel="noopener noreferrer">STORE_ACCESS</a>
          <span class="separator">|</span>
          <a href="https://docs.projectbluefin.io/donations" target="_blank" rel="noopener noreferrer">DONATE_FUNDS</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-teaser-page {
  background-image: url('/evening/10-bluefin-night.webp');
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

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;

  @media (min-width: 1024px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 16px;
  }
}

.col-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;

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

.col-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 1024px) {
    height: 100%;
  }
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

.dispatch-quote-section {
  @media (min-width: 1024px) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
}

.decryption-meter-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(125, 211, 252, 0.25);
  background: linear-gradient(180deg, rgba(8, 14, 24, 0.96), rgba(4, 9, 18, 0.98));
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.34);
}

.meter-header,
.support-links,
.discord-title,
.console-title,
.console-text,
.console-prompt,
.console-input,
.console-submit-btn,
.console-feedback,
.meter-title,
.meter-percentage,
.meter-details,
.discord-coords {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.meter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meter-title {
  color: #7dd3fc;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
}

.meter-percentage {
  color: #f8fafc;
  font-size: 0.9rem;
  font-weight: 700;
}

.meter-bar-container {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  overflow: hidden;
}

.meter-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #60a5fa);
}

.meter-details {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.5;
}

.comic-reader-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  background: linear-gradient(180deg, rgba(7, 12, 20, 0.9), rgba(6, 10, 16, 0.95));
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
}

.support-wrap {
  display: grid;
  gap: 8px;
}

.title-h2 {
  margin: 0;
  color: #f8fafc;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
}

.title-p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.7;
}

.community-console-grid {
  display: grid;
  gap: 16px;

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
    align-items: stretch;
  }
}

.terminal-console-card,
.discord-invite-card {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(2, 6, 12, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 28px rgba(0, 0, 0, 0.24);
}

.terminal-console-card {
  overflow: hidden;
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.console-title {
  color: #e2e8f0;
  font-size: 0.82rem;
}

.gnome-window-controls {
  display: inline-flex;
  gap: 8px;
}

.gnome-control-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.06);
}

.console-body {
  display: grid;
  gap: 12px;
  padding: 18px 16px 20px;
}

.console-text,
.console-feedback {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
}

.text-cyan {
  color: #7dd3fc;
}

.text-green {
  color: #86efac;
}

.text-gray {
  color: #94a3b8;
}

.console-form {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;

  @media (max-width: 639px) {
    grid-template-columns: 1fr;
  }
}

.console-prompt {
  color: #7dd3fc;
  font-size: 0.92rem;
}

.console-input {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.85);
  color: #f8fafc;
  padding: 12px 14px;
}

.console-submit-btn {
  border: 0;
  border-radius: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: white;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.console-feedback {
  color: #cbd5e1;

  &.success {
    color: #86efac;
  }
}

.discord-invite-card {
  display: grid;
  gap: 14px;
  align-content: space-between;
  padding: 18px;
}

.discord-title {
  margin: 0;
  color: #7dd3fc;
  font-size: 0.82rem;
  letter-spacing: 0.14em;
}

.discord-desc {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.7;
}

.discord-action-wrap {
  display: grid;
  gap: 10px;
}

.discord-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: white;
  text-decoration: none;
  font-weight: 700;
}

.discord-coords {
  color: #94a3b8;
  font-size: 0.74rem;
}

.support-links {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: #94a3b8;
  font-size: 0.8rem;
}

.support-links a {
  color: #7dd3fc;
  text-decoration: none;
}

.separator {
  opacity: 0.45;
}
</style>
