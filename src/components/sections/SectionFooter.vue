<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { marked } from 'marked'

import { useI18n } from 'vue-i18n'
import { LangAlumniCompanies, LangPoweredBy, LangSocialLinks, LangSponsors } from '../../content'

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})
</script>

<template>
  <footer>
    <section id="contributors" class="section-wrap">
      <div class="container">
        <h2>{{ $t("Flock.Title") }}</h2>
        <p style="font-size: 18px">
          {{ $t("Flock.Description") }}
        </p>
        <IframeResizer
          id="contributor-container"
          license="GPLv3"
          src="/contributors.html"
          loading="lazy"
          style="width: 100%; height: 200px"
        />
      </div>
    </section>
    <section id="alumni" class="section-wrap">
      <div class="container" style="text-align: center;">
        <h3 style="margin-bottom: 30px; font-size: 2rem; text-transform: none; font-weight: 600;">
          {{ $t("Flock.AlumniTitle") }}
        </h3>
        <div class="logo-list alumni-logos">
          <template v-for="brand in LangAlumniCompanies" :key="brand.imageUrl">
            <a v-if="brand.projectUrl" :href="brand.projectUrl" target="_blank">
              <img
                :src="brand.imageUrl"
                :alt="brand.altText"
                :title="brand.altText"
                loading="lazy"
              >
            </a>
            <img
              v-else
              :src="brand.imageUrl"
              :alt="brand.altText"
              :title="brand.altText"
              loading="lazy"
            >
          </template>
        </div>
      </div>
    </section>
    <section id="sponsors" class="section-wrap">
      <div class="container" style="text-align: center;">
        <h3 style="margin-bottom: 30px; font-size: 2rem; text-transform: none; font-weight: 600;">
          {{ $t("Flock.SponsorsTitle") }}
        </h3>
        <div class="logo-list sponsor-logos">
          <template v-for="brand in LangSponsors" :key="brand.imageUrl">
            <a v-if="brand.projectUrl" :href="brand.projectUrl" target="_blank">
              <img
                :src="brand.imageUrl"
                :alt="brand.altText"
                :title="brand.altText"
                loading="lazy"
              >
            </a>
            <img
              v-else
              :src="brand.imageUrl"
              :alt="brand.altText"
              :title="brand.altText"
              loading="lazy"
            >
          </template>
        </div>
      </div>
    </section>
    <div class="container">
      <div>
        <strong class="footer-title">{{ $t("Footer.Title") }}</strong>

        <div class="logo-list">
          <template v-for="brand in LangPoweredBy" :key="brand.imageUrl">
            <a v-if="brand.projectUrl" :href="brand.projectUrl" target="_blank">
              <img
                :src="brand.imageUrl"
                :alt="brand.altText"
                :title="brand.altText"
                loading="lazy"
              >
            </a>

            <!-- Does not have project url -->
            <img
              v-else
              :src="brand.imageUrl"
              :alt="brand.altText"
              :title="brand.altText"
              loading="lazy"
            >
          </template>
        </div>
      </div>

      <div>
        <strong class="footer-title">{{ t("Footer.ProjectTitle") }}</strong>
        <p v-html="marked.parse(t('Footer.Project'))" />
        <ul class="footer-links">
          <li v-for="item in LangSocialLinks" :key="item.text">
            <a :href="item.link">
              <component :is="item.component" />
              {{ item.text }}
            </a>
          </li>
        </ul>

        <hr>

        <p v-html="marked.parse(t('Footer.References'))" />

        <div style="flex: 1" />
        <p class="copyright">
          {{ $t("Footer.Copyright", { date: new Date().getUTCFullYear() }) }}
        </p>
      </div>
    </div>
  </footer>
</template>
