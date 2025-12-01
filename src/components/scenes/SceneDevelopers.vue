<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { marked } from 'marked'
import { useI18n } from 'vue-i18n'
import { LangDevsAppendix, LangDevsTowerImageURL } from '../../content'

import SceneContent from '../common/SceneContent.vue'
import SceneVisibilityChecker from '../common/SceneVisibilityChecker.vue'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <section id="scene-developers" class="section-wrap">
    <div class="container">
      <div>
        <div class="img-wrap">
          <img
            class="container"
            :src="LangDevsTowerImageURL"
            :alt="t('ArtworkDescription')"
          >
        </div>
        <div class="scene-arrow">
          <img src="/icons/arrow.svg" alt="">
          <p v-html="marked.parse(t('Devs.TowerJoke'))" />
        </div>
      </div>

      <div class="content">
        <SceneContent
          tag="Devs.Tag"
          title="Devs.Title"
          text="Devs.Text"
        >
          <div class="brand-grid">
            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img
                    src="/brands/vscode.svg"
                    alt="Visual Studio Code logo blur"
                    loading="lazy"
                  >
                  <img
                    src="/brands/vscode.svg"
                    alt="Visual Studio Code logo"
                    loading="lazy"
                  >
                </div>
              </div>
              <p>{{ t("Devs.BoxOne") }}</p>
            </div>

            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img
                    src="/brands/kubernetes.svg"
                    alt="Kubernetes logo blur"
                    loading="lazy"
                  >
                  <img
                    src="/brands/kubernetes.svg"
                    alt="Kubernetes logo"
                    loading="lazy"
                  >
                </div>
              </div>
              <p>{{ t("Devs.BoxThree") }}</p>
            </div>

            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img
                    src="/brands/homebrew.svg"
                    alt="Homebrew logo blur"
                    loading="lazy"
                  >
                  <img
                    src="/brands/homebrew.svg"
                    alt="Homebrew logo"
                    loading="lazy"
                  >
                </div>
              </div>
              <p>{{ t("Devs.BoxFour") }}</p>
            </div>

            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img
                    src="/brands/podman-desktop.svg"
                    alt="Podman Desktop logo blur"
                    loading="lazy"
                  >
                  <img
                    src="/brands/podman-desktop.svg"
                    alt="Podman Desktop logo"
                    loading="lazy"
                  >
                </div>
              </div>
              <p>{{ t("Devs.BoxFive") }}</p>
            </div>

            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img src="/brands/ptyxis.svg" alt="Ptyxis logo blur">
                  <img src="/brands/ptyxis.svg" alt="Ptyxis logo">
                </div>
              </div>
              <p>{{ t("Devs.BoxTwo") }}</p>
            </div>

            <div class="brand-item">
              <div>
                <div class="icon-wrap">
                  <img
                    src="/brands/jetbrains.png"
                    alt="JetBrains logo blur"
                    loading="lazy"
                  >
                  <img
                    src="/brands/jetbrains.png"
                    alt="JetBrains logo"
                    loading="lazy"
                  >
                </div>
              </div>
              <p>{{ t("Devs.BoxSix") }}</p>
            </div>
          </div>

          <div
            v-if="LangDevsAppendix"
            v-html="marked.parse(t('Devs.Appendix'))"
          />
        </SceneContent>
      </div>
    </div>
    <SceneVisibilityChecker name="#scene-developers" />
  </section>
</template>
