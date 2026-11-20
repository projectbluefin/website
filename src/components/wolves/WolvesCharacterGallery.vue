<script setup lang="ts">
/**
 * Guardian character gallery, appended below the Back Catalogue on the Wolves
 * lobby. Cards come from public/wolves/characters/characters.json, generated
 * by scripts/guardian-cards/generate.mjs. Each card's thumbnail starts the
 * wolves intro at that Guardian's own nameplate cue (handled by WolvesApp via
 * the `watchGuardian` event).
 */
import { onMounted, ref } from 'vue'

const emit = defineEmits<{ watchGuardian: [name: string] }>()

interface CharacterCard {
  slug: string
  shortName: string
  label: string
  class: string
  name: string
  title: string
  card: string
  watchUrl: string
  videoTitle: string
}

const characters = ref<CharacterCard[]>([])

const baseUrl = import.meta.env.BASE_URL

interface DonationTier {
  amount: string
  fund: string
  name: string
  perks: string[]
}

const donationTiers: DonationTier[] = [
  {
    amount: '$1,000',
    fund: 'Corporate donation to Wolves',
    name: 'Fireteam Hero',
    perks: ['Your entire team drawn into the comic book as a two-page hero shot.'],
  },
  {
    amount: '$1,000',
    fund: 'Donation to the Dan Kohn Fund',
    name: 'Livery Sponsor',
    perks: ['The team is branded in your org\u2019s livery on their comic book pages.'],
  },
  {
    amount: '$10,000',
    fund: 'Donation to the Dan Kohn Fund',
    name: 'Founding Funder',
    perks: ['Founding Funder of the Bluefin Universe.'],
  },
  {
    amount: '$15,000',
    fund: 'Dan Kohn Donation',
    name: 'Childhood\u2019s End',
    perks: [
      'Chris Aniszczyk wears your company\u2019s shirt when meeting his demise at the business end of a T-Rex at KubeCon.',
      'Special Edition, Limited Print Launch Edition, signed by CNCF Maintainers of Great Renown.',
      'Exclusive rights to print distribution at your booth for a two-year exclusivity period.',
    ],
  },
]

function resolveCard(card: string): string {
  return `${import.meta.env.BASE_URL}${card}`
}

/** Guardians without a finished character card yet, shown as greyed placeholders. */
interface UpcomingGuardian {
  slug: string
  shortName: string
  name: string
  class: string
  title?: string
}

