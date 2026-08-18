<script setup lang="ts">
/**
 * Back Catalogue grid, appended below the QR codes on the Wolves lobby.
 * Cards come from public/experiences/catalogue.json, generated from the
 * documentation repo's playlist metadata by scripts/update-back-catalogue.js.
 * Clicking a card launches the same cinematic runtime used by the Wolves tour.
 */
import type { ExperienceManifest } from '@/config/experience-manifest'
import { onMounted, ref } from 'vue'
import { parseBackCatalogue } from '@/config/experience-manifest'

const emit = defineEmits<{ launch: [manifest: ExperienceManifest] }>()

const experiences = ref<ExperienceManifest[]>([])

function resolveArtwork(artwork: string): string {
  return /^https?:/.test(artwork) ? artwork : `${import.meta.env.BASE_URL}${artwork}`
}

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}experiences/catalogue.json`)
    if (!response.ok) {
      return
    }
    experiences.value = parseBackCatalogue(await response.json()).experiences
  }
  catch {
    // The catalogue is additive; the lobby renders without it on failure.
  }
})
</script>

<template>
  <section v-if="experiences.length > 0" class="wc-back-catalogue" aria-label="Music to Slay By">
    <p class="wc-label wc-back-catalogue-heading">
      Music to Slay By
    </p>
    <div class="wc-hairline" />
    <div class="wc-back-catalogue-grid">
      <button
        v-for="experience in experiences"
        :key="experience.id"
        class="wc-back-catalogue-card wc-plate"
        type="button"
        @click="emit('launch', experience)"
      >
        <img
          class="wc-back-catalogue-art"
          :src="resolveArtwork(experience.artwork)"
          :alt="`${experience.title} artwork`"
          loading="lazy"
        >
        <span class="wc-back-catalogue-title">{{ experience.title }}</span>
        <span v-if="experience.subtitle" class="wc-back-catalogue-sub">{{ experience.subtitle }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.wc-back-catalogue {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  margin-top: 2.4rem;
}

.wc-back-catalogue-heading {
  font-size: clamp(1.3rem, 1.3vw, 1.6rem);
  letter-spacing: 0.4em;
}

.wc-back-catalogue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1.6rem;
}

.wc-back-catalogue-card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.2rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--wc-gold);
  }
}

.wc-back-catalogue-art {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.wc-back-catalogue-title {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wc-white);
}

.wc-back-catalogue-sub {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  line-height: 1.5;
  color: var(--wc-grey);
}
</style>
