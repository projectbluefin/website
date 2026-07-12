# Wolves Multimedia Narrative Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `/wolves/` as a performant, accessible, soundtrack-led Project Bluefin story with a canonical comic and archive order.

**Architecture:** A typed story manifest becomes the single source of truth for chapter metadata and archive artifacts. Focused Vue components render the soundtrack entry/control, PDF reader, and chronological archive; `WolvesApp.vue` composes them and owns only cross-component story state. PDF.js renders the active page and adjacent pages on demand, while the continuous view uses `IntersectionObserver`.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Vite, Vitest, `@vue/test-utils`, happy-dom, Sass, PDF.js CDN, YouTube playlist embed, browser `localStorage`, `IntersectionObserver`.

## Global Constraints

- Do not autoplay audio; sound starts only after an explicit user action.
- Use `import.meta.env.BASE_URL` for first-party Wolves assets.
- Preserve the Bluefin blue/night visual language and current support links.
- Do not claim the soundtrack is playing until the embedded player has loaded.
- Keep the page readable if YouTube, PDF.js, the PDF, or an external source fails.
- Use semantic controls, visible `:focus-visible` states, and 44px minimum touch targets.
- Respect `prefers-reduced-motion`.
- Run `npm run test:run`, `npm run typecheck`, `npm run lint`, and `npm run build` before release.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/data/wolves-story.ts` | Typed release, chapter, and artifact manifest in canonical order. |
| `src/utils/wolvesStory.ts` | Pure manifest lookup, archive ordering, URL state, and return-visit helpers. |
| `src/tests/wolvesStory.test.ts` | Unit tests for canonical order, chapter lookup, URL state, and new-entry detection. |
| `src/components/wolves/WolvesSoundtrack.vue` | Above-fold entry choice and persistent user-initiated soundtrack control. |
| `src/components/wolves/WolvesComicReader.vue` | PDF.js paged/continuous reader and progressive canvas rendering. |
| `src/components/wolves/WolvesArchive.vue` | Chronological, filterable, permalinkable archive and chapter-boundary artifacts. |
| `src/WolvesApp.vue` | Hero, chapter progress, section composition, and support links. |
| `src/components/TopNavbar.vue` | Close the mobile menu on Escape and restore focus to its toggle. |
| `wolves/index.html` | Route metadata, base-path-safe assets, and production campaign metadata. |

### Task 1: Add Vue Component Test Support

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/tests/componentSetup.test.ts`

**Interfaces:**
- Produces: Vitest's `happy-dom` environment and `mount()` support for Vue component tests.

- [ ] **Step 1: Add the test dependencies**

Run:

```bash
npm install --save-dev @vue/test-utils happy-dom
```

Expected: `package.json` and `package-lock.json` add both packages under `devDependencies`.

- [ ] **Step 2: Configure the test environment**

Update the `test` section in `vite.config.ts`:

```ts
test: {
  environment: 'happy-dom',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    thresholds: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50,
    },
  },
},
```

- [ ] **Step 3: Add the test harness smoke test**

Create `src/tests/componentSetup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

describe('Vue component test harness', () => {
  it('mounts an interactive component', async () => {
    const wrapper = mount({
      data: () => ({ count: 0 }),
      template: '<button @click="count++">{{ count }}</button>',
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toBe('1')
  })
})
```

- [ ] **Step 4: Run the test harness**

Run: `npm run test:run -- src/tests/componentSetup.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/tests/componentSetup.test.ts
git commit -m "test: support Vue component tests"
```

### Task 2: Verify & Protect the Production Route

**Files:**
- Modify: `wolves/index.html`
- Modify: `src/tests/content.test.ts`

**Interfaces:**
- Produces: a build artifact at `dist/wolves/index.html` with title, description, canonical Open Graph URL, and first-party asset URLs that work under a Vite base path.

- [ ] **Step 1: Write the failing route-artifact test**

Add this assertion to `src/tests/content.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

it('publishes the Wolves campaign entrypoint', async () => {
  const html = await readFile(resolve(process.cwd(), 'wolves/index.html'), 'utf8')

  expect(html).toContain('<title>Bluefin: Seven Days to the Wolves</title>')
  expect(html).toContain('property="og:url" content="https://projectbluefin.io/wolves/"')
  expect(html).toContain('src="/src/wolves-main.ts"')
})
```

- [ ] **Step 2: Run the test to verify the current metadata contract**

