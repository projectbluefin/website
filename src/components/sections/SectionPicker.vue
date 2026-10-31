<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { load } from 'js-yaml'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDakotaVersions } from '../../composables'
import { SERVER_VERSIONS } from '../../data/server-versions'

import ProductVersionCard from '../common/ProductVersionCard.vue'
import SceneVisibilityChecker from '../common/SceneVisibilityChecker.vue'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

const dakotaVersions = ref<Awaited<ReturnType<typeof getDakotaVersions>> | null>(null)
const classicStream = ref<Record<string, string> | null>(null)

// Labels mirror DakotaVersionChips.vue so every surface names a package the same way.
const PACKAGE_LABELS: Record<string, string> = {
  kernel: 'Kernel',
  gnome: 'GNOME',
  mesa: 'Mesa',
  systemd: 'systemd',
  pipewire: 'PipeWire',
  bootc: 'bootc',
  nvidia: 'NVidia Driver'
}

// Kernel/init first, then graphics, then desktop. Every key here must be
// resolvable from the image SBOM — see scripts/lib/image-sbom-registry.js.
const DAKOTA_KEYS = ['kernel', 'systemd', 'bootc', 'mesa', 'nvidia', 'gnome', 'pipewire']
const CLASSIC_KEYS = ['base', 'kernel', 'systemd', 'mesa', 'gnome', 'pipewire']

async function loadVersions() {
  try {
    dakotaVersions.value = await getDakotaVersions()
  }
  catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[SectionPicker] failed to load Dakota versions', error)
    }
  }
}

async function loadClassicVersions() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stream-versions.yml`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const streams = load(await response.text()) as { stable?: Record<string, string> } | null
    classicStream.value = streams?.stable ?? null
  }
  catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[SectionPicker] failed to load Classic versions', error)
    }
  }
}

const classicRows = computed(() => {
  const stream = classicStream.value
  if (stream?.status !== 'verified') {
    return []
  }
  return CLASSIC_KEYS
    .filter(key => stream[key])
    .map(key => ({ label: key === 'base' ? 'Base OS' : PACKAGE_LABELS[key] ?? key, value: stream[key] }))
})

const classicDownloads = computed(() => [
  {
    title: t('TryBluefin.Wolves.Cards.Classic'),
    description: t('TryBluefin.Wolves.Cards.ClassicDescription'),
    image: 'characters/leaping.webp',
    wordmark: 'brands/bluefin-classic-logo-dark.svg',
    href: 'https://docs.projectbluefin.io/downloads/',
    versionRows: classicRows.value
  },
  {
    title: t('TryBluefin.Wolves.Cards.Lts'),
    description: t('TryBluefin.Wolves.Cards.LtsDescription'),
    image: 'characters/achillobator.webp',
    wordmark: 'brands/bluefin-lts-logo-dark.svg',
    badgeTitle: t('TryBluefin.Wolves.Cards.ComingSoonBadge'),
    versionRows: []
  }
])

const dakotaRows = computed(() => {
  const v = dakotaVersions.value
  if (!v?.packages || v.status !== 'verified') {
    return []
  }
  const packages = v.packages
  return DAKOTA_KEYS
    .filter(key => packages[key])
    .map(key => ({ label: PACKAGE_LABELS[key] ?? key, value: packages[key] }))
})

const serverRows = [
  { label: 'Base OS', value: `FDSDK ${SERVER_VERSIONS.fdsdk}` },
  { label: PACKAGE_LABELS.kernel, value: SERVER_VERSIONS.kernel },
  { label: PACKAGE_LABELS.systemd, value: SERVER_VERSIONS.systemd },
  { label: 'Ignition', value: SERVER_VERSIONS.ignition },
  { label: 'k0s', value: SERVER_VERSIONS.k0s },
  { label: 'kubeadm', value: SERVER_VERSIONS.kubeadm },
  { label: 'OpenZFS', value: SERVER_VERSIONS.zfs },
  { label: PACKAGE_LABELS.nvidia, value: SERVER_VERSIONS.nvidia }
]

const downloads = computed(() => [
  {
    title: t('TryBluefin.Wolves.Cards.Dakota'),
    description: t('TryBluefin.Wolves.Cards.DakotaDescription'),
    href: '/dakota/',
    image: 'characters/dakota.webp',
    badgeTitle: t('TryBluefin.Wolves.Cards.AlphaBadge'),
    badgeSub: t('TryBluefin.Wolves.Cards.AlphaBadgeSub'),
    versionRows: dakotaRows.value
  },
  {
    title: t('TryBluefin.Wolves.Cards.Server'),
    description: t('TryBluefin.Wolves.Cards.ServerDescription'),
    href: '/server/',
    image: 'characters/alamosaurus.webp',
    badgeTitle: t('TryBluefin.Wolves.Cards.AlphaBadge'),
    badgeSub: t('TryBluefin.Wolves.Cards.AlphaBadgeSub'),
    versionRows: serverRows
  },
  {
    title: t('TryBluefin.Wolves.Cards.Utah'),
    description: t('TryBluefin.Wolves.Cards.UtahDescription'),
    href: 'https://github.com/projectbluefin/utah',
    image: 'characters/utah.webp',
    badgeTitle: t('TryBluefin.Wolves.Cards.ComingSoonBadge'),
    versionRows: []
  }
])

onMounted(loadVersions)
onMounted(loadClassicVersions)
</script>

<template>
  <section id="scene-picker" class="section-wrap">
    <div class="container">
      <div class="picker-header">
        <div class="picker-tag">
          <strong>{{ t("TryBluefin.Tag") }}</strong>
        </div>
        <h2>{{ t("TryBluefin.Title") }}</h2>
      </div>
      <div class="classic-download-grid">
        <ProductVersionCard
          v-for="download in classicDownloads"
          :key="download.title"
          :title="download.title"
          :description="download.description"
          :image="download.image"
          :wordmark="download.wordmark"
          :href="download.href"
          :badge-title="download.badgeTitle"
          :version-rows="download.versionRows"
        />
      </div>

      <section class="next-generation-section" aria-labelledby="next-generation-title">
        <div class="picker-header">
          <h2 id="next-generation-title">
            {{ t('NextGeneration.Title') }}
          </h2>
          <span class="next-generation-description">{{ t('NextGeneration.Description') }}</span>
        </div>
        <div class="wolves-download-grid">
          <ProductVersionCard
            v-for="download in downloads"
            :key="download.title"
            :title="download.title"
            :description="download.description"
            :image="download.image"
            :href="download.href"
            :badge-title="download.badgeTitle"
            :badge-sub="download.badgeSub"
            :version-rows="download.versionRows"
          />
        </div>
      </section>
    </div>
    <SceneVisibilityChecker name="#scene-picker" />
  </section>
</template>

<style scoped lang="scss">
.classic-download-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.next-generation-section {
  margin-top: 80px;
}

.next-generation-description {
  display: block;
  font-size: 1.6rem;
  line-height: 1.6;
  color: var(--color-text-light);
  margin-bottom: 30px;
}

.wolves-download-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

@media (max-width: 956px) {
  .classic-download-grid,
  .wolves-download-grid {
    grid-template-columns: 1fr;
  }
}
</style>
