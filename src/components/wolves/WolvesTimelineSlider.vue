<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number
  max: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const currentValue = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', Number(val))
})
</script>

<template>
  <div class="prototype-slider-container">
    <div class="slider-hud">
      <span class="label">TIMELINE SCRUBBER [PROTOTYPE]</span>
      <div class="scrub-controls">
        <span class="page-num">PAGE {{ currentValue }}</span>
        <input
          v-model="currentValue"
          type="range"
          class="cyber-slider"
          min="1"
          :max="max"
        >
        <span class="page-num">{{ max }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prototype-slider-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: 90%;
  max-width: 600px;
  background: rgba(12, 16, 22, 0.95);
  border: 1px solid rgba(102, 179, 255, 0.4);
  border-radius: 8px;
  padding: 12px 20px;
  box-shadow:
    0 0 20px rgba(0, 0, 0, 0.8),
    inset 0 0 10px rgba(102, 179, 255, 0.1);
  backdrop-filter: blur(8px);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.label {
  display: block;
  color: #facc15;
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  text-align: center;
}

.scrub-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-num {
  color: #66b3ff;
  font-size: 0.9rem;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

.cyber-slider {
  flex: 1;
  -webkit-appearance: none;
  background: transparent;
  height: 24px;
  cursor: pointer;
}

.cyber-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: rgba(102, 179, 255, 0.2);
  border-radius: 2px;
}

.cyber-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 8px;
  background: #66b3ff;
  margin-top: -6px;
  box-shadow: 0 0 8px #66b3ff;
  border-radius: 1px;
}

.cyber-slider:focus {
  outline: none;
}
</style>
