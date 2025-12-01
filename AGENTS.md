# GitHub Copilot Instructions for Bluefin Website

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

## Project Overview

This is the official website for **Project Bluefin**, a next-generation Linux workstation operating system designed for reliability, performance, and sustainability. Bluefin combines the reliability and ease of use of a Chromebook with the power of a GNOME desktop, targeting cloud-native enthusiasts and developers who need a more reliable Linux desktop experience.

**Key Characteristics:**
- Cloud-native patterns applied to desktop computing
- Container-focused workflows for developers
- Image-based updates for system stability
- Strong focus on sustainability and community
- Designed for both end users and developers

## Quick Start (Verified Workflow)

**For agents getting started, follow this exact sequence:**

```bash
# 1. Install dependencies (required: --include=dev flag)
npm install --include=dev         # ~6s, installs 102 packages

# 2. Start development server (use async mode)
npm run dev                       # ~190ms, serves on http://localhost:5173/

# 3. Build for production (optional verification)
npm run build                     # ~1.7s, outputs to ./dist/

# 4. Format code before committing
npm run lint:fix
```

**Verification:** After install, confirm `node_modules/@vitejs/plugin-vue` exists. After dev server starts, curl http://localhost:5173/ should return HTML with title "Bluefin | The Next Generation Linux Workstation".

## Working Effectively

**Package Management:**
- **Primary:** npm (used in CI/CD and recommended for development)
- **Secondary:** Bun (bun.lockb present but not required)
- **Always use npm commands** for consistency with GitHub Actions deployment
- Both package-lock.json and bun.lockb are maintained in the repository

**Bootstrap, build, and test the repository:**

1. **Install dependencies** (takes ~6 seconds):
   ```bash
   npm install --include=dev
   ```
   - **CRITICAL:** Must use `--include=dev` flag to install devDependencies (@vitejs/plugin-vue, vite, etc.)
   - Without devDependencies, the dev server will fail with "Cannot find package '@vitejs/plugin-vue'" error
   - Uses npm as primary package manager (Bun lockfile also present but npm preferred)
   - May show deprecation warning for @types/marked (safe to ignore)

2. **Build the project** (takes ~2 seconds):
   ```bash
   npm run build
   ```
   - **NEVER CANCEL**: Set timeout to 60+ seconds minimum
   - Outputs to `./dist/` directory
   - TypeScript compilation with vue-tsc followed by Vite build
   - Build completes quickly but always allow adequate timeout for slower systems

3. **Development server** (starts in ~1 second):
   ```bash
   npm run dev
   ```
   - Runs on http://localhost:5173/
   - Hot reload enabled
   - **Run in async mode** to keep server alive between commands
   - Server may die if run in detached mode without proper process management
   - To expose to network: `npm run dev -- --host 0.0.0.0`

4. **Preview production build** (starts immediately):
   ```bash
   npm run preview
   ```
   - Runs on http://localhost:4173/
   - Tests the production build locally

## Validation

**ALWAYS manually validate changes through complete user scenarios:**

1. **Start development server** and navigate to http://localhost:5173/
2. **Test core functionality:**
   - Language selector in header works (try switching languages)
   - Navigation menu scrolls to sections
   - FAQ items expand/collapse
   - All external links open in new tabs
   - Download form responds to selections
3. **Test responsive design:** Resize browser to mobile/tablet widths
4. **Check console** for JavaScript errors or warnings
5. **Take screenshots** of any UI changes you make

**DO NOT** skip manual validation - the build succeeding does not guarantee functionality works correctly.

## Linting and Code Quality

**Code formatting** (takes ~3-5 seconds):
```bash
# Check formatting issues
npm run lint

# Fix formatting issues
npm run lint:fix

```
**ESLint**
- Configured with configuration at `eslint.config.js`
- Extends @antfu/eslint-config

## Common Commands and Timing

