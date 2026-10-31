<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  description?: string
  image: string
  wordmark?: string
  href?: string
  badgeTitle?: string
  ribbon?: string
  versionRows?: { label: string, value: string }[]
}>()

const baseUrl = import.meta.env.BASE_URL

const cardImageStyle = computed(() => ({
  backgroundImage: `url(${baseUrl}${props.image})`,
}))

const rows = computed(() => props.versionRows ?? [])
</script>

<template>
  <component :is="href ? 'a' : 'div'" class="card-box" :href="href">
    <div v-if="ribbon" class="corner-ribbon">
      <span>{{ ribbon }}</span>
    </div>
    <div v-if="badgeTitle" class="alpha-badge">
      <span class="alpha-badge-title">{{ badgeTitle }}</span>
    </div>
    <div class="card-image" :style="cardImageStyle">
      <div class="card-overlay">
        <span class="card-title">
          <img
            v-if="wordmark"
            class="card-wordmark"
            :src="`${baseUrl}${wordmark}`"
            :alt="title"
            width="500"
            height="240"
            loading="lazy"
          >
          <template v-else>{{ title }}</template>
        </span>
        <span v-if="description" class="card-description">{{ description }}</span>

        <div v-if="rows.length" class="version-info">
          <div
            v-for="row in rows"
            :key="row.label"
            class="version-row"
          >
            <span class="version-label">{{ row.label }}</span>
            <span class="version-value">{{ row.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped lang="scss">
@use '../../style/setup/mixins';

.card-box {
  position: relative;
  display: block;
  height: 400px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(var(--color-blue-rgb), 0.25);
  background: #1f2937;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-decoration: none;
  color: inherit;
}

.card-image {
  width: 100%;
  height: 100%;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.4) 30%, rgba(0, 0, 0, 0.92) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.5rem;
  color: var(--color-text-light);
  border-radius: 12px;
}

.card-title {
  display: block;
  font-size: 1.8rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  text-align: left;
}

.card-wordmark {
  display: block;
  width: min(100%, 240px);
  height: auto;
}

.card-description {
  display: block;
  font-size: 1.5rem;
  line-height: 1.4;
  opacity: 0.85;
  margin: 0.35rem 0 0.75rem 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  text-align: left;
}

.version-info {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 0.4rem;
  font-size: 1.55rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.version-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.version-value {
  font-family: 'Courier New', monospace;
  color: #93c5fd;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 1.55rem;
}

.alpha-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: max-content;
  max-width: calc(100% - 24px);
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: baseline;
  column-gap: 0.3em;
  white-space: normal;
  font-size: 1.2rem;
  line-height: 1.3;
  color: var(--color-text-light);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 5px 10px;
  pointer-events: none;
  text-align: right;

  .alpha-badge-title {
    font-weight: 600;
  }
}

.corner-ribbon {
  @include mixins.corner-ribbon;
}
</style>
