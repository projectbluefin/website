<script setup lang="ts">
import qrDonate from '@/assets/svg/qr-donate.svg'
import qrStore from '@/assets/svg/qr-store.svg'
</script>

<template>
  <section class="qr-grid" aria-label="Support Project Bluefin">
    <article class="qr-card">
      <h3 class="qr-title">
        Store
      </h3>
      <div class="qr-image-box">
        <img :src="qrStore" alt="QR code for the Project Bluefin store">
      </div>
      <div class="qr-action-wrap">
        <a href="https://store.projectbluefin.io" target="_blank" rel="noopener noreferrer" class="qr-btn blue">
          VISIT STORE
        </a>
        <span class="qr-domain">store.projectbluefin.io</span>
      </div>
    </article>

    <article class="qr-card">
      <h3 class="qr-title">
        Donate to Project Bluefin
      </h3>
      <div class="qr-image-box">
        <img :src="qrDonate" alt="QR code for Project Bluefin donations">
      </div>
      <div class="qr-action-wrap">
        <a href="https://github.com/sponsors/castrojo" target="_blank" rel="noopener noreferrer" class="qr-btn dark">
          DONATE
        </a>
        <span class="qr-domain">github.com/sponsors/castrojo</span>
      </div>
    </article>

    <article class="qr-card">
      <h3 class="qr-title">
        Cast Soundtrack
      </h3>
      <div class="qr-image-box">
        <svg viewBox="0 0 24 24" class="chromecast-logo">
          <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-6H3c-1.1 0-2 .9-2 2v1h2V5h18v14h-9v2h9c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="#3b82f6" />
        </svg>
      </div>
      <div class="qr-action-wrap">
        <google-cast-launcher class="chromecast-btn" />
        <span class="qr-domain">chromecast / google cast</span>
      </div>
    </article>
  </section>
</template>

<style scoped lang="scss">
.qr-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;

  @media (min-width: 600px) {
    flex-direction: row;
  }
}

.qr-card {
  flex: 1;
  background-color: #10151f;
  border: 1px solid #272727;
  padding: 24px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.qr-title {
  font-size: 1.4rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #ffffff;
  margin: 0;
}

.qr-image-box {
  width: 192px;
  height: 192px;
  background-color: #0c1016;
  border: 1px solid #272727;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s;

  &:hover {
    transform: scale(1.05);
  }
}

.qr-image-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-action-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.qr-btn {
  display: inline-block;
  color: #ffffff;
  font-weight: 700;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 24px;
  border-radius: 20px;
  text-decoration: none;
  transition: background-color 0.2s;
}

.qr-btn.blue {
  background-color: var(--color-blue);
}

.qr-btn.blue:hover {
  background-color: var(--color-blue-light);
}

.qr-btn.dark {
  background-color: #272727;
}

.qr-btn.dark:hover {
  background-color: #1e1e1e;
}

.qr-domain {
  font-size: 1.1rem;
  color: #616161;
}

.chromecast-logo {
  width: 120px;
  height: 120px;
}

.chromecast-btn {
  --cast-button-color: #3b82f6;
  --cast-button-active-color: #60a5fa;
  --cast-button-size: 48px;
  display: inline-block;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
}
</style>