const upcomingGuardians: UpcomingGuardian[] = [
  {
    slug: 'marco',
    shortName: 'Marco',
    name: 'Marco Ceppi',
    class: 'Sunbreaker Titan',
  },
  {
    slug: 'wayne',
    shortName: 'Wayne',
    name: 'Wayne Witzel',
    class: 'Striker Titan',
  },
  {
    slug: 'jordan',
    shortName: 'Jordan',
    name: 'Jordan Petridis',
    class: '[Redacted]',
  },
  {
    slug: 'zachriel',
    shortName: 'Zachriel',
    name: 'Zachriel',
    class: '[Coming soon]',
  },
  {
    slug: 'eggroll',
    shortName: 'Eggroll',
    name: 'Glorious Eggroll',
    class: 'Nightstalker Hunter',
    title: 'Legendary Mentor — Master of the Arcane',
  },
]

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}wolves/characters/characters.json`)
    if (!response.ok) {
      return
    }
    const payload = await response.json() as { characters?: CharacterCard[] }
    characters.value = Array.isArray(payload.characters)
      ? payload.characters
      : []
  }
  catch {
    // The gallery is additive; the lobby renders without it on failure.
  }
})
</script>

<template>
  <section class="wc-character-gallery" aria-label="Character Gallery">
    <p class="wc-label wc-character-gallery-heading">
      LEVEL UP A MAINTAINER
    </p>
    <div class="wc-hairline" />
    <blockquote class="wc-character-gallery-rally">
      “We need as many Guardians as we can. The Toilmaster is coming, open
      source needs your help. Our Childhood’s End. Open Source fights back!”
    </blockquote>
    <p class="wc-character-gallery-intro">
      Every donation levels up a guardian — raising their power level and
      commissioning real comic book pages: artists will work directly with
      each maintainer to represent their vision of themselves in the Bluefin
      universe. The more maintainers you sponsor, the more the comic book
      comes together — page by page, guardian by guardian.
    </p>
    <div class="wc-character-gallery-grid">
      <article
        v-for="character in characters"
        :key="character.slug"
        class="wc-character-card wc-plate"
      >
        <button
          class="wc-character-card-watch"
          type="button"
          :aria-label="`Watch ${character.name}'s section of the wolves intro`"
          @click="emit('watchGuardian', character.name)"
        >
          <img
            class="wc-character-card-art"
            :src="resolveCard(character.card)"
            :alt="`${character.class} — ${character.name} character card`"
            loading="lazy"
          >
        </button>
        <span class="wc-character-card-name">{{ character.name }} inspired me</span>
        <span class="wc-character-card-sub">{{ character.class }} · {{ character.title }}</span>
        <button
          class="wc-character-card-donate"
          type="button"
          disabled
        >
          COMING SOON
        </button>
      </article>
      <article
        v-for="guardian in upcomingGuardians"
        :key="guardian.slug"
        class="wc-character-card wc-character-card--upcoming wc-plate"
      >
        <div class="wc-character-card-art wc-character-card-art--pending" aria-hidden="true">
          <span class="wc-label">COMING SOON</span>
        </div>
        <span class="wc-character-card-name">{{ guardian.name }} inspired me</span>
        <span class="wc-character-card-sub">{{ guardian.class }}{{ guardian.title ? ` · ${guardian.title}` : '' }}</span>
        <button
          class="wc-character-card-donate"
          type="button"
          disabled
        >
          COMING SOON
        </button>
      </article>
      <article class="wc-character-card wc-character-card--upcoming wc-plate">
        <div class="wc-character-card-art wc-character-card-art--pending" aria-hidden="true">
          <span class="wc-label">COMING SOON</span>
        </div>
        <span class="wc-character-card-name">COMING SOON</span>
        <span class="wc-character-card-sub">NEW GUARDIAN</span>
      </article>
      <article class="wc-character-card wc-character-card--upcoming wc-character-card--nominate wc-plate">
        <div class="wc-character-card-art wc-character-card-art--pending" aria-hidden="true">
          <span class="wc-label">COMING SOON</span>
        </div>
        <span class="wc-character-card-name">NOMINATE A MAINTAINER</span>
        <span class="wc-character-card-sub">COMING SOON</span>
      </article>
    </div>
    <p class="wc-label wc-character-gallery-subheading">
      CORPORATE DONATION TIERS
    </p>
    <div class="wc-hairline" />
    <p class="wc-character-gallery-intro">
      The Dan Kohn Fund is the simplest way your organization can help a
      maintainer accomplish the thing that helps them do this job the most.
      Meet with their colleagues, in real life. At a time where AI is
      challenging our human connections - now more than ever, help us. We need
      each other, we can't do this alone.
    </p>
    <p class="wc-character-gallery-proveit">
      You all say "We support maintainers." Prove it.
    </p>
    <div class="wc-character-tiers">
      <article
        v-for="tier in donationTiers"
        :key="`${tier.amount}-${tier.name}`"
        class="wc-character-tier wc-plate"
      >
        <span class="wc-character-tier-amount">{{ tier.amount }}</span>
        <span class="wc-character-tier-fund">{{ tier.fund }}</span>
        <span class="wc-character-tier-name">{{ tier.name }}</span>
        <ul class="wc-character-tier-perks">
          <li v-for="perk in tier.perks" :key="perk">
            {{ perk }}
          </li>
        </ul>
        <button
          class="wc-character-card-donate"
          type="button"
          disabled
        >
          COMING SOON
        </button>
      </article>
    </div>
    <p class="wc-label wc-character-gallery-subheading wc-character-incoming-heading">
      MORE OPTIONS — COMING SOON
    </p>
    <div class="wc-hairline wc-hairline--dashed" />
    <div class="wc-character-incoming">
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">Incoming option</span>
        <span class="wc-character-incoming-name">Donate OpenRouter tokens to Hive for an OSS project</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">Incoming option</span>
        <span class="wc-character-incoming-name">Buy a maintainer a Bluefin Shirt</span>
        <a href="https://store.projectbluefin.io" target="_blank" rel="noopener noreferrer">
          <img
            class="wc-character-tier-shirt"
            :src="`${baseUrl}wolves/characters/bluefin-womens-rawr.webp`"
            alt="Bluefin Women's Rawr shirt sample from the Bluefin store"
            loading="lazy"
          >
        </a>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">Incoming option</span>
        <span class="wc-character-incoming-name">Buy a CNCF Store Coupon for a Maintainer</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">$15 · to Nat/Kat</span>
        <span class="wc-character-incoming-name">"Harbringer: Sisters of War" Limited Edition Concert Tshirt</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">$5 · Donation</span>
        <span class="wc-character-incoming-name">nimbatus // laura santa maria — Bluefin and the Forbidden Factory Gold Foil Collectible</span>
        <span class="wc-character-incoming-detail">Signed by Laura, Limited Edition. bootc booth, Project Pavilion. Limited to 100.</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">$30 · to Natali</span>
        <span class="wc-character-incoming-name">Natali "Boss Bitch" &amp; Alamo Tshirt</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">Incoming option</span>
        <span class="wc-character-incoming-name">Bluefin and Mechaphippy Kids Coloring Adventure</span>
        <img
          class="wc-character-tier-shirt wc-character-tier-shirt--wide"
          :src="`${baseUrl}wolves/characters/mechaphippy.jpg`"
          alt="Mechaphippy model kit sample for the Bluefin and Mechaphippy Kids Coloring Adventure"
          loading="lazy"
        >
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">$15</span>
        <span class="wc-character-incoming-name">"Doctor Andy Anderson" Forbidden Factory Standard Issue Coffee Mug</span>
        <span class="wc-character-incoming-detail">"I'm actually on the beach."</span>
      </article>
      <article class="wc-character-incoming-item wc-plate">
        <span class="wc-character-tier-fund">Incoming option</span>
        <span class="wc-character-incoming-name">Buy an OGC Maintainer Steam Gift Card</span>
      </article>
    </div>
    <p class="wc-character-gallery-disclaimer">
      Destiny 2 © Bungie, Inc. Fan-made, non-commercial community art — not affiliated with or endorsed by Bungie.
    </p>
  </section>