Run: `npm run test:run -- src/tests/content.test.ts`  
Expected: PASS after the route metadata is confirmed or FAIL with the missing campaign metadata.

- [ ] **Step 3: Make asset paths base-path safe**

Replace first-party root-relative metadata paths in `wolves/index.html` with relative paths:

```html
<link rel="preload" as="image" href="../evening/10-bluefin-night.webp">
<link rel="icon" href="../favicons/favicon.ico">
<link rel="manifest" href="../favicons/site.webmanifest">
```

Keep absolute canonical and social URLs because they intentionally describe the public production URL.

- [ ] **Step 4: Build and inspect the emitted route**

Run:

```bash
npm run build
test -f dist/wolves/index.html
grep -q 'Seven Days to the Wolves' dist/wolves/index.html
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add wolves/index.html src/tests/content.test.ts
git commit -m "test(wolves): protect campaign entrypoint"
```

### Task 3: Establish the Canonical Story Manifest

**Files:**
- Create: `src/data/wolves-story.ts`
- Create: `src/utils/wolvesStory.ts`
- Create: `src/tests/wolvesStory.test.ts`

**Interfaces:**
- Produces: `wolvesRelease`, `WolvesChapter`, `WolvesArtifact`, `getChapterForPage()`, `getArtifactsForChapter()`, and `getNewArtifactIds()`.

- [ ] **Step 1: Write failing manifest tests**

Create `src/tests/wolvesStory.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wolvesRelease } from '../data/wolves-story'
import { getArtifactsForChapter, getChapterForPage, getNewArtifactIds } from '../utils/wolvesStory'

describe('Wolves story manifest', () => {
  it('assigns every comic page to exactly one chapter', () => {
    expect(getChapterForPage(1)?.id).toBe('prologue')
    expect(getChapterForPage(15)?.id).toBe('awakening')
    expect(getChapterForPage(16)).toBeUndefined()
  })

  it('keeps archive artifacts in their chapter order', () => {
    expect(getArtifactsForChapter('prologue').map(artifact => artifact.id))
      .toEqual(['forbidden-factory', 'maintenance-window'])
  })

  it('identifies artifacts added after a stored release', () => {
    expect(getNewArtifactIds('2026-07-11-r1')).toEqual([])
    expect(getNewArtifactIds('unknown-release')).toEqual(wolvesRelease.artifacts.map(artifact => artifact.id))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/tests/wolvesStory.test.ts`  
Expected: FAIL because the manifest and helpers do not exist.

- [ ] **Step 3: Create the typed manifest and helpers**

Create `src/data/wolves-story.ts` with these exported types and first release:

```ts
export type WolvesArtifactType = 'transmission' | 'quote' | 'news' | 'source'

export interface WolvesChapter {
  id: string
  title: string
  description: string
  pageStart: number
  pageEnd: number
  soundtrackLabel: string
}

export interface WolvesArtifact {
  id: string
  chapterId: string
  type: WolvesArtifactType
  publishedAt: string
  title: string
  body: string
  sourceUrl?: string
  sourceLabel?: string
}

export interface WolvesRelease {
  id: string
  publishedAt: string
  chapters: WolvesChapter[]
  artifacts: WolvesArtifact[]
}

export const wolvesRelease: WolvesRelease = {
  id: '2026-07-11-r1',
  publishedAt: '2026-07-11',
  chapters: [
    { id: 'prologue', title: 'The Signal', description: 'The archive opens.', pageStart: 1, pageEnd: 5, soundtrackLabel: 'Arrival' },
    { id: 'pursuit', title: 'The Hunt', description: 'The maintainers are pursued.', pageStart: 6, pageEnd: 10, soundtrackLabel: 'Pressure' },
    { id: 'awakening', title: 'The Wolves', description: 'Resistance becomes possible.', pageStart: 11, pageEnd: 15, soundtrackLabel: 'Resistance' },
  ],
  artifacts: [
    { id: 'forbidden-factory', chapterId: 'prologue', type: 'transmission', publishedAt: '2326-07-09', title: 'Forbidden Factory', body: 'Are you still transmitting?' },
    { id: 'maintenance-window', chapterId: 'prologue', type: 'transmission', publishedAt: '2326-06-15', title: 'Maintenance Window', body: 'It is ready. We need a name before sunrise.' },
  ],
}
```

Create `src/utils/wolvesStory.ts`:

