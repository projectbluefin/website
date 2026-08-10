---
name: validation
description: Use when checking changes, staging files, pushing commits, or deciding whether production is live.
---

# Validation

## Overview

Choose checks that prove the changed behavior without claiming more than they
prove.

## When to Use

Use before completion reports, commits, pushes, deployment checks, or live-status
claims.

## When NOT to Use

Do not run the full application suite for documentation-only changes.

## Core Process

1. Match checks to changed paths.
2. Run `git diff --check`.
3. Inspect `git status --short` and the diff; classify unrelated dirty files
   before staging.
4. For deletions, search manifest, import, timeline, and generated-data
   references before committing.
5. Stage explicit paths only.
6. For a push, verify the exact commit's deployment workflow and smoke-test the
   affected route in Chromium for page errors.

Documentation-only check:

```bash
git diff --check
```

Application content or data checks:

```bash
npm run typecheck
npm run test:gate
npm run build
```

Full code checks:

```bash
npm run lint:fix
npm run typecheck
npm run test:gate
npm run build
```

## The baseline gate

`npm run test:run` is the pass/fail signal again: as of 2026-08-09 the vitest
suite is fully green and `tests/known-failures.txt` is empty (issue #705). The
suite was red for weeks before that (35 failing on 2026-07-29, 23 on 2026-08-09
morning), and agents learned to ignore the bare run — which is how real
regressions shipped unnoticed. If the baseline grows again, the current count
is `tests/known-failures.txt`'s line count, not any prose figure; re-derive it
instead of trusting documentation.

Keep the gate as the guard:

```bash
npm run test:gate
```

It runs the suite, compares the failing set against `tests/known-failures.txt`,
and exits non-zero **only for failures you introduced**. It also lists baseline
failures that now pass, so the baseline shrinks as the suite is repaired.

**CI does not use the gate.** The `test` job in `.github/workflows/ci.yml` runs
`npm run test:run -- --coverage` directly, so `tests/known-failures.txt` was
never applied in CI: every baseline failure failed every PR, which is why a red
`main` hid in plain sight while the local gate stayed green (found 2026-08-09,
issue #705). Until the workflow is changed, a nonzero baseline means red CI no
matter what the gate says — treat any `test:gate:update` re-record as a CI
break. The same CI command also enforces the v8 coverage thresholds in
`vite.config.ts` — ratcheted 2026-08-09 from a flat 50% to just below measured
coverage, plus a `src/components/**` glob backstop (issues #674/#676) — so
verify with the exact CI invocation when touching test infrastructure:

```bash
npm run test:run -- --coverage
```

**What CI actually enforces.** The `test` job runs, in order: `check:docs`,
`lint`, `typecheck`, `test:run -- --coverage`, and `build`. The `lint`,
`typecheck`, and `build` steps were added 2026-08-09 — before that CI ran only
`check:docs` and the suite, so a type error or a broken production build could
merge with a green tick. Run the full local list above before pushing; a green
`test:gate` alone no longer predicts a green CI.

Re-record only when you have deliberately changed the failure set, and say so in
the commit message:

```bash
npm run test:gate:update
```

Never re-record to silence a failure you caused. Never delete an entry by hand
to hide a still-failing test.
A shrinking `tests/known-failures.txt` is good; a growing one needs a reason.

### Coverage measurement and thresholds

Vitest 4 with the v8 provider has three traps this repo's config now guards
against (learned 2026-08-09, issues #673–#676):

- **Untested files are invisible by default.** Only files imported by tests are
  counted; a component with zero tests does not appear in the report at all, so
  "All files" ran ~3 points high while 24 components sat outside it.
  `coverage.include: ['src/**']` in `vite.config.ts` forces every source file
  into the report at its true 0%.
- **Glob thresholds check the aggregate of matched files.**
  `thresholds['src/components/**']` is the backstop that stops new untested
  components from regressing the group. Verify semantics before trusting a new
  threshold: set it impossibly high, expect
  `ERROR: Coverage for statements (X%) does not meet ...`, then set the real
  value.
- **Ratchet below measured, never at aspirational targets.** Global thresholds
  sit ~3pt under the *lowest* measured figure, and the components glob gets a
  wider margin because one added component moves an aggregate more than the
  global figure. Thresholds above measured fail CI on day one; thresholds far
  below allow silent regression.
- **v8 coverage is Node-version sensitive — floor thresholds against the
  lowest supported version, not against CI.** The same commit measures
  77.8/67.3/79.5/77.6 on Node 24 (what CI pins) but 73.6/65.1/77.6/73.2 on
  Node 22 — a ~4pt spread with an identical test set. Thresholds derived from
  a CI run alone therefore pass CI while failing every contributor on an older
  Node, which reads as "the suite is broken on main" (hit 2026-08-09, right
  after #712 set them ~1pt under the Node 24 figures). Measure on your local
  Node *and* read the CI log before choosing numbers.

Run coverage the way CI does — `CI=true npm run test:run -- --coverage`.
`src/tests/wolvesBackCatalogue.test.ts` carries a live-network audit gated on
`skipIf(process.env.CI)`, and `wolvesComicReader` timing tests are slow on a
loaded box; a bare local `vitest run` can show failures CI never sees.

### Baseline entry format and shrinking it deliberately

Each baseline line is `<test file path> :: <full concatenated describe + test
name>`, one test per line, sorted (see `scripts/test-baseline.mjs`). When you
repair a stale test (the test was wrong, the code was right), the correct
shrink is: fix the test, delete exactly its line from
`tests/known-failures.txt` in the same change, and prove it with
`npm run test:gate` — the gate must report `no new failures (N known,
baseline N)` with the count reduced. Prefer deriving repaired expectations
from the owning source data (e.g. import `buildIntroVideoSequence` /
`INTRO_SEQUENCE_DURATION`) over fresh hardcoded literals, so authored-timing
changes don't re-stale the test. Issue #705 drained the baseline to zero; keep
it there.

When triaging a baseline failure, read the git history of both the test and the
code under test before choosing a side: an authored commit that deliberately
changed the behavior (its message usually says so) means the *test* is stale.
On `/wolves/` the design gate makes that the strong default — correct the test
to match the shipped show; escalate instead of editing show behavior.

## Red Flags

- Completion is based only on a local build.
- A different commit's deployment is cited.
- Unrelated generated changes are staged.
- A deletion is committed while a manifest still references the missing file.
- Only a build is checked for a route that eagerly loads runtime data.
- `git add .` or `git add -A` is used.
- More than one dev server is listening, or a `vite preview` is up during source
  work.
- A change is called missing from the browser before the serving process and its
  port were identified.
- `npm run test:run` output is used to decide whether a change is safe.
- `tests/known-failures.txt` is re-recorded in the same commit as the change that
  added the failures.
- Something is deleted as "dead code" without checking the non-Wolves
  experiences that share `WolvesComicReader.vue`.

## Verification

After pushing, verify the exact commit:

```bash
sha=$(git rev-parse HEAD)
gh run list --repo projectbluefin/website \
  --workflow "Deploy to GitHub Pages" --commit "$sha" --limit 1 \
  --json databaseId,headSha,status,conclusion,url
```

Production is complete only when the run has the same SHA, status `completed`,
and conclusion `success`. For multi-entry builds, also smoke-test every path
listed in `../../reference/production-entrypoints.md`; adding an HTML entry alone
is insufficient unless the Vite Rollup input and directory redirect include it.
For runtime manifests, the browser smoke must assert both a non-empty rendered
body and zero `pageerror` events.

## Local dev server hygiene

"I don't see my change in the browser" is usually a server problem, not a code
problem. Before debugging application code, prove which process answers the port.

```bash
ss -ltnp | grep -E '5173|4173|4174|5174'
ps -eo pid,lstart,args | grep vite | grep -v grep
```

Rules:

- Run exactly one dev server. Every extra `vite` or `vite preview` started by a
  previous session is a separate app on its own port, and a stale tab can sit on
  any of them for hours.
- `vite preview` serves a frozen `dist/`. It never hot-reloads and never picks up
  source edits. Never leave one running while doing source work, and delete the
  stale `dist/` so nothing can serve it again.
- Bare `vite` binds `[::1]` only; `vite --host 127.0.0.1` binds IPv4 only. When
  both exist, `localhost` reaches different apps depending on resolution order.
  Start with `--host :: --port 5173 --strictPort` so one server answers both
  stacks on a predictable port, and `--strictPort` fails loudly instead of
  silently drifting to 5174.
- Kill stale servers by explicit numeric PID, one `kill <PID>` per command.

Prove the server is live rather than assuming it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/wolves/
curl -s http://localhost:5173/src/path/to/Edited.vue | grep -c 'marker-from-your-edit'
```

Then prove HMR actually pushes. Load the page in Chromium, collect console
output, write a real edit to a source file, restore it, and require both
`[vite] connected` and a `[vite] hot updated:` line naming that file. A page that
loads is not evidence that it refreshes.

Also confirm no service worker is registered; a cached worker produces the same
"nothing updates" symptom and this repo intentionally registers none.

## References

- `../../reference/production-entrypoints.md`
- `../../architecture/runtime-data-flow.md`

## Wolves timing validation

For lore timing work, run typecheck, focused lore/timing/timeline tests, build, diff check, and a Chromium smoke of /wolves/. Report focused results separately from full-suite baseline failures. Assert a non-empty rendered body, zero page errors, no failed module requests, preserved locked anchors, contiguous unlocked slots, and readable representative short/long records.

## A green `test:gate` proves nothing about the Wolves show

`npm run test:gate` does **not** run `tests/wolves-movie-flow.mjs`. That harness is
a separate CI job (`wolves-movie-flow` in `.github/workflows/ci.yml`) which boots a
dev server and drives the real route. So the gate can be green, typecheck and lint
clean, the build succeed, and every production route render with zero `pageerror`
— while the show itself is broken.

That is not hypothetical. A change that was validated exactly that way shipped two
runtime defects: Part II opened on Part I's photo because the decode gate blocked
on a cold remote fetch, and the transport read "Play" during the intro because the
active buffer's prewarm park published `PAUSED` to the store. The harness caught
both immediately and deterministically. A route-renders smoke test caught neither,
because both defects render a perfectly valid-looking page.

**For any change to the Wolves runtime — player, store, transitions, slideshow,
intro overlay — run the harness before claiming the work is done:**

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort &
WOLVES_BROWSER_FIXTURES=1 node tests/wolves-movie-flow.mjs
```

Read the **`Results:` line, not the tail of the output.** Assertions run in show
order, so an early failure scrolls off the top; piping through `tail` hid a real
failure and made a 3-failure run look like 2. Compare the pass count against the
pre-change commit rather than against an absolute number — the count moves as
assertions are added. `git worktree add` a detached checkout of the base commit,
symlink `node_modules`, serve it on another port, and run the same harness against
`WOLVES_BASE_URL` to get an honest baseline.

Two failure modes to recognise before blaming your change:

- **Not every failure is flake.** The transport auto-hides after 3 s without
  pointer input, so `Visible Pause control` is the documented flaky assertion — but
  a *deterministic* 3-of-3 failure is a real defect, not flake. Re-run before
  concluding either way.
- **Your own instrumentation perturbs it.** Adding `waitForTimeout` to a probe copy
  will trip that same auto-hide assertion. Probe with a copy outside the repo, and
  re-confirm against the unmodified harness.

### The movie-flow harness is not the whole show either

It drives the cinematic, so it cannot see two things that have both shipped broken.
For any transport, buffer, or player change, also run:

```bash
node tests/wolves-buffer-parking.mjs     # no buffer running away underneath the show
node tests/wolves-ghosts-boundary.mjs    # the on-air buffer really holds the segment named on screen
node tests/wolves-intro-silence.mjs      # the cinematic stays silent under the intro
```

`wolves-intro-silence.mjs` exists because of a defect this skill's own checklist
missed: the cinematic buffers are prewarmed *during* the intro, a boundary ran in
that window, and a track played over the whole opening. Gate, typecheck, lint,
build, movie-flow, and a route smoke test were all green. **Validate the intro
window separately from the cinematic** — "the show is fine" is a claim about two
different phases.

The general lesson: if a change adds a way for the runtime to *start audio* or
*put something on air*, ask what stops that path running before the show has
started. Then check that phase, not just the one you were working in.

### These harnesses need real playback, and CI Chromium has none

Playwright's bundled Chromium ships without proprietary codecs, so YouTube answers
with error 150 and no media attaches. `wolves-ghosts-boundary.mjs` and
`wolves-intro-silence.mjs` are written to tolerate that — an *empty* buffer passes,
only a *wrong* or *audible* one fails — so they are still worth running locally, but
a clean run in that environment is weaker evidence than it looks. Neither is wired
into `.github/workflows/ci.yml`; only `wolves-movie-flow` is. Do not read a local
pass as proof that real audio is correct, and say so when reporting.

Two intro harnesses, `tests/wolves-intro-segments.mjs` and
`tests/wolves-intro-destiny-toggle.mjs`, **fail on `main`** in that environment.
Baseline them with a worktree before treating either as a regression.

### Probing the comic reader without Chrome DevTools MCP

When the chrome-devtools MCP has no browser (no Chrome stable on the box), drive
the repo's own `playwright` package from a script in `/var/tmp/website-agent/`
instead — do not install a browser. The working pattern (learned 2026-10):

- Copy the `window.YT.Player` mock `addInitScript` from
  `tests/wolves-movie-flow.mjs` (auto-advancing `getCurrentTime` via
  `performance.now`) and pin `Math.random = () => 0`; the app gates playback on
  the YT player, so without the mock nothing advances.
- From the lobby: click the first `.wc-back-catalogue-card` for a back-catalogue
  album (where portrait art and `kind: 'hero'` slides live); for the authored
  show click JOIN, then `__wolvesDurations.skipIntro()`, then
  `__wolvesCinematic.seekTo(seconds)` to land on a specific slide.
- The active crossfade layer is the one with `zIndex === 2`; read slide state
  from that layer, not from DOM order.
- Authored-show slide windows live in `src/data/wolves-track-zero-slides.ts` —
  seek inside a named window rather than guessing timestamps.

Two facts that bite when asserting on rendered slides:

- **Key per-image measurements by `photo.id`, never by URL.**
  `handleImageError` in `WolvesComicReader.vue` rewrites failing Flickr srcs
  through a fallback chain (`_b` → `_z` → plain → local png), so the rendered
  `<img>` URL can diverge from the preloaded URL; URL-keyed maps silently miss
  exactly the slides that needed fallback.
- **Character art is square RGBA, not portrait.** Everything in
  `public/characters/` measures ~1:1 (0.94–1.62) with an alpha silhouette, so a
  `naturalHeight > naturalWidth` "portrait" rule never fires for the dinosaurs —
  any orientation treatment must be `kind: 'hero'`-aware (see
  `src/utils/slide-showcase.ts`).


## A cache path list is part of the cache key

`actions/cache` derives the cache *version* from the `path` list, not just from
`key`. A restore step whose path list differs from the save step's — in content
**or in order** — can never match, and `restore-keys` is version-scoped too, so
the fallback does not rescue it.

With `fail-on-cache-miss: false` the miss is silent. The build proceeds with
whatever is committed, and the producing job keeps reporting success while
delivering nothing.

Adding a single path to the save step in `update-content.yml` broke every
live-data feed exactly this way, including two that had nothing to do with the
change. Nothing in CI went red: the workflow that breaks is not the workflow
that runs on the pull request.

`website-live-data-` has one producer (`update-content.yml`) and two consumers
(`deploy.yml`, `preview.yml`). All three lists must stay byte-identical;
`scripts/tests/workflow-cache-parity.test.ts` enforces it.

When touching any cached path, enumerate every workflow that restores that key
before editing the one that saves it. Grep the key, not the filename.


## A red integration branch is not automatically your fault

Before debugging a CI failure on a branch that merges other people's work,
check whether `main` is green at the same code. `gh run list --branch main
--workflow CI --limit 3` answers it in one call.

An integration of a devcontainer and two test files failed
`wolves-movie-flow` on an assertion about a slide handoff at 48.4 seconds — in
code the branch did not touch. `main` was green at the identical runtime, and a
re-run with no change passed. It was a flake, not a regression.

The cause is worth knowing, because the harness has more assertions shaped like
this one: slide swaps are gated on the incoming image decoding, and `seekStage`
settles for a fixed 250 ms. Any assertion that seeks to a boundary and then
immediately reads the active layer is racing a decode. On a cold runner the
decode loses.

The fix is to wait for the state you expect and then assert, rather than
asserting on a timer — a genuine regression still fails, it just takes the
timeout to get there. When adding a boundary assertion to
`tests/wolves-movie-flow.mjs`, wait for the transition rather than trusting the
settle time.
