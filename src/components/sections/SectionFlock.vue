<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useI18n } from "vue-i18n"

const { t } = useI18n()

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
}

const recentContributors = ref<Contributor[]>([])
const allTimeContributors = ref<Contributor[]>([])
const loading = ref(true)

async function fetchContributors() {
  loading.value = true
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const since = threeMonthsAgo.toISOString()

  try {
    const [recentResponse, allTimeResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/ublue-os/bluefin/commits?since=${since}`),
      fetch(`https://api.github.com/repos/ublue-os/bluefin/contributors`)
    ]);

    if (recentResponse.ok) {
      const commits = await recentResponse.json()
      const uniqueContributors = new Map<string, Contributor>()
      for (const commit of commits) {
        if (commit.author && !commit.author.login.includes('[bot]')) {
          uniqueContributors.set(commit.author.login, {
            login: commit.author.login,
            avatar_url: commit.author.avatar_url,
            html_url: commit.author.html_url
          })
        }
      }
      recentContributors.value = Array.from(uniqueContributors.values())
    } else {
      console.error("Failed to fetch recent contributors from GitHub API")
    }

    if (allTimeResponse.ok) {
        const allContributors: Contributor[] = await allTimeResponse.json();
        const recentLogins = new Set(recentContributors.value.map(c => c.login));
        allTimeContributors.value = allContributors.filter(c => !c.login.includes('[bot]') && !recentLogins.has(c.login));
    } else {
        console.error("Failed to fetch all-time contributors from GitHub API");
    }

  } catch (error) {
    console.error("Error fetching contributors:", error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchContributors)
</script>

<template>
  <section id="flock" class="section-flock">
    <div class="container">
      <h2 class="section-title">{{ t("Flock.Title") }}</h2>
      <p class="section-description">{{ t("Flock.Description") }}</p>
      <div v-if="loading" class="loading-spinner"></div>
      <div v-else>
        <div class="contributors-grid">
          <a
            v-for="contributor in recentContributors"
            :key="contributor.login"
            :href="contributor.html_url"
            target="_blank"
            class="contributor-card"
          >
            <img
              :src="contributor.avatar_url"
              :alt="contributor.login"
              class="contributor-avatar"
              loading="lazy"
            />
            <span class="contributor-login">{{ contributor.login }}</span>
          </a>
        </div>

        <h3 class="subsection-title">{{ t("Flock.AllTimeTitle") }}</h3>
        <div class="contributors-grid-small">
          <a
            v-for="contributor in allTimeContributors"
            :key="contributor.login"
            :href="contributor.html_url"
            target="_blank"
            class="contributor-card-small"
          >
            <img
              :src="contributor.avatar_url"
              :alt="contributor.login"
              class="contributor-avatar-small"
              loading="lazy"
            />
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use "@/style/setup/_mixins.scss" as mixins;

.section-flock {
  padding: 4rem 0;
  text-align: center;

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .section-title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--color-text);
  }

  .subsection-title {
    font-size: 2rem;
    margin-top: 4rem;
    margin-bottom: 2rem;
    color: var(--color-text);
  }

  .section-description {
    font-size: 1.2rem;
    margin-bottom: 3rem;
    color: var(--color-text-secondary);
  }

  .loading-spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: var(--color-primary);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 2rem auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .contributors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 2rem;
    justify-items: center;
  }
  
  .contributors-grid-small {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }

  .contributor-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    color: var(--color-text);
    transition: transform 0.2s ease-in-out;

    &:hover {
      transform: translateY(-5px);
    }
  }

  .contributor-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    margin-bottom: 0.75rem;
    border: 3px solid var(--color-primary);
  }

  .contributor-login {
    font-size: 1.1rem;
    font-weight: 500;
  }
  
  .contributor-card-small {
    transition: transform 0.2s ease-in-out;
    &:hover {
      transform: scale(1.2);
      z-index: 1;
    }
  }
  
  .contributor-avatar-small {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid var(--color-secondary);
  }
}
</style>
