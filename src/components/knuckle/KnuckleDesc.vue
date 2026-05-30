<script setup lang="ts">
import { onMounted, ref } from 'vue'

const isLoaded = ref(false)
onMounted(() => {
  setTimeout(() => {
    isLoaded.value = true
  }, 150)
})
</script>

<!-- 1. Bluespeed is a CNCF-native homelab factory - any Bluefin contributor can deploy the full stack (Flatcar + observability + homelab platform) on their own hardware. -->
<!-- 2. Cloud-native best practices - reproducible, GitOps, CNCF tooling throughout -->
<!-- 3. Justfile-driven - just deploy, just setup-otel, etc. so it's one command -->
<!-- 4. This is the primary mission of bluespeed - not just a personal lab, but a reference implementation of "CNCF lifestyle homelab" -->

<template>
  <div class="knuckle-desc" :class="{ 'is-loaded': isLoaded }">
    <p class="hero-desc">
      <strong>One management suite</strong> for every service and container you run at home.
    </p>
    <p class="hero-desc">
      Image-based, auto-update, zero maintenance, for servers in your closet. <strong>Justfile-driven</strong>, just like Bluefin.
	</p>
	<p class="hero-desc">
      Easy observability, supporting your steps into <strong>digital sovereignity</strong>!
    </p>
  </div>
</template>

<style scoped lang="scss">
.knuckle-desc {
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

.knuckle-desc {
  text-align: center;
}

.hero-desc {
  font-size: 1.4rem;
  line-height: 1.25;
  color: var(--color-text-light);
  margin: 0 0 6px 0;
}

strong {
  font-weight: 600;
}
</style>
