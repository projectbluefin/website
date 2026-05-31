<script setup lang="ts">
import type { BlogPost } from '../utils/feedParser'
import type { MessageSchema } from './../locales/schema'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseAtomFeed } from '../utils/feedParser'

const props = defineProps<{
  feedUrl: string
  perPage?: number
}>()

const { t } = useI18n<MessageSchema>({
  useScope: 'global'
})

/**
 * RSS/Atom Feed Parser Component
 *
 * This component fetches and displays RSS/Atom feeds with graceful fallback.
 * It attempts a direct fetch first. If the feed server does not send CORS headers
 * that allow this origin, the request will fail and the component shows mock data.
 *
 * Production Note: The target site (docs.projectbluefin.io) should add CORS headers
 * (Access-Control-Allow-Origin: *) to allow direct access. A third-party CORS proxy
 * is explicitly NOT used — it would introduce a reliability and privacy risk.
 */

const posts = ref<BlogPost[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Mock data for testing when the real feed is not accessible
const mockPosts: BlogPost[] = [
  {
    title: 'Introducing Project Bluefin',
    link: 'https://docs.projectbluefin.io/blog/introducing-project-bluefin',
    description:
      'Welcome to Project Bluefin, the next generation Linux workstation designed for reliability, performance, and sustainability.',
    pubDate: '2024-01-15T10:00:00Z',
    formattedDate: 'January 15, 2024'
  },
  {
    title: 'Developer Mode: Cloud-Native Workflows',
    link: 'https://docs.projectbluefin.io/blog/developer-mode',
    description:
      'Learn about Bluefin\'s developer mode and how it transforms your device into a powerful workstation with container-focused workflows.',
    pubDate: '2024-01-20T14:30:00Z',
    formattedDate: 'January 20, 2024'
  },
  {
    title: 'Understanding Image-Based Updates',
    link: 'https://docs.projectbluefin.io/blog/image-based-updates',
    description:
      'Discover how Bluefin\'s automatic image-based updates provide near-zero maintenance while ensuring system stability.',
    pubDate: '2024-01-25T09:15:00Z',
    formattedDate: 'January 25, 2024'
  }
]

async function fetchFeed() {
  try {
    loading.value = true
    error.value = null

    // Try to fetch the real feed directly.
    // If the feed server lacks CORS headers, this will fail — fall through to mock data.
    try {
      const response = await fetch(props.feedUrl, {
        mode: 'cors',
        headers: {
          Accept: 'application/atom+xml, application/xml, text/xml'
        }
      })

      if (response.ok) {
        const xmlText = await response.text()
        const parsedPosts = parseAtomFeed(xmlText)
        const limit = props.perPage || parsedPosts.length
        posts.value = parsedPosts.slice(0, limit)
        return
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    catch (fetchError) {
      console.warn('Failed to fetch live feed, using fallback:', fetchError)

      // If the feed is not accessible (CORS, network issues, etc.), use mock data.
      // This ensures the UI still works during development and provides a fallback.
      const limit = props.perPage || mockPosts.length
      posts.value = mockPosts.slice(0, limit)
    }
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load feed'
    console.error('RSS Feed Error:', err)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFeed()
})
</script>

<template>
  <div class="rss-feed">
    <div v-if="loading" class="loading">
      <p>{{ t("News.Loading") }}</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="posts.length === 0" class="no-posts">
      <p>{{ t("News.NoPosts") }}</p>
    </div>

    <div v-else class="posts-list">
      <article v-for="post in posts" :key="post.link" class="blog-post">
        <div class="post-content">
          <div class="post-text">
            <header class="post-header">
              <h3 class="post-title">
                <a :href="post.link" target="_blank" rel="noopener noreferrer">
                  {{ post.title }}
                </a>
              </h3>
              <time v-if="post.formattedDate" class="post-date">
                {{ post.formattedDate }}
              </time>
            </header>
            <div v-if="post.description" class="post-description">
              <p>{{ post.description }}</p>
            </div>
          </div>
        </div>
      </article>

      <div class="feed-source">
        <p class="source-text">
          <a
            :href="feedUrl.replace('/atom.xml', '')"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t("News.ViewAll") }}
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rss-feed {
  width: 100%;
}

.loading,
.error,
.no-posts {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #dc3545;
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.blog-post {
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
  transition: box-shadow 0.2s ease;
}

.blog-post:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.post-content {
  width: 100%;
}

.post-text {
  width: 100%;
}

.post-header {
  margin-bottom: 0.75rem;
}

.post-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
}

.post-title a {
  color: #1f2937;
  text-decoration: none;
  transition: color 0.2s ease;
}

.post-title a:hover {
  color: #4285f4;
}

.post-date {
  color: #6b7280;
  font-size: 1rem;
  font-weight: 500;
}

.post-description {
  color: #4b5563;
  line-height: 1.6;
  font-size: 1.6rem;
}

.post-description p {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-source {
  margin-top: 1rem;
  text-align: center;
  padding-top: 1rem;
}

.source-text {
  margin: 0;
  font-size: 1.7rem;
}

.source-text a {
  color: #4285f4;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.source-text a:hover {
  color: #3367d6;
  text-decoration: underline;
}

/* Dark mode support if needed */
@media (prefers-color-scheme: dark) {
  .blog-post {
    background: #1f2937;
    border-color: #374151;
  }

  .post-title a {
    color: #f9fafb;
  }

  .post-title a:hover {
    color: #60a5fa;
  }

  .post-description {
    color: #d1d5db;
  }

  .feed-source {
    border-color: #374151;
  }

  .source-text a {
    color: #60a5fa;
  }

  .source-text a:hover {
    color: #93c5fd;
  }
}

/* Responsive design for smaller screens */
@media (max-width: 768px) {
  .post-content {
    width: 100%;
  }
}
</style>