```ts
import { wolvesRelease, type WolvesArtifact, type WolvesChapter } from '../data/wolves-story'

export function getChapterForPage(page: number): WolvesChapter | undefined {
  return wolvesRelease.chapters.find(chapter => page >= chapter.pageStart && page <= chapter.pageEnd)
}

export function getArtifactsForChapter(chapterId: string): WolvesArtifact[] {
  return wolvesRelease.artifacts.filter(artifact => artifact.chapterId === chapterId)
}

export function getNewArtifactIds(lastSeenReleaseId: string | null): string[] {
  return lastSeenReleaseId === wolvesRelease.id ? [] : wolvesRelease.artifacts.map(artifact => artifact.id)
}
```

Migrate the existing quote and intercepted-communications records into `wolvesRelease.artifacts` with complete body and source fields before deleting their old consumers.

- [ ] **Step 4: Run the manifest tests**

Run: `npm run test:run -- src/tests/wolvesStory.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/wolves-story.ts src/utils/wolvesStory.ts src/tests/wolvesStory.test.ts
git commit -m "feat(wolves): add canonical story manifest"
```

### Task 4: Build the Soundtrack Entry & Persistent Control

**Files:**
- Create: `src/components/wolves/WolvesSoundtrack.vue`
- Create: `src/tests/wolvesSoundtrack.test.ts`
- Modify: `src/WolvesApp.vue`

**Interfaces:**
- Consumes: `WolvesChapter`.
- Produces: `<WolvesSoundtrack :chapter="activeChapter" @entered="hasEntered = true" />`.

- [ ] **Step 1: Write a component test for sound consent**

Create `src/tests/wolvesSoundtrack.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WolvesSoundtrack from '../components/wolves/WolvesSoundtrack.vue'

it('does not create the player until the visitor starts the soundtrack', async () => {
  const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })

  expect(wrapper.find('iframe').exists()).toBe(false)
  await wrapper.get('button[aria-label="Start soundtrack"]').trigger('click')
  expect(wrapper.find('iframe').attributes('src')).toContain('youtube.com/embed/videoseries')
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm run test:run -- src/tests/wolvesSoundtrack.test.ts`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component with user-initiated state**

Implement the following state boundaries in `WolvesSoundtrack.vue`:

```ts
const playlistUrl = 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE'
const embedUrl = 'https://www.youtube.com/embed/videoseries?list=PLA78oiE-RGAE&autoplay=1&rel=0'
const hasStarted = ref(false)
const playerLoaded = ref(false)
const isMuted = ref(false)

function start() {
  hasStarted.value = true
}
```

Render an above-fold `Enter With Soundtrack` button with `aria-label="Start soundtrack"` and a `Read Silently` button. Render the iframe only when `hasStarted` is true, set `playerLoaded` only in the iframe `@load` handler, and label the state **Starting soundtrack…** until then. Render an external playlist link using `playlistUrl`. Use `<button>` for collapse/reopen, play, mute, and dismiss controls.

- [ ] **Step 4: Compose it into the hero and reserve mobile space**

In `src/WolvesApp.vue`, replace the existing `sticky-soundtrack-bar` markup and related state with:

```vue
<WolvesSoundtrack
  :chapter="activeChapter"
  @entered="hasEntered = true"
/>
```

Add `padding-bottom: calc(88px + env(safe-area-inset-bottom));` to the page’s mobile layout and apply `padding-bottom: env(safe-area-inset-bottom);` to the fixed player control.

- [ ] **Step 5: Run the focused test**

Run: `npm run test:run -- src/tests/wolvesSoundtrack.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/wolves/WolvesSoundtrack.vue src/tests/wolvesSoundtrack.test.ts src/WolvesApp.vue
git commit -m "feat(wolves): make soundtrack the story entry"
```

### Task 5: Make Comic Rendering Progressive & Chapter-Aware

**Files:**
- Create: `src/components/wolves/WolvesComicReader.vue`
- Create: `src/tests/wolvesComicReader.test.ts`
- Modify: `src/WolvesApp.vue`

**Interfaces:**
- Consumes: `WolvesChapter[]`.
- Produces: `update:page` and `chapter-change` events with a one-based page number and chapter ID.

- [ ] **Step 1: Write reader state tests**

Create `src/tests/wolvesComicReader.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WolvesComicReader from '../components/wolves/WolvesComicReader.vue'

it('starts in paged mode and reports the active page', async () => {
  const wrapper = mount(WolvesComicReader, { props: { chapters: [] } })

  expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Page By Page')
  await wrapper.get('button[aria-label="Next page"]').trigger('click')
  expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
})
```

