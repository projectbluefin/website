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
  <div class="dakota-text" :class="{ 'is-loaded': isLoaded }">
    <div class="hero-tag">
      <strong>Project Bluefin Presents&hellip;</strong>
    </div>

    <h1 class="hero-title">
      Dakota
    </h1>

    <p class="hero-tagline">
      The Final Form. Bluefin Perfected.
    </p>

    <p class="hero-desc">
      Dakota is a <a href="https://freedesktop-sdk.io" target="_blank" rel="noopener noreferrer">Freedesktop.org</a> and <a href="https://os.gnome.org" target="_blank" rel="noopener noreferrer">GNOME OS</a> image designed from the ground up to be the most modern raptor in the pack. The familiar Bluefin desktop and developer experience, in a whole new streamlined package. Built from the best OS tech from the <a href="https://cncf.io" target="_blank" rel="noopener noreferrer">CNCF</a>, <a href="https://www.apache.org" target="_blank" rel="noopener noreferrer">Apache Foundation</a>, and the <a href="https://uapi-group.org" target="_blank" rel="noopener noreferrer">UAPI Group</a>. Do not run, you'll only die tired.
    </p>

    <div class="alpha-badge">
      ⚠️ Alpha software — take appropriate precautions
    </div>

    <div class="release-links">
      <a
        href="https://docs.projectbluefin.io/blog/making-our-own-fate/"
        target="_blank"
        rel="noopener noreferrer"
      >Alpha 2 Announcement →</a>
      <a
        href="https://docs.projectbluefin.io/blog/dakota-alpha-1/"
        target="_blank"
        rel="noopener noreferrer"
      >Alpha 1 Announcement →</a>
    </div>

    <slot />
  </div>
</template>

<style scoped lang="scss">
.dakota-text {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
  background: rgba(var(--color-bg-rgb), 0.55);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 28px 32px;
  width: 100%;
  box-sizing: border-box;

  &.is-loaded {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-tag {
  margin-bottom: 12px;

  strong {
    font-size: 2rem;
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
  font-size: 6rem;
  text-transform: uppercase;
  color: var(--color-text-light);
  margin: 0 0 24px 0;
  line-height: 1;
  padding-top: 0;
  padding-left: 0;
}

.hero-tagline {
  font-size: 1.6rem;
  font-weight: 400;
  color: var(--color-text-light);
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.hero-desc {
  font-size: 1.6rem;
  line-height: 1.6;
  color: var(--color-text-light);
  margin: 0 0 20px 0;

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
  gap: 8px;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-light);
  background: rgba(var(--color-bg-rgb), 0.5);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 8px 16px;
  margin-bottom: 0;
}

.release-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 10px;

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

@media (max-width: 500px) {
  .alpha-badge {
    font-size: 1.1rem;
    padding: 6px 12px;
  }

  .hero-title {
    font-size: 4.5rem;
  }
}
</style>
