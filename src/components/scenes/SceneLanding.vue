<script setup lang="ts">
import { onMounted, ref } from "vue"
import SceneVisibilityChecker from "../common/SceneVisibilityChecker.vue"
import Holidaysaurus from '../../assets/img/Holidaysaurus.webp'
// Re-implement after December
//import { LangLandingBluefinImageURLs } from "../../content"
import { i18n } from "../../locales/schema"
import { useI18n } from "vue-i18n"
import type { MessageSchema } from "../../locales/schema"

function scrollToUsers() {
  document.querySelector("#scene-users")?.scrollIntoView({ behavior: "smooth" })
}

function scrollToPicker() {
  document
    .querySelector("#scene-picker")
    ?.scrollIntoView({ behavior: "smooth" })
}
/* Re-implement after December
function getRandomBluefinImage() {
  return LangLandingBluefinImageURLs[
    Math.floor(Math.random() * LangLandingBluefinImageURLs.length)
  ]
}
 */

const isLoaded = ref(false)
// Re-implement after December
// const LangLandingBluefinImageURL = getRandomBluefinImage()

onMounted(() => {
  setTimeout(() => {
    isLoaded.value = true
  }, 150)
})

const lang = ref(i18n.global.locale)
const redirectToLang = (lang: string) => {
  // @ts-ignore
  const urlParams = new URLSearchParams(window.location.search)

  urlParams.set("lang", lang)

  // @ts-ignore
  window.location.search = urlParams
}
const { t } = useI18n<MessageSchema>({
  useScope: "global"
})
</script>

<template>
  <section id="scene-landing" class="section-wrap">
    <div class="container moderate">
      <div class="title" :class="{ 'is-loaded': isLoaded }">
        <div class="text">
          <img
            style="width: 100%; height: auto"
            width="105"
            height="43"
            src="/brands/bluefin.svg"
            fetchpriority="high"
            alt="Project Bluefin"
          />
          <p>{{ t("Landing.Title") }}</p>

          <div class="btn-wrap">
            <button class="btn filled text-nowrap" @click="scrollToUsers">
              {{ t("Landing.DiscoverButton") }}
            </button>

            <a class="btn black filled text-nowrap" @click="scrollToPicker">
              {{ t("Landing.TryOutButton") }}
            </a>

            <select
              class="btn black filled text-nowrap"
              @change="redirectToLang(lang)"
              v-model="lang"
            >
              <option
                v-for="key in Object.keys(i18n.global.messages)"
                :value="key"
              >
                {{ key }}
              </option>
            </select>
          </div>
        </div>
            <img
            class="sm:h-full sm:w-full object-contain my-3 w-1/2 h-1/2"
            :src="Holidaysaurus"
            alt="Bluefin"
            />
      </div>
    </div>
    <SceneVisibilityChecker name="null" />

    <!-- <div class="scene-quote">
      <blockquote>
        {{ LangLandingQuote.text }}
      </blockquote>
      <p class="from">
        <a :href="LangLandingQuote.url" target="_blank">{{ LangLandingQuote.author }}</a>
      </p>
    </div> -->
  </section>
</template>
