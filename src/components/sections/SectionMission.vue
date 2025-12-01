<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LangMissionBluefinImageURL } from '../../content'

import SceneContent from '../common/SceneContent.vue'
import SceneVisibilityChecker from '../common/SceneVisibilityChecker.vue'

const vis = ref(false)
const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <section id="scene-mission" class="section-wrap">
    <img src="/layer-transition.webp" class="layer-transition" alt="">

    <div class="container">
      <SceneContent
        tag="Mission.Tag"
        title="Mission.Title"
        text="Mission.Text"
        @visible="vis = true"
      />

      <Transition name="fade">
        <div v-if="vis" class="img-wrap">
          <img
            class="container"
            :src="LangMissionBluefinImageURL"
            :alt="t('Misson.BluefinChillAlt')"
          >
        </div>
      </Transition>
    </div>
    <SceneVisibilityChecker name="#scene-mission" />
  </section>
</template>
