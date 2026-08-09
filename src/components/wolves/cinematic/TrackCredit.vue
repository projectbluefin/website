<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  artist: string
  showBy?: boolean
  wide?: boolean
}>(), {
  showBy: true,
  wide: false,
})
</script>

<template>
  <span class="wc-track-credit" :class="{ 'wc-track-credit--wide': wide }">
    <span class="wc-track-credit-title">{{ title }}</span>
    <span class="wc-track-credit-separator" aria-hidden="true">|</span>
    <span class="wc-track-credit-byline"><template v-if="showBy"><span class="wc-track-credit-b">B</span>y </template>{{ artist }}</span>
  </span>
</template>

<style scoped lang="scss">
.wc-track-credit {
  display: inline;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  white-space: nowrap;
}

.wc-track-credit-separator {
  display: inline-block;
  margin: 0 0.4em;
  color: #38bdf8;
  font-weight: 400;
  text-shadow:
    0 0 6px rgb(56 189 248 / 95%),
    0 0 14px rgb(14 165 233 / 70%);
}

.wc-track-credit-b {
  color: #38bdf8;
}

.wc-track-credit--wide .wc-track-credit-separator {
  margin-inline: 0.65em;
}
</style>
