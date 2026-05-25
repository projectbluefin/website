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
        <strong class="footer-title">{{ $t("Footer.PoweredBy") }}</strong>

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
        <strong class="footer-title">{{ t("Footer.Project.Title") }}</strong>
        <p class="ublue">
          <a href="https://universal-blue.org" target="_blank" rel="noopener noreferrer">
            <img src="/brands/universal-blue.svg" alt="Universal Blue Logo">
            <span>
              Universal Blue
            </span>
          </a>
        </p>
        <div v-html="marked.parse(t('Footer.Project.Ublue'))" />
        <a
          class="lfx-badge-link"
          href="https://insights.linuxfoundation.org/project/ublue-os-bluefin/contributors"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Project Bluefin contributor insights on Linux Foundation Insights"
        >
          <img
            class="lfx-badge"
            src="/lfx-badge.png"
            alt="Linux Foundation Insights contributor badge"
            loading="lazy"
          >
        </a>
        <ul class="footer-links">
          <li v-for="item in LangSocialLinks" :key="item.text">
            <a :href="item.link">
              <component :is="item.component" />
              {{ item.text }}
            </a>
          </li>
        </ul>
        <hr>
        <p v-html="marked.parse(t('Footer.Credits.Intro'))" />
        <ul>
          <li v-html="marked.parse(t('Footer.Credits.Website'))" />
          <li v-html="marked.parse(t('Footer.Credits.Logos'))" />
          <li v-html="marked.parse(t('Footer.Credits.ImageEdit'))" />
          <li v-html="marked.parse(t('Footer.Credits.Wallpapers'))" />
          <li v-html="marked.parse(t('Footer.Credits.Translations'))" />
          <li v-html="marked.parse(t('Footer.Credits.Thanks'))" />
        </ul>

        <div style="flex: 1" />
        <p class="copyright">
          {{ $t("Footer.Copyright", { date: new Date().getUTCFullYear() }) }}
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
  .ublue {
  margin-bottom: 10px;
}

.ublue img {
  height: 2em;
}
.ublue a {
  display: inline-flex;
  align-items: center;
}
.ublue span {
  margin-left: 4px;
}

.lfx-badge-link {
  display: inline-flex;
  margin-top: 1.6rem;
}

.lfx-badge {
  width: min(100%, 282px);
  height: auto;
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.lfx-badge-link:hover .lfx-badge,
.lfx-badge-link:focus-visible .lfx-badge {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
}

.footer-links {
  margin-top: 20px;
}
</style>
