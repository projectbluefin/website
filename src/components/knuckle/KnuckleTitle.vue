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
  <div class="knuckle-title" :class="{ 'is-loaded': isLoaded }">
    <div class="title-inner">
      <div class="title-col-left">
        <div class="hero-tag">
          <strong>Presenting</strong>
        </div>

        <h1 class="hero-title">
          Bluefin Server
        </h1>
      </div>

      <div class="title-col-right">
        <p class="title-subtitle">Seamless homelab with CNCF tech stack</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.knuckle-title {
  width: 100%;
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
  box-sizing: border-box;

  &.is-loaded {
    opacity: 1;
    transform: translateY(0);
  }
}

.title-inner {
  display: flex;
  flex-direction: row;
  gap: 24px;
}

.title-col-left {
  flex: 7;
}

.title-col-right {
  flex: 3;
  display: flex;
  place-content: center;
}

.title-subtitle {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text-light);
  margin: 0;
  line-height: 1.3;
  text-align: right;
  text-shadow: 0 2px 8px rgba(var(--color-bg-rgb), 0.6);
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
    text-shadow: 0 2px 8px rgba(var(--color-bg-rgb), 0.6);
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
  text-shadow: 0 2px 8px rgba(var(--color-bg-rgb), 0.6);
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 4.5rem;
  }
}
</style>