- [ ] **Step 2: Run the reader test to verify it fails**

Run: `npm run test:run -- src/tests/wolvesComicReader.test.ts`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Move PDF.js logic into the focused reader**

Move `PDF_URL`, dynamic PDF.js loading, canvas rendering, reader state, and resize cleanup from `src/WolvesApp.vue` to `WolvesComicReader.vue`. Keep the source URL as:

```ts
const pdfUrl = `${import.meta.env.BASE_URL}color-with-bluefin.pdf`
```

Use `readingMode = ref<'paged' | 'continuous'>('paged')`. In paged mode, render exactly one canvas. In continuous mode, create a page placeholder per page and attach one `IntersectionObserver`:

```ts
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      void renderPage(Number((entry.target as HTMLElement).dataset.page))
    }
  }
}, { rootMargin: '800px 0px' })
```

Observe each placeholder after PDF metadata loads. Do not call a loop that renders every page. Disconnect the observer and cancel outstanding render tasks on unmount.

- [ ] **Step 4: Implement accessible reader controls**

Use a `role="tablist"` for mode controls, buttons with `role="tab"` and `:aria-selected`, and named controls:

```vue
<button aria-label="Previous page" :disabled="page === 1" @click="setPage(page - 1)">Previous</button>
<button aria-label="Next page" :disabled="page === totalPages" @click="setPage(page + 1)">Next</button>
```

Emit `update:page` from `setPage()` and derive the active chapter through `getChapterForPage(page)`.

- [ ] **Step 5: Compose reader state in `WolvesApp.vue`**

Replace the in-file reader with:

```vue
<WolvesComicReader
  :chapters="wolvesRelease.chapters"
  @update:page="currentPage = $event"
/>
```

Add `const currentPage = ref(1)` and:

```ts
const activeChapter = computed(() => getChapterForPage(currentPage.value))
```

- [ ] **Step 6: Run focused reader tests**

Run: `npm run test:run -- src/tests/wolvesComicReader.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/wolves/WolvesComicReader.vue src/tests/wolvesComicReader.test.ts src/WolvesApp.vue
git commit -m "feat(wolves): render comic pages on demand"
```

### Task 6: Build the Chronological Archive & Return-Visit Cue

**Files:**
- Create: `src/components/wolves/WolvesArchive.vue`
- Create: `src/tests/wolvesArchive.test.ts`
- Modify: `src/WolvesApp.vue`

**Interfaces:**
- Consumes: `WolvesArtifact[]`, `activeChapterId`, and `newArtifactIds`.
- Produces: fragment links in the form `#artifact-<id>` and `update:filter`.

- [ ] **Step 1: Write archive behavior tests**

Create `src/tests/wolvesArchive.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WolvesArchive from '../components/wolves/WolvesArchive.vue'
import { wolvesRelease } from '../data/wolves-story'

it('renders artifacts in canonical order and marks new entries', () => {
  const wrapper = mount(WolvesArchive, {
    props: { artifacts: wolvesRelease.artifacts, activeChapterId: 'prologue', newArtifactIds: ['forbidden-factory'] },
  })

  expect(wrapper.findAll('article').map(article => article.attributes('id'))).toEqual(['artifact-forbidden-factory', 'artifact-maintenance-window'])
  expect(wrapper.get('#artifact-forbidden-factory').text()).toContain('New transmission')
})
```

- [ ] **Step 2: Run the archive test to verify it fails**

Run: `npm run test:run -- src/tests/wolvesArchive.test.ts`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement semantic chronological artifacts**

Render each artifact as:

```vue
<article :id="`artifact-${artifact.id}`" :data-type="artifact.type">
  <p class="artifact-type">{{ artifact.type }}</p>
  <h3><a :href="`#artifact-${artifact.id}`">{{ artifact.title }}</a></h3>
  <time :datetime="artifact.publishedAt">{{ artifact.publishedAt }}</time>
  <p>{{ artifact.body }}</p>
  <a v-if="artifact.sourceUrl" :href="artifact.sourceUrl" target="_blank" rel="noreferrer">
    {{ artifact.sourceLabel }}
  </a>
