<script setup lang="ts">
import type { MessageSchema } from '../../locales/schema'
import { IconGithub, IconHeartCircle } from '@iconify-prerendered/vue-mdi'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n<MessageSchema>({ useScope: 'global' })
const bluefinRepoUrl = 'https://github.com/ublue-os/bluefin'
const bluefinPulseUrl = 'https://github.com/ublue-os/bluefin/pulse'
const activityWindow = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
const activityWindowLabel = activityWindow.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

interface Contributor {
  login: string
  html_url: string
}
interface CommitRecord {
  author: Contributor | null
}
interface DiscussionRecord {
  user: Contributor
  created_at: string
}

const contributors = ref<Contributor[]>([])
const loading = ref(true)
const unavailable = ref(false)

const ignoredIdentities = new Set([
  'Copilot',
  'dependabot[bot]',
  'github-actions[bot]',
  'renovate[bot]',
  'ubot-7274[bot]',
])

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}

async function githubPages<T>(url: string): Promise<T[]> {
  const records: T[] = []
  for (let page = 1; ; page += 1) {
    const separator = url.includes('?') ? '&' : '?'
    const batch = await githubJson<T[]>(`${url}${separator}per_page=100&page=${page}`)
    records.push(...batch)
    if (batch.length < 100) {
      return records
    }
  }
}

onMounted(async () => {
  try {
    let orgRepos: { full_name: string, fork: boolean }[] = []
    try {
      orgRepos = await githubPages<{ full_name: string, fork: boolean }>('https://api.github.com/orgs/projectbluefin/repos?type=all')
    }
    catch {
      // Keep the two explicitly requested repositories as a useful fallback.
    }

    const repositories = [
      ...orgRepos.filter(repo => !repo.fork).map(repo => repo.full_name),
      'ublue-os/bluefin',
      'ublue-os/bluefin-lts',
    ].filter((repo, index, all) => all.indexOf(repo) === index)
    const people = new Map<string, Contributor>()
    const addPerson = (person: Contributor) => {
      if (!person.login.endsWith('[bot]') && !ignoredIdentities.has(person.login)) {
        people.set(person.login, person)
      }
    }

    const commitPages = await Promise.allSettled(
      repositories.map(repo => githubPages<CommitRecord>(`https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(activityWindow.toISOString())}`)),
    )
    commitPages.forEach((result) => {
      if (result.status === 'fulfilled') {
        result.value.forEach(commit => commit.author && addPerson(commit.author))
      }
    })

    try {
      const discussions = await githubPages<DiscussionRecord>('https://api.github.com/repos/ublue-os/bluefin/discussions')
      discussions
        .filter(discussion => new Date(discussion.created_at) >= activityWindow)
        .forEach(discussion => discussion.user && addPerson(discussion.user))
    }
    catch {
      // Commits remain visible when Discussions is unavailable.
    }

    contributors.value = [...people.values()]
      .sort((left, right) => left.login.localeCompare(right.login))
      .slice(0, 12)
    unavailable.value = contributors.value.length === 0
  }
  catch (error) {
    unavailable.value = true
    if (import.meta.env.DEV) {
      console.warn('[SectionContributors] failed to load contributors', error)
    }
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <section id="contributors" class="section-wrap">
    <div class="container">
      <div class="contributors-header">
        <h2>{{ t('Community.Contribute.Tag') }}</h2>
      </div>

      <div class="contributors-card">
        <div class="contributors-copy">
          <h3>{{ t('Community.Contribute.Title') }}</h3>
          <p>{{ t('Community.Contribute.Description') }}</p>
          <p class="contributors-summary">
            Contributors active since {{ activityWindowLabel }}.
          </p>
          <div class="card-buttons">
            <a class="contributors-button" :href="bluefinRepoUrl" target="_blank" rel="noopener noreferrer">
              <IconGithub class="size-6" />
              <span>{{ t('Community.Contribute.Button') }}</span>
            </a>
            <a class="contributors-button secondary" href="https://docs.projectbluefin.io/donations" target="_blank" rel="noopener noreferrer">
              <IconHeartCircle class="size-6" />
              <span>{{ t('Community.Contribute.DonateButton') }}</span>
            </a>
          </div>
        </div>

        <div class="contributors-list" aria-live="polite">
          <div v-if="loading" class="contributors-state">
            Loading GitHub activity...
          </div>
          <div v-else-if="unavailable" class="contributors-state">
            <span>GitHub activity is unavailable right now.</span>
            <a :href="bluefinPulseUrl" target="_blank" rel="noopener noreferrer">View activity on GitHub</a>
          </div>
          <div v-else class="activity-list">
            <a
              v-for="contributor in contributors"
              :key="contributor.login"
              class="activity-row"
              :href="contributor.html_url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGithub class="github-mark" aria-hidden="true" />
              <span class="contributor-name">{{ contributor.login }}</span>
            </a>
            <a class="activity-footer" :href="bluefinPulseUrl" target="_blank" rel="noopener noreferrer">
              View full repository activity on GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
#contributors {
  background-color: var(--color-bg);

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .contributors-header {
    margin-bottom: 32px;

    h2 {
      margin: 0;
      color: var(--color-text-light);
      font-family: Inter;
      font-size: 7rem;
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
    }
  }

  .contributors-card {
    display: grid;
    grid-template-columns: minmax(280px, 360px) 1fr;
    gap: 32px;
    align-items: start;
    padding: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .contributors-copy {
    h3 {
      margin-bottom: 16px;
      color: var(--color-text);
      font-size: 2.4rem;
      font-weight: 600;
    }

    p {
      margin-bottom: 24px;
      color: var(--color-text-light);
      font-size: 1.6rem;
      line-height: 1.6;
    }

    .contributors-summary {
      color: var(--color-text);
      font-size: 1.2rem;
      opacity: 0.65;
    }
  }

  .contributors-list {
    min-height: 276px;
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .activity-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 30px;
    color: var(--color-text-light);
    text-decoration: none;

    &:hover .contributor-name {
      color: var(--color-blue-light);
    }
  }

  .github-mark {
    width: 20px;
    height: 20px;
    color: var(--color-text-light);
  }

  .contributor-name {
    color: var(--color-text-light);
    font-size: 1.3rem;
    font-weight: 600;
    transition: color 0.15s ease;
  }

  .activity-footer {
    align-self: flex-start;
    margin-top: 8px;
    color: var(--color-blue-light);
    font-size: 1.2rem;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .contributors-state {
    display: flex;
    min-height: 236px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-light);
    font-size: 1.4rem;

    a {
      color: var(--color-blue-light);
      text-decoration: none;
    }
  }

  .card-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .contributors-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 4px;
    background: var(--color-blue);
    color: white;
    font-size: 1.4rem;
    font-weight: 600;
    text-decoration: none;

    &.secondary {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  @media (max-width: 768px) {
    .contributors-header h2 {
      font-size: 4rem;
    }

    .contributors-card {
      grid-template-columns: 1fr;
      padding: 24px;
    }

    .contributors-list {
      padding: 16px;
    }

    .card-buttons {
      justify-content: center;
    }
  }
}
</style>
