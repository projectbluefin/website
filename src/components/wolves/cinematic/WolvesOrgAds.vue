<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed } from 'vue'
import { getWolvesOrgAdBlend, WOLVES_ORG_AD_PAIRS } from '@/data/wolves-org-ads'
import { useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()
const reducedMotion = usePreferredReducedMotion()
const visible = computed(() => store.phase === 'cinematic' && store.segmentIndex > 0)
const blend = computed(() => getWolvesOrgAdBlend(store.segmentElapsed))
const opacities = computed(() => {
  if (reducedMotion.value !== 'reduce') {
    return blend.value.opacities
  }
  return blend.value.interactivePairIndex === 0 ? [1, 0] as const : [0, 1] as const
})
</script>

<template>
  <div v-if="visible" class="wc-org-ads" aria-label="Open source community links">
    <div
      v-for="(pair, pairIndex) in WOLVES_ORG_AD_PAIRS"
      :key="pairIndex"
      class="wc-org-ad-pair"
      :class="{ 'is-interactive': blend.interactivePairIndex === pairIndex }"
      :data-pair="pairIndex"
      :data-opacity="opacities[pairIndex]"
      :style="{ opacity: opacities[pairIndex] }"
      :aria-hidden="blend.interactivePairIndex !== pairIndex"
    >
      <a
        v-for="(ad, index) in pair"
        :key="ad.id"
        class="wc-org-ad"
        :class="index === 0 ? 'wc-org-ad--left' : 'wc-org-ad--right'"
        :data-org="ad.id"
        :href="ad.href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="ad.name"
        :tabindex="blend.interactivePairIndex === pairIndex ? 0 : -1"
      >
        <img class="wc-org-ad-image" :src="ad.image" :alt="ad.imageAlt">
        <img class="wc-org-ad-qr" :src="ad.qr" :alt="ad.qrAlt">
      </a>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wc-org-ads {
  --wc-org-ad-width: clamp(14rem, 17vw, 20rem);
  position: absolute;
  inset: 9rem 0 10.5rem;
  z-index: 18;
  pointer-events: none;
}

.wc-org-ad-pair {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.wc-org-ad-pair.is-interactive .wc-org-ad {
  pointer-events: auto;
}

.wc-org-ad {
  position: absolute;
  top: 50%;
  display: flex;
  width: var(--wc-org-ad-width);
  aspect-ratio: 3 / 5;
  min-height: 0;
  max-height: 100%;
  padding: clamp(1rem, 1.8vw, 1.8rem);
  flex-direction: column;
  gap: clamp(0.8rem, 1.4vw, 1.4rem);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgb(127 212 212 / 35%);
  border-radius: 1rem;
  background: rgb(8 9 12 / 88%);
  transform: translateY(-50%);
  pointer-events: none;
}

.wc-org-ad--left {
  left: 2.4rem;
}

.wc-org-ad--right {
  right: 2.4rem;
}

.wc-org-ad-image,
.wc-org-ad-qr {
  display: block;
  width: 100%;
  max-height: 45%;
  object-fit: contain;
}

// Reserve each logo's intrinsic box before the asset decodes so the column
// does not shift during the Part I -> II handoff. All logos are square
// except the 600x500 KubeCon plate.
.wc-org-ad-image {
  aspect-ratio: 1 / 1;
}

.wc-org-ad[data-org='kubecon'] .wc-org-ad-image {
  aspect-ratio: 600 / 500;
}

.wc-org-ad-qr {
  width: min(85%, 16rem);

  // Square QR SVGs; reserving the box up front removes the layout shift
  // that fired when the asset decoded during the Part I -> II handoff.
  aspect-ratio: 1 / 1;
}

@media (max-width: 1199px) and (min-width: 1024px) {
  .wc-org-ads {
    --wc-org-ad-width: clamp(12rem, 15vw, 16rem);
  }

  .wc-org-ad {
    aspect-ratio: 2 / 3;
    padding: 1rem;
    gap: 0.8rem;
  }
}

@media (max-width: 1023px) {
  .wc-org-ads {
    display: none;
  }
}
</style>