</article>
```

Provide an `All artifacts` button plus one button for each `WolvesArtifactType`. Store the selected type in `new URLSearchParams(location.search)` as `artifactType`; use `history.replaceState` when it changes so a copied URL reproduces the view.

- [ ] **Step 4: Add chapter-boundary artifacts and return state**

In `WolvesApp.vue`, compute `newArtifactIds` from:

```ts
const lastSeenReleaseKey = 'wolves-last-seen-release'
const newArtifactIds = computed(() => getNewArtifactIds(localStorage.getItem(lastSeenReleaseKey)))

onMounted(() => localStorage.setItem(lastSeenReleaseKey, wolvesRelease.id))
```

Render `WolvesArchive` after the reader and insert a chapter artifact callout when `currentPage` reaches a chapter end. The callout links to `#artifact-<id>`; it does not interrupt page navigation.

- [ ] **Step 5: Run the archive test**

Run: `npm run test:run -- src/tests/wolvesArchive.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/wolves/WolvesArchive.vue src/tests/wolvesArchive.test.ts src/WolvesApp.vue
git commit -m "feat(wolves): add chronological story archive"
```

### Task 7: Finish Accessibility, Motion, & Mobile Navigation

**Files:**
- Modify: `src/components/TopNavbar.vue`
- Modify: `src/components/wolves/WolvesSoundtrack.vue`
- Modify: `src/components/wolves/WolvesComicReader.vue`
- Modify: `src/components/wolves/WolvesArchive.vue`
- Create: `src/tests/wolvesAccessibility.test.ts`

**Interfaces:**
- Produces: keyboard-operable mobile navigation, pause-free archive updates, reduced-motion-safe visual treatment, and touch-safe controls.

- [ ] **Step 1: Write failing keyboard and semantic tests**

Create `src/tests/wolvesAccessibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WolvesSoundtrack from '../components/wolves/WolvesSoundtrack.vue'

it('uses an accessible button to reopen the collapsed soundtrack', () => {
  const wrapper = mount(WolvesSoundtrack, { props: { chapter: undefined } })
  expect(wrapper.get('button[aria-label="Start soundtrack"]').attributes('type')).toBe('button')
})
```

- [ ] **Step 2: Run the test to verify current behavior**

Run: `npm run test:run -- src/tests/wolvesAccessibility.test.ts`  
Expected: PASS after Task 3 or FAIL with a missing semantic control.

- [ ] **Step 3: Fix Escape behavior in `TopNavbar.vue`**

Add a keydown listener while the mobile menu is open:

```ts
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMenuOpen.value) {
    isMenuOpen.value = false
    menuButton.value?.focus()
  }
}
```

Register it in `onMounted`, remove it in `onBeforeUnmount`, and add `ref="menuButton"` to the menu toggle.

- [ ] **Step 4: Add focused CSS safeguards**

In each Wolves component, add a shared visible focus treatment and reduced-motion override:

```scss
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 3px solid var(--color-blue-light);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Keep controls at least `min-height: 44px; min-width: 44px;` and retain mobile safe-area padding from Task 3.

- [ ] **Step 5: Run the focused accessibility test**

Run: `npm run test:run -- src/tests/wolvesAccessibility.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopNavbar.vue src/components/wolves src/tests/wolvesAccessibility.test.ts
git commit -m "fix(wolves): improve keyboard and mobile access"
```

### Task 8: Verify & Release

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-wolves-multimedia-narrative-design.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`  
Expected: PASS.

- [ ] **Step 2: Run static validation**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits `0`; `dist/wolves/index.html` exists.

- [ ] **Step 3: Run a browser acceptance pass**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

At desktop and 390px mobile widths verify: soundtrack/silent choices are above fold; sound is not started before a click; player controls remain accessible; Page By Page is default; continuous mode does not eagerly paint all pages; archive filters update the URL; Escape closes the mobile menu; and the fixed player does not cover the support links.

- [ ] **Step 4: Publish and verify the live route**

Merge the branch through the normal review flow so the existing `Deploy to GitHub Pages` workflow runs. After its deploy job succeeds, run:

```bash
curl --fail --location --silent https://projectbluefin.io/wolves/ | grep -q 'Seven Days to the Wolves'
```

Expected: exit `0`; the campaign route no longer returns the GitHub Pages 404.

- [ ] **Step 5: Commit release documentation**

```bash
git add docs/superpowers/specs/2026-07-11-wolves-multimedia-narrative-design.md
git commit -m "docs(wolves): record multimedia narrative verification"
```
