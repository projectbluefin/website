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

    <p class="hero-desc">
      A <a href="https://freedesktop-sdk.io" target="_blank" rel="noopener noreferrer">Freedesktop.org</a> and <a href="https://os.gnome.org" target="_blank" rel="noopener noreferrer">GNOME OS</a> image, designed from the ground up to be the most modern raptor in the pack. The familiar Bluefin desktop and developer experience, in a whole new streamlined package. Built from the best OS tech from the <a href="https://cncf.io" target="_blank" rel="noopener noreferrer">CNCF</a>, <a href="https://www.apache.org" target="_blank" rel="noopener noreferrer">Apache Foundation</a>, and the <a href="https://uapi-group.org" target="_blank" rel="noopener noreferrer">UAPI Group</a>. Do not run, you'll only die tired.
    </p>
  </div>
</template>

<style scoped lang="scss">
.dakota-text {
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
  color: var(--color-blue-light);
  margin: 0 0 24px 0;
  line-height: 1;
  padding-top: 0;
  padding-left: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.hero-desc {
  font-size: 1.6rem;
  line-height: 1.6;
  color: var(--color-text-light);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);

  a {
    color: var(--color-blue-light);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
