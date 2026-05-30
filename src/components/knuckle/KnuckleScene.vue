<script setup lang="ts">
import { onMounted, ref } from 'vue'

const isLoaded = ref(false)
onMounted(() => {
  setTimeout(() => {
    isLoaded.value = true
  }, 150)
})
</script>

<template>
  <div class="knuckle-text" :class="{ 'is-loaded': isLoaded }">
    <div class="hero-tag">
      <strong>Project Bluefin Presents&hellip;</strong>
    </div>

    <h1 class="hero-title">
      Bluespeed
    </h1>

    <p class="hero-tagline">
      The Bluefin experience for your homelab.
    </p>

    <p class="hero-desc">
      One management suite for every service and container you run at home. Image-based, auto-updating, zero maintenance — for the servers in your closet.
    </p>

    <p class="hero-desc">
      Digital sovereignty isn't just for nations. Do it in style, with the nicest dashboards.
    </p>

    <p class="hero-desc">
      Built on <a href="https://flatcar.org" target="_blank" rel="noopener noreferrer">Flatcar Container Linux</a> — a <a href="https://www.cncf.io/projects/flatcar/" target="_blank" rel="noopener noreferrer">CNCF incubating project</a> with eight years of production use. Managed by <a href="https://kubestellar.io" target="_blank" rel="noopener noreferrer">KubeStellar</a>. Boot the ISO, pick a disk, done in under a minute.
    </p>

    <div class="alpha-badge">
      ⚠️ Beta — take appropriate precautions
    </div>
  </div>
</template>

<style scoped lang="scss">
.knuckle-text {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
  width: 100%;
  box-sizing: border-box;

  &.is-loaded {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-tag {
  margin-bottom: 2px;

  strong {
    font-size: 1.4rem;
    font-weight: 400;
    font-family: Inter;
    text-transform: uppercase;
    color: var(--color-text-light);
    display: block;
  }
}

.hero-title {
  font-family: Inter;
  font-weight: 700;
  font-size: 4.2rem;
  text-transform: uppercase;
  color: var(--color-blue-light);
  margin: 0 0 6px 0;
  line-height: 1;
  padding-top: 0;
  padding-left: 0;
}

.hero-tagline {
  font-size: 1.4rem;
  font-weight: 400;
  color: var(--color-text-light);
  margin: 0 0 6px 0;
  line-height: 1.5;
}

.hero-desc {
  font-size: 1.4rem;
  line-height: 1.5;
  color: var(--color-text-light);
  margin: 0 0 6px 0;

  a {
    color: var(--color-blue-light);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.alpha-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text-light);
  background: rgba(var(--color-bg-rgb), 0.5);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 5px 12px;
  margin-bottom: 0;
}

.release-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 4px;

  a {
    color: var(--color-blue-light);
    font-size: 1.3rem;
    font-weight: 600;
    text-decoration: none;
    opacity: 0.85;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
}

.back-link {
  display: inline-block;
  color: var(--color-text-light);
  text-decoration: none;
  font-size: 1.3rem;
  opacity: 0.6;
  margin-bottom: 4px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

@media (max-width: 600px) {
  .alpha-badge {
    font-size: 1.1rem;
    padding: 6px 12px;
  }

  .hero-title {
    font-size: 4.5rem;
  }
}
</style>
