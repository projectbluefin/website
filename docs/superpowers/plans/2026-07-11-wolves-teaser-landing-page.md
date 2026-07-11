# Wolves Teaser Landing Page Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the Wolves teaser landing page at `projectbluefin.io/wolves` to use the native Bluefin Blue palette, implement a floating sticky soundtrack widget, construct a highly responsive on-demand HTML5 Canvas PDF reader utilizing PDF.js CDN, and display automatically cycling dispatches from the 77 Discord quotes credited to "John Bazzite".

**Architecture:** 
The application revisions are contained entirely within `src/WolvesApp.vue`. It integrates the standard `TopNavbar.vue` header, fetches dynamic scripts from the official PDF.js CDN to keep the bundle size small, handles resize observers to fit canvases across viewports, and uses CSS opacity transitions to cyclically fade quotes from `bazzite-quotes.json`.

**Tech Stack:** Vue 3, Vite, Tailwind CSS (for structure/base), Sass/SCSS, PDF.js CDN, and inline SVG assets.

## Global Constraints
- **Colors:** Must use `--color-blue` (`#4285f4`) and `--color-blue-light` (`#8a97f7`) as the primary and secondary accents. Red crimson is prohibited.
- **Autoplay:** Audio player must be click-to-activate; autoplaying is strictly prohibited.
- **Responsiveness:** Floating player and PDF canvas must fit all devices. On mobile, the audio widget must collapse into a compact bottom-pinned bar.
- **Validation:** All changes must compile with `npm run build` and pass typechecking with `npm run typecheck` and linting with `npm run lint:fix`.

---

### Task 1: Clean Up Red Crimson Theme and Re-Style to Bluefin Blue

**Files:**
- Modify: `src/WolvesApp.vue`

**Interfaces:**
- Consumes: Global CSS variables `--color-blue` and `--color-blue-light`.

- [ ] **Step 1: Replace all red/crimson accents with Bluefin Blue**
  Update `src/WolvesApp.vue` styling and templates to replace any reference to `#ef4444` or red borders with `var(--color-blue)` / `#4285f4` or `var(--color-blue-light)` / `#8a97f7`.

- [ ] **Step 2: Commit the color changes**
  ```bash
  git add src/WolvesApp.vue
  git commit -m "style(wolves): Re-brand page from red accent to Bluefin Blue"
  ```

---

### Task 2: Implement Persistent Floating & Collapsible Soundtrack Widget

**Files:**
- Modify: `src/WolvesApp.vue`

- [ ] **Step 1: Refactor Soundtrack Widget HTML & SCSS**
  Update `src/WolvesApp.vue` to make the soundtrack widget floating.
  - **Desktop:** Floating widget on the bottom-right corner (`position: fixed; bottom: 24px; right: 24px; width: 320px;`).
  - **Mobile:** Bottom-pinned, full-width horizontal bar (`position: fixed; bottom: 0; left: 0; right: 0; width: 100%;`).
  - **Z-Index:** High z-index (999) to overlay all content except the navbar.
  - **Styles:** Use a subtle background blur (`backdrop-filter: blur(12px)`) and a thin blue border (`border: 1px solid rgba(66, 133, 244, 0.3)`).

- [ ] **Step 2: Implement Toggle and Dismiss Persistence**
  Add state and functions to show or hide the floating player when dismissed by the user.

- [ ] **Step 3: Commit the player changes**
  ```bash
  git add src/WolvesApp.vue
  git commit -m "feat(wolves): Implement floating viewport soundtrack widget"
  ```

---

### Task 3: Build Dynamic Canvas-Based PDF Comic Reader (PDF.js CDN)

**Files:**
- Modify: `src/WolvesApp.vue`

- [ ] **Step 1: Dynamically Inject PDF.js Library**
  Add logic in `onMounted` to inject the PDF.js main script and worker script from CDNJS:
  - Script CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js`
  - Worker CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

- [ ] **Step 2: Implement PDF Loading & Page On-Demand Render**
  - Fetch PDF from: `https://download.projectbluefin.io/color-with-bluefin.pdf`.
  - Fetch the requested page and render it onto an HTML5 `<canvas>` using `page.render()`.

- [ ] **Step 3: Implement Auto-Scaling Page Fit**
  Add a `ResizeObserver` on the canvas container element that recalculates the page scale based on viewport client width, keeping the aspect ratio perfect and scaling dynamically on resize.

- [ ] **Step 4: Implement Page Turning, Selector Dropdown, and Layout Toggles**
  - Add Next/Prev page flip actions.
  - Listen to keyboard arrow keydown (`Left`/`Right`) to turn pages.
  - Build jump dropdown select element.
  - Build toggle to switch between "Page By Page" (canvas) and "Continuous Scroll" (stacked canvas-pages or responsive stacked placeholders).

- [ ] **Step 5: Commit the PDF reader changes**
  ```bash
  git add src/WolvesApp.vue
  git commit -m "feat(wolves): Build responsive canvas-based PDF.js reader"
  ```

---

### Task 4: Revise Quotes to Single-Quote Automatic Cycling Dispatch

**Files:**
- Modify: `src/WolvesApp.vue`

- [ ] **Step 1: Read Quotes from bazzite-quotes.json**
  Update quotes selection to render only one dispatch card in the center.

- [ ] **Step 2: Set Up Quote Cycling Interval**
  Add a `setInterval` timer in `onMounted` that increments the active quote index every **9 seconds**. Ensure the timer is properly cleared in `onBeforeUnmount` to prevent memory leaks.

- [ ] **Step 3: Add CSS Opacity Fade Transition**
  Write an elegant transition class to fade quotes in and out smoothly.

- [ ] **Step 4: Credit to "John Bazzite"**
  Ensure attribution is strictly set to `John Bazzite` and the subtext is `Bluefin Discord Teaser Dispatch`.

- [ ] **Step 5: Commit the quotes revisions**
  ```bash
  git add src/WolvesApp.vue
  git commit -m "feat(wolves): Change dispatch quotes to single-quote automatic cycle"
  ```

---

### Task 5: Build Verification and Typecheck

- [ ] **Step 1: Validate TypeScript Compilation**
  Run: `npm run typecheck`
  Expected: Command exits with status 0.

- [ ] **Step 2: Validate ESLint and Code Formatting**
  Run: `npm run lint:fix`
  Expected: Command exits with status 0.

- [ ] **Step 3: Compile Production Build**
  Run: `npm run build`
  Expected: Build succeeds and outputs into `dist/`.