**Verified timings from fresh build (2025-11-19):**
- `npm install --include=dev`: ~6 seconds (installs 102 packages, REQUIRED for devDependencies)
- `npm run build`: ~1.7 seconds (outputs 8 assets + HTML files to ./dist/)
- `npm run dev`: ~190ms to start (serves on http://localhost:5173/, use async mode)
- `npm run preview`: Instant (serves ./dist/ on http://localhost:4173/)

**CRITICAL**: Always use `npm install --include=dev` to ensure @vitejs/plugin-vue and other dev dependencies are installed.

## Technology Stack

### Frontend Framework
- **Vue 3** with Composition API (`<script setup>` syntax preferred)
- **TypeScript** for type safety
- **Vite 7.1.12** for build tooling and development server
- **Vue i18n** for internationalization (12 languages supported: de-DE, en-US, eo, fr-FR, ja-JP, nl-NL, pt-BR, ru-RU, sk-SK, vi-VN, zh-HK, zh-TW)

### Styling
- **TailwindCSS 4.1.16** with @tailwindcss/vite plugin
- **SCSS** for custom styling with mixins and helpers
- **Custom SCSS mixins** located in `src/style/setup/_mixins.scss`
- **Responsive design** patterns for mobile, tablet, and desktop

### Additional Libraries
- **@iconify-prerendered/vue-mdi** for Material Design icons
- **marked** for markdown parsing
- **@vueuse/core** and **@vueuse/components** for Vue utilities and composables
- **@iframe-resizer** packages for responsive iframe embedding
- **sass** for SCSS compilation
- **js-yaml** for YAML parsing

## Repository Structure

**Key directories and files:**
```
/
├── .github/workflows/         # CI/CD pipelines
│   ├── deploy.yml            # GitHub Pages deployment (on push to main, releases)
│   ├── images.yml            # Image optimization workflow
│   └── update-stream-versions.yml  # Version update automation
├── public/                   # Static assets
│   ├── characters/           # Character artwork (.webp)
│   ├── brands/              # Brand logos (.svg, .png)
│   ├── evening/             # Background images
│   ├── favicons/            # Site icons
│   └── testing.html         # Testing page (also built to dist/public/)
├── src/
│   ├── components/          # Vue components (21 total)
│   │   ├── scenes/         # Major page sections (4 components)
│   │   ├── sections/       # Smaller reusable sections (6 components)
│   │   └── common/         # Shared components (3 components)
│   ├── locales/            # i18n translation files (12 JSON files)
│   ├── style/              # SCSS styling
│   │   ├── setup/          # Mixins, variables, fonts, reset
│   │   └── app/            # Component-specific styles
│   ├── content.ts          # Main content constants
│   ├── composables.ts      # Vue composables
│   └── main.ts            # App entry point
├── package.json            # Dependencies and scripts
├── vite.config.ts         # Vite configuration (multi-page: index.html + testing.html)
├── tailwind.config.js     # TailwindCSS configuration
├── tsconfig.json          # TypeScript configuration
└── eslint.config.js       # Code formatting rules
```

**No test infrastructure exists** - validation is done manually through browser testing.

## Code Organization

### Component Development Patterns

#### Scene Components
Large page sections that typically include:
- Parallax effects and animations
- Character artwork integration
- Structured content with tags, titles, and descriptions
- Visibility tracking for navigation

#### Responsive Design
- Mobile-first approach
- Use `IS_TABLET` composable for conditional logic
- Progressive image loading for performance
- Adaptive content based on screen size

#### Performance Considerations
- Lazy loading for images: `loading="lazy"`
- WebP format for images where possible
- Conditional asset loading based on device capabilities
- Preload critical assets in `App.vue`

### Component Patterns

#### Preferred Component Structure
```vue
<script setup lang="ts">
// Imports
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Props and emits (if needed)
defineProps<{
  title?: string
}>()

// Composables
const { t } = useI18n()

// Local state and logic
const isVisible = ref(false)
</script>

<template>
  <!-- Template with semantic HTML -->
  <section class="component-name">
    <h2>{{ t('Section.Title') }}</h2>
  </section>
</template>
```

#### Component Naming
- Use PascalCase for component names
- Scene components: `Scene{Name}.vue` (e.g., `SceneLanding.vue`)
- Section components: `Section{Name}.vue` (e.g., `SectionMission.vue`)
- Utility components: descriptive names (e.g., `PageLoading.vue`, `Navigation.vue`)

#### Existing Components Reference
**Scenes (4):** `SceneLanding.vue`, `SceneDevelopers.vue`, `SceneGamers.vue`, `SceneUsers.vue`
**Sections (6):** `SectionFooter.vue`, `SectionMission.vue`, `SectionNews.vue`, `SectionPicker.vue`, `SectionQuestions.vue`, `SectionVideo.vue`, `ParallaxWrapper.vue`
**Common (3):** `SceneContent.vue`, `SceneVisibilityChecker.vue`, `TextArrow.vue`
**Root Components (7):** `Navigation.vue`, `TopNavbar.vue`, `PageLoading.vue`, `FaqItem.vue`, `ImagePicker.vue`, `ImageChooser.vue`, `RssFeed.vue`

## Content Management

### Internationalization Pattern
All user-facing text should be externalized to translation files:

**In content.ts:**
```typescript
export const LangSectionTitle = 'Default English Text'
```

**In locale files (e.g., en-US.json):**
```json
{
  "Section": {
    "Title": "Localized Text",
    "Subtitle": "More localized content"
  }
}
```

**In components:**
```vue
<template>
  <h2>{{ t('Section.Title') }}</h2>
</template>
```

**Available languages:** de-DE, en-US, eo, fr-FR, ja-JP, nl-NL, pt-BR, ru-RU, sk-SK, vi-VN, zh-HK, zh-TW (12 total)

### Content Guidelines
- Use markdown support where available (rendered with `marked.parse()`)
- Support HTML in content when necessary
- Include proper citations for quotes using `<cite>` tags
- Maintain consistent voice that reflects Bluefin's mission and character

## Styling Guidelines

### SCSS Mixins (src/style/setup/_mixins.scss)
Common mixins available for use:

```scss
@include flex($gap, $justify, $align, $direction, $wrap) // Flexbox layouts
  @include grid($gap, $columns) // Grid layouts
  @include t($time, $type) // Transitions
  @include noselect() // Disable text selection
  @include noscrollbar(); // Hide scrollbars
```

### TailwindCSS Integration
- Prefer Tailwind utilities for spacing, colors, and typography
- Use custom SCSS for complex animations and component-specific styles
- Follow mobile-first responsive design principles

### Color and Theme
- Uses CSS custom properties for theming
- Dark/light theme support through CSS variables
- Ocean/aquatic color palette reflecting the Bluefin theme
- Ensure the font sizes match and are consistent across components

## Development Workflows

### Making Changes
1. **Start development server:** `npm run dev` (use async mode)
2. **Make your changes** to Vue components, TypeScript, or SCSS files
3. **Test functionality manually** in browser (http://localhost:5173/)
4. **Format code:** `npm run lint:fix`
5. **Build to verify:** `npm run build`
6. **Test production build:** `npm run preview`

### Troubleshooting Dev Server
- **"Cannot find package '@vitejs/plugin-vue'":** Run `npm install --include=dev`
- **Server dies immediately:** Run in async mode, not detached mode
- **Port 5173 in use:** Server will automatically use port 5174
- **Cannot connect from browser:** Ensure server is running with `ps aux | grep vite`
- **Need network access:** Use `npm run dev -- --host 0.0.0.0`

### Adding New Components
1. **Create component** in appropriate directory (`scenes/`, `sections/`, or `common/`)
2. **Follow naming convention** (PascalCase, descriptive names)
3. **Use `<script setup>` syntax** with TypeScript
4. **Import and register** in parent components
5. **Test responsive behavior** on mobile/tablet/desktop

### Adding New Languages
1. **Create `{locale}.json`** in `src/locales/` following `en-US.json` schema
2. **Ensure all keys match** the English version exactly
3. **Update imports** in `src/locales/schema.ts`
4. **Test language switching** via header dropdown

### Troubleshooting
- **Build failures:** Check TypeScript errors in terminal output
- **Dev server won't start:** Ensure `npm install --include=dev` was run
- **Server process dies:** Use async mode instead of detached mode
- **Missing images:** Verify paths relative to `public/` directory
- **Translation issues:** Ensure locale keys exist in all 12 language files
- **Styling problems:** Check for SCSS syntax errors or missing Tailwind classes
- **ESLint errors:** Use Prettier instead (ESLint setup incomplete)
- **Port conflicts:** Vite will auto-select next available port (5174, 5175, etc.)

## CI/CD Pipeline

**GitHub Actions workflows:**
- **deploy.yml:** Builds and deploys to GitHub Pages on push to main, releases, and manual trigger
- **images.yml:** Image optimization workflow
- **update-stream-versions.yml:** Automated version updates

**Deployment process:**
1. Code pushed to main branch or release published
2. GitHub Actions runs Node.js 24 with `npm install` and `npm run build`
3. Built files from `./dist/` deployed to GitHub Pages
4. Live site updates at https://projectbluefin.io/

## Quick Reference

### Common File Locations
- **Components:** `src/components/{scenes,sections,common}/`
- **Styles:** `src/style/`
- **Translations:** `src/locales/`
- **Content:** `src/content.ts`
- **Assets:** `public/{characters,brands,evening}/`
- **Config:** `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`

### Essential Commands
```bash
npm install --include=dev  # Install all dependencies including dev (~6s)
npm run dev               # Start dev server (~1s, use async mode)
npm run build             # Build for production (~2s)
npm run preview           # Preview production build
npm run lint               # Lints the project
npm run lint:fix             # Lints and fixes issues in the project
```

**CRITICAL REMINDERS:**
- ⏱️ **ALWAYS use `--include=dev`** when installing dependencies
- 🚀 **Run dev server in async mode** to keep it alive
- 🧪 **ALWAYS test manually** after making changes
- 📱 **Test responsive design** on different screen sizes
- 🌍 **Consider i18n impact** for all text changes (12 languages supported)
- 📸 **Take screenshots** of UI changes for review
- **Always** follow the conventional commits specification when sending pull requests
- **Always** include screenshots of both desktop and mobile in pull requests
- **Always** use tailwind css and do not hardcode pixel sizes
- **Always** ensure that every file passes lint at the end of the request
- **Always** ensure images are compressed appropriately for mobile
- **Always** do surgical improvements, keep it simple and readable
- **Always** match conventions that exist, like font sizes and visual style

### Attribution Requirements

AI agents must disclose what tool and model they are using in the "Assisted-by" commit footer:

```text
Assisted-by: [Model Name] via [Tool Name]
```

Example:

```text
Assisted-by: GLM 4.6 via Claude Code
```
