<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { marked } from 'marked'
import { useI18n } from 'vue-i18n'
import {
  LangUsersAppendix,
  LangUsersBluefinImageURL,
  LangUsersListItems
} from '../../content'

import SceneContent from '../common/SceneContent.vue'
import SceneQuote from '../common/SceneQuote.vue'

import SceneVisibilityChecker from '../common/SceneVisibilityChecker.vue'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <section id="scene-users" class="section-wrap">
    <div class="container">
      <div class="img-wrap">
        <img
          :src="LangUsersBluefinImageURL"
          :alt="t('Users.BluefinArtworkAlt')"
        >
      </div>

      <div>
        <SceneContent
          tag="Users.Tag"
          title="Users.Title"
          text="Users.Intro"
        >
          <div class="brand-grid">
            <div
              v-for="item in LangUsersListItems"
              :key="item"
              class="brand-item"
            >
              <p>{{ t(item) }}</p>
            </div>
          </div>

          <div
            v-if="LangUsersAppendix"
            v-html="marked.parse(t('Users.Features'))"
          />
          <SceneQuote
            quote="EvolutionQuote.Quote"
            author="EvolutionQuote.Author"
            link="EvolutionQuote.WikiLink"
          />
        </SceneContent>
      </div>
    </div>
    <SceneVisibilityChecker name="#scene-users" />
  </section>
</template>
