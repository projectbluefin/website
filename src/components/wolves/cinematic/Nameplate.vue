<script setup lang="ts">
withDefaults(defineProps<{
  /** Small secondary detail line (chapter / status). */
  detail: string
  /** Large primary label. */
  label: string
  /** Slowly fades label changes for the authored Track 0 communications. */
  slowFade?: boolean
}>(), {
  slowFade: false,
})
</script>

<template>
  <div class="wc-nameplate wc-plate wc-plate--sheen" :class="{ 'wc-nameplate--slow-fade': slowFade }">
    <span class="wc-nameplate-detail wc-label">{{ detail }}</span>
    <Transition v-if="slowFade" name="wc-nameplate-label" mode="out-in">
      <span :key="label" class="wc-nameplate-label">{{ label }}</span>
    </Transition>
    <span v-else class="wc-nameplate-label">{{ label }}</span>
  </div>
</template>

<style scoped lang="scss">
.wc-nameplate {
  display: inline-flex;
  flex-direction: column;
  gap: 0.4rem;
  box-sizing: border-box;
  max-width: 100%;
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
  overflow-wrap: break-word;
}

.wc-nameplate--slow-fade .wc-nameplate-label {
  transition: opacity 1.5s ease;
}

.wc-nameplate-label-enter-from,
.wc-nameplate-label-leave-to {
  opacity: 0;
}
</style>
