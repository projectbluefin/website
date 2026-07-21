<script setup lang="ts">
import { useFadeInUp } from '../../composables'

const { isLoaded } = useFadeInUp()
</script>

<!-- 1. Bluespeed is a CNCF-native homelab factory - any Bluefin contributor can deploy the full stack (Flatcar + observability + homelab platform) on their own hardware. -->
<!-- 2. Cloud-native best practices - reproducible, GitOps, CNCF tooling throughout -->
<!-- 3. Justfile-driven - just deploy, just setup-otel, etc. so it's one command -->
<!-- 4. This is the primary mission of bluespeed - not just a personal lab, but a reference implementation of "CNCF lifestyle homelab" -->

<template>
  <div class="server-desc" :class="{ 'is-loaded': isLoaded }">
    <p class="hero-desc">
      Bluefin's `freedesktop-sdk` server image. <strong>One management suite</strong> for every service and container in your home. K8s conquers the home.
    </p>
    <p class="hero-desc">
      Image-based, auto-update, zero maintenance, for servers in your closet.
    </p>
    <p class="hero-desc">
      Fully API and MCP driven, the ultimate <i>invisible</i> appliance for the home.
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '../../style/setup/mixins';

.server-desc {
  width: 100%;
  @include mixins.fade-in-up;
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
