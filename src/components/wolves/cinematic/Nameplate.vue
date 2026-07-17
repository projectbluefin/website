<script setup lang="ts">
defineProps<{
  /** Small secondary detail line (chapter / status). */
  detail: string
  /** Large primary label. */
  label: string
}>()
</script>

<template>
  <div class="wc-nameplate wc-plate wc-plate--sheen">
    <span class="wc-nameplate-detail wc-label">{{ detail }}</span>
    <span class="wc-nameplate-label">{{ label }}</span>
  </div>
</template>

<style scoped lang="scss">
.wc-nameplate {
  display: inline-flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.2rem 2.4rem 1.2rem 1.6rem;
  border-left: 2px solid var(--wc-gold);
}

.wc-nameplate-label {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wc-white);
  line-height: 1.1;
}
</style>