</template>

<style scoped lang="scss">
.wc-character-gallery {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  margin-top: 2.4rem;
}

.wc-character-gallery-heading {
  font-size: clamp(1.3rem, 1.3vw, 1.6rem);
  letter-spacing: 0.4em;
}

.wc-character-gallery-rally,
.wc-character-gallery-intro {
  align-self: center;
  text-align: center;
}

.wc-character-gallery-rally {
  margin: 0;
  font-size: clamp(1.5rem, 1.6vw, 1.9rem);
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.04em;
  line-height: 1.5;
  color: var(--wc-white);
  max-width: 56ch;
}

.wc-character-gallery-intro {
  font-family: var(--wc-font-mono);
  font-size: 1.2rem;
  line-height: 1.6;
  color: var(--wc-grey);
  max-width: 64ch;
}

.wc-character-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1.6rem;
}

.wc-character-card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.2rem;
  text-align: left;
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-within {
    border-color: var(--wc-gold);
  }
}

.wc-character-card-watch {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.wc-character-card-art {
  width: 100%;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  display: block;
}

// Greyed placeholder cards for guardians whose character art isn't ready yet.
// The donate button stays live — sponsoring is what brings the card to life.
.wc-character-card--upcoming {
  opacity: 0.55;
  filter: grayscale(1);

  &:hover,
  &:focus-within {
    opacity: 1;
    filter: none;
  }
}

.wc-character-card-art--pending {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--wc-line);
  background: rgb(0 0 0 / 35%);
}

.wc-character-card-name {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wc-white);
}

.wc-character-card-sub {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  line-height: 1.5;
  color: var(--wc-grey);
}

.wc-character-card-donate {
  align-self: flex-start;
  margin-top: 0.4rem;
  padding: 0.6rem 1.4rem;
  border: 1px solid var(--wc-gold);
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--wc-gold);
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:hover:not(:disabled),
  &:focus-visible {
    background-color: var(--wc-gold);
    color: #0b0d12;
  }
}

.wc-character-gallery-disclaimer {
  font-family: var(--wc-font-mono);
  font-size: 1rem;
  line-height: 1.5;
  color: var(--wc-grey);
}

.wc-character-gallery-subheading {
  margin-top: 1.6rem;
  font-size: clamp(1.2rem, 1.2vw, 1.5rem);
  letter-spacing: 0.4em;
}

.wc-character-gallery-proveit {
  margin: 3.2rem 0 1.6rem;
  font-size: clamp(1.5rem, 1.6vw, 1.9rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--wc-white);
}

.wc-character-tiers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr));
  gap: 1.6rem;
}

.wc-character-tier {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.6rem;
  text-align: left;
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-within {
    border-color: var(--wc-gold);
  }
}

.wc-character-incoming-heading {
  color: var(--wc-grey);
}

.wc-hairline--dashed {
  height: 0;
  background: none;
  border-top: 1px dashed var(--wc-line);
}

// Incoming options: deliberately quieter than the live tiers.
.wc-character-incoming {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1.2rem;
  align-items: start;
}

.wc-character-incoming-item {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.2rem;
  text-align: left;
  opacity: 0.55;
  filter: grayscale(1);
}

.wc-character-incoming-name {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wc-white);
}

.wc-character-incoming-detail {
  font-family: var(--wc-font-mono);
  font-size: 1rem;
  line-height: 1.5;
  color: var(--wc-grey);
}

.wc-character-tier-shirt {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.wc-character-tier-shirt--wide {
  aspect-ratio: auto;
}

.wc-character-tier-amount {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wc-gold);
}

.wc-character-tier-fund {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--wc-grey);
}

.wc-character-tier-name {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wc-white);
}

.wc-character-tier-perks {
  margin: 0;
  padding-left: 1.6rem;
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--wc-grey);
}
</style>
