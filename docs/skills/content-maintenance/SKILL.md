---
name: content-maintenance
description: Use when editing production text, links, translations, data, or approved assets without changing design.
metadata:
  context7-sources:
    - /websites/vuejs
---

# Content maintenance

## Overview

Maintain shipped content through existing data, locale, and asset surfaces.

## When to Use

Use for page copy, translations, URLs, approved images, downloads, and data.

## When NOT to Use

Do not use for layout, components, styles, typography, animation, navigation
prominence, or Wolves runtime engineering.

## Core Process

1. Read `../../reference/content-map.md`.
2. Identify the production entry and source file.
3. Preserve keys, placeholders, URLs, asset paths, and existing structure.
4. Edit content only.
5. Run the smallest relevant validation.

Use `import.meta.env.BASE_URL` for public runtime asset paths. Never hand-edit a
generated file.

### Adding a new locale

Adding a locale is a content change to `src/locales/<tag>.json`, but it has one
non-obvious test coupling. `src/tests/useLocale.test.ts` asserts an exact list
(`SUPPORTED_LOCALES`) of the locales `i18n.global.messages` contains, and the
locales are bundled eagerly via `import.meta.glob('./*.json')`. Dropping a new
`<tag>.json` into the directory therefore adds a key to that map and makes the
exact-match assertion fail unless the same tag is added to `SUPPORTED_LOCALES`
(alphabetically sorted — note ASCII order puts `zh-HK` before `zh-Hans` before
`zh-TW`). The `locale-completeness.test.ts` file then validates the new file:
it passes on missing keys (partial translation is legal, vue-i18n falls back to
`en-US`) but hard-fails on any key absent from `en-US.json`, so a new locale may
declare no orphan keys. Verify with `npx vitest run src/tests/locale-completeness.test.ts src/tests/useLocale.test.ts`, then `npm run typecheck` and `npm run build`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The copy does not fit, so the component needs a small tweak." | Content work never changes design. Get approval, or change the copy. |
| "It is faster to patch the generated file." | Generated output is overwritten on the next run. Fix the generator or its source data. |

## Red Flags

- A content diff changes a component or stylesheet.
- A new key is added to make copy fit.
- An unlisted page is added to navigation or metadata.
- Generated output is patched instead of regenerated.

## Locale completeness

`src/locales/en-US.json` is the message schema; `src/locales/schema.ts` derives
`MessageSchema` from it. `src/tests/locale-completeness.test.ts` treats the two
directions differently, and the difference matters when a translation issue
reports a count:

- **Missing keys are advisory.** vue-i18n falls back to `en-US`, so a partial
  translation is a legitimate state. Closing a translation issue means
  translating the values, not adding the keys as English placeholders.
- **Orphaned keys are a hard failure.** A key a locale declares but `en-US`
  lacks can never render.

Values that are proper names, brand names, URLs, and Vue interpolation tokens
stay in the source form even in a complete translation: author attributions
(`EvolutionQuote.Author`), `WikiLink` URLs, `Video.Url`, `TryBluefin.Title`, and
card product names such as `TryBluefin.Wolves.Cards.Dakota`. Translate the copy
around them (`AlphaBadgeSub`, `ServerDescription`), not the names.

## Locale HTML rendering

Locale strings may contain markdown and a small set of raw HTML tags (`<br>`,
`<b>`, `<strong>`, `<a href target>`), and components render them with
`v-html`. Every locale string bound to `v-html` must go through
`src/utils/markdown.ts` (`renderMarkdown`, `renderMarkdownInline`, or
`sanitizeHtml`) — never a bare `marked.parse()` or a raw `t()` value. The
helper sanitizes with `sanitize-html`, which parses via htmlparser2 and
therefore behaves identically in the browser bundle and in the happy-dom test
environment. Do not switch it to DOMPurify: under happy-dom, DOMPurify reports
`isSupported === true` but returns markup unsanitized and drops leading text
nodes, so component tests both miss real injection and fail on correct output.

## Traditional Chinese locales

`zh-TW` and `zh-HK` are Traditional Chinese and must not carry
Simplified-only characters. A locale can pass key-parity and placeholder
checks while still containing one: a Simplified character renders as a
mismatched glyph, not a missing key. The same text often exists in both
locales, so compare them (`git show main:src/locales/zh-HK.json`) and check
the Traditional file against a converter rather than trusting a copy.

OpenCC's `s2t` conversion flags Simplified characters (for example `锁` in
`Devs.CNJourney` became `鎖`). It also rewrites acceptable orthographic
variants — `了`→`瞭` and `群`→`羣` — which are valid Traditional and must not
be "corrected". Review each reported character against its context; only
Simplified-only forms are defects.

## Front-page downloads

The main-site download cards are owned by
`src/components/sections/SectionPicker.vue`; their user-facing copy belongs in
`src/locales/en-US.json`. Classic and LTS form the `classic-download-grid`
under Try Bluefin. Dakota, Bluefin Server, and Utah are grouped under the
`NextGeneration` heading and description in a separate named section. The
retired Fedora image chooser has no testing entry or runtime component.
Adding another card changes the rendered component surface and therefore
needs an explicitly approved design request; do not treat it as a locale-only
edit.

Re-derive the owner and locale source with:

```bash
rg -n "TryBluefin.Wolves.Cards|NextGeneration|classic-download-grid|wolves-download-grid" \
  src/components/sections/SectionPicker.vue src/locales/en-US.json
```

The Classic card links to `https://docs.projectbluefin.io/downloads/`, which
keeps all hardware variants available without reviving the retired chooser.
Its package rows come from `public/stream-versions.yml` only when
`stable.status` is `verified`; the card remains usable if metadata is absent.
LTS stays Coming Soon with no download link or package rows, even if an LTS
feed later becomes available, until the owner authorizes its release. Utah
links to `https://github.com/projectbluefin/utah` until a dedicated route exists.

Reuse `src/components/common/ProductVersionCard.vue` — the extracted "raptor
card" — for any new product/download card. Do not author parallel markup or
styles for the same data; the labels and card chrome must not drift between
`/`, `/dakota/`, and `/server/`.

Use the optional `wordmark` asset prop for a branded card title; its image alt
text preserves the product name. Keep the existing backdrop and card chrome.
The homepage is dark, so use the matching white-letter wordmark rather than
selecting a black-letter variant from the OS setting. Resolve `BASE_URL` in
the script and expose a `baseUrl` binding to the template: `import.meta` is
not supported directly inside Vue template expressions.

A card's title and description must be classed `<span>`s, not `<p>`. The global
`#scene-picker p` rule sets `text-align: center` and `max-width: 800px`, and its
id specificity beats any scoped component class, so a bare `<p>` silently
ignores the component's own alignment.

### Product status badges

`ProductVersionCard.vue` renders each card's status from `badgeTitle` and the
optional `badgeSub`. Dakota and Bluefin Server use the locale-backed Alpha
warning (`TryBluefin.Wolves.Cards.AlphaBadge` / `AlphaBadgeSub`); LTS and Utah
use the title-only `TryBluefin.Wolves.Cards.ComingSoonBadge`. Keep those
statuses explicit per card rather than applying one status to the entire array.

## Adding a new locale

`src/locales/schema.ts` bundles locales with `import.meta.glob('./*.json', { eager: true })`,
so dropping the JSON file in is enough at runtime — there is no registry to
edit. Two non-obvious consequences:

- `src/tests/useLocale.test.ts` hardcodes the expected bundle in
  `SUPPORTED_LOCALES` and asserts exact equality on
  `Object.keys(i18n.global.messages).sort()`. A new locale file fails that
  test until the tag is added to the list, kept in sort order.

Verify a new locale's strings actually resolve through vue-i18n (not just that
the JSON parses) with a throwaway probe that calls
`i18n.global.t('Some.Key', {}, { locale: '<tag>' })` — passing the locale as
the third argument is required, since the global instance defaults to `en-US`.

Translation issues quote a key count (for example "5/106 keys") that can be
stale, including for a locale file that no longer exists. Check
`ls src/locales/` before trusting it: an absent file makes the task a
new-locale addition, so the `SUPPORTED_LOCALES` edit above is required.

The filename tag is matched exactly. `App.vue`, `DakotaApp.vue`, and
`ServerApp.vue` select a locale only when `?lang=` or `navigator.language`
equals an available tag, with no language-subtag fallback: a region file
(`sk-SK`) is not picked for a bare `sk` browser, and a multi-bundle base
(`zh`) is not routed to any of its siblings. Keep the tag the issue names;
changing the matching is a runtime change, not locale content.

The one carve-out from "no fallback" lives in `src/composables/useLocale.ts`
as the `LOCALE_ALIASES` map and the `resolveLocale()` function. Aliases are
allowed only when the alias target is the *only* bundle that fits the source
region — the current single-bundle entries (`cs-CZ` → `cs` for issue #928,
`uk-UA` → `uk` for issue #905) and the Simplified-Chinese entries
(`zh-CN` → `zh-Hans`, `zh-SG` → `zh-Hans`, `zh-MY` → `zh-Hans`, plus the
script-qualified `zh-Hans-CN`, `zh-Hans-SG`, `zh-Hans-MY` for issue #907) close the
gap where a browser reporting a regional tag would otherwise fall to
`en-US`. `cs-CZ` → `cs` closes #928: a Czech browser reporting the regional
tag previously fell to the default even though `?lang=cs` works, and `cs`
is the only Czech bundle. `uk-UA` → `uk` closes #905 for the same reason:
`uk` is the only Ukrainian bundle, so the alias is unambiguous. Bare `zh`
is intentionally not aliased, because three bundles share that base
(`zh-HK`, `zh-Hans`, `zh-TW`) and picking one arbitrarily would render the
wrong script for a real user. Single-bundle languages without a region subtag
(`eo` — browsers send the bare tag because Esperanto has no associated
region) exact-match through the first `resolveLocale` branch and need no
alias entry. To add an alias, append the region tag to `LOCALE_ALIASES` and
add a `resolveLocale` test in `src/tests/useLocale.test.ts` that asserts
the alias resolves to the right bundle and that bare/region tags not on the
alias map still fall to the default.

## Locale completeness

`src/tests/locale-completeness.test.ts` warns on keys a locale is missing and
hard-fails on keys a locale declares that `en-US.json` does not define. Both
states are invisible in review, so measure them instead of eyeballing the file:

```bash
npx vitest run src/tests/locale-completeness.test.ts --reporter=verbose
```

Three defects to check by hand for the locale you own:

- **Missing keys** — a key absent from the locale silently falls back to English.
- **Orphaned keys** — a key the source locale no longer defines is dead weight;
  remove it, never keep it "just in case".
- **Untranslated values** — a value byte-identical to `en-US.json` is usually an
  untranslated string (brand names, URLs, and product names such as `Dakota`,
  `Utah`, and `Bluefin Server` are legitimate exceptions).

An empty string in `en-US.json` (`TryBluefin.Wolves.Cards.UtahDescription`) is a
deliberate empty value, not a missing string: mirror it as `""` rather than
inventing copy, so the key structure stays aligned with the source.

Note that a red `locale-completeness` run on another locale is a pre-existing
failure, not a regression from your change; check your own file's two cases
individually before reporting.
## Completing a locale file

`src/tests/locale-completeness.test.ts` is asymmetric on purpose: **missing**
keys only warn (vue-i18n falls back to `en-US.json`), while **orphaned** keys —
a key the locale declares that `en-US.json` does not — are a hard failure. A
completion pass must therefore add the missing keys *and* delete the orphans.

Other rules a completion pass has to honour:

- `en-US.json` is authoritative for key order as well as key set. Write the
  translated object in the same order so future diffs stay readable.
- Parity-check mechanically before committing: flattened key count, orphan list,
  key order, `{token}` sets, HTML tag sets, and the URL set per value. The only
  intentional URL divergence is a localized `*.wikipedia.org` wiki link.
- Adding a key is not the same as resyncing it. Locales drift: a translated
  value can be a faithful rendering of a *stale* source string (an old
  statistic, a superseded URL, a sentence the source has since dropped). Re-read
  the current `en-US.json` value and translate that, not the historical one.
- An empty source value (`TryBluefin.Wolves.Cards.UtahDescription`) stays empty
  in the translation. Do not invent copy the source does not carry.

`locale-completeness.test.ts` covers every locale in the directory, so it can
fail on files you did not touch. Those are other agents' or other issues' scope;
say so rather than widening the diff.

```bash
npx vitest run src/tests/locale-completeness.test.ts
```

## Verification

- [ ] Diff contains only content, data, or approved assets.
- [ ] Existing keys and placeholders remain intact.
- [ ] Unlisted status is unchanged.
- [ ] Relevant checks pass.

Re-derive the exact-match locale selection (no language-subtag fallback):

```bash
rg -n "navigator.language|availableLocales.includes|resolveLocale" \
  src/App.vue src/DakotaApp.vue src/ServerApp.vue src/composables/useLocale.ts
```

## Locale parity for a new or completed translation

Adding `src/locales/<tag>.json` is not the whole change. Locales are bundled
eagerly by the glob in `src/locales/schema.ts`, so a new file is picked up
automatically — but `src/tests/useLocale.test.ts` asserts the exact set of
bundled locale tags and will fail until the new tag is added to
`SUPPORTED_LOCALES`.

Per-value invariants to check against `en-US.json` before committing:

- Flat key set is identical, with no orphans (`locale-completeness.test.ts`
  fails hard on orphans; missing keys are advisory only, because vue-i18n falls
  back to `en-US`).
- URL list, HTML tag list, `{placeholder}` list, and Markdown-link count in each
  value are unchanged. Translate the link *text*, never the target.
- Proper nouns and brand names stay in their original spelling
  (`Flathub`, `Kubernetes`, `Podman Desktop`, `JetBrains IDEs`, `Dakota`,
  `Utah`, `Commander Zavala`).
- Where the source value is an empty string (for example
  `TryBluefin.Wolves.Cards.UtahDescription`), the translation stays empty.

A quick throwaway script that flattens both files and diffs those four lists
catches nearly every copy-paste slip before the test run. Re-derive the source of
truth rather than trusting an existing locale file: some carry values that have
drifted from current `en-US.json` copy.

## References

- `../../reference/content-map.md`
- `../../reference/production-entrypoints.md`
- `../design-gate/SKILL.md`

## Image version pipeline

### Registry ownership

The image version registry lives in `scripts/lib/image-sbom-registry.js`
(`scripts/lib/image-version-audit.js` is the orchestrator that consumes it).
Each entry declares an OCI image reference, required and optional SPDX package
names, and the `product` it belongs to (`bluefin` or `dakota`). To add a field:

1. Add a `packages` entry to the relevant record in the registry.
2. Mark it `required: true` if its absence should remove the product from display.
3. If the package name resolves to more than one version, add an `element`
   (BuildStream) or `type`/`foundBy` (Syft) selector and pin the fixture
   evidence in `scripts/tests/image-sbom-registry.test.ts`.
4. Run `npm run update:image-versions` to regenerate outputs.

BuildStream SBOMs can contain the same package name in several elements.
Name-only lookup is ambiguous when accepted versions differ and must publish
nothing. Add an `element` selector instead of choosing the highest version.

### SBOM sources

| Product | Registry | Image / Tag |
|---|---|---|
| Bluefin stable | `ghcr.io/ublue-os/bluefin` | Cosign-verified, SPDX referrer (`:stable`) |
| Bluefin stable NVIDIA | `ghcr.io/ublue-os/bluefin-nvidia-open` | Cosign-verified, SPDX referrer (`:stable`) |
| Dakota | `ghcr.io/projectbluefin/dakota` | Cosign-verified, SPDX referrer (`:stable`, kernel element `core/linux-fdsdk.bst`) |
| Dakota NVIDIA | `ghcr.io/projectbluefin/dakota-nvidia` | Cosign-verified, SPDX referrer (`:stable`) |

### Fail-closed behavior

If an image's SPDX referrer is missing or cosign verification fails, the image
is recorded as `status: "unavailable"` in the audit. Unavailable evidence
removes the corresponding website claims — no version is displayed for that
product variant. The pipeline never falls back to documentation, source trees,
or cached values.

An image whose required fields all resolved but whose *optional* fields did not
is `status: "degraded"`: its verified values are still published, the
unresolved fields are omitted, and an issue is opened. Ambiguity counts as
failure at both levels — a required ambiguous field makes the image
unavailable, an optional one degrades it.

A record with `pendingSbom: true` or an empty `packages` map stays
`unavailable` with `errorCode: "pending-mapping"` even after the image starts
publishing an SBOM. Publication is not a mapping; someone has to review which
package names map to which website fields.

`public/dakota-versions.json` keeps `packages.baseline` as static hardware
metadata, preserved by `update:image-versions`. ISO downloads are not in that
file: deploys restore it from the live-data cache, which would ship a stale
filename. When a new Dakota Alpha ISO is released, update `DAKOTA_ISOS` in
`src/data/dakota-isos.ts` to point to the new ISO filename. If gaming-image evidence is unavailable, do not
infer OGC Kernel from the NVIDIA driver or a source tree.

Bluefin Server has no version updater or generated version file. Until it
publishes verifiable image SBOM evidence, render no version rows and retain
only its release destination plus the explicit unavailable status. Never
substitute Flatcar or another product's data.

### Commands

```bash
npm run check:image-sboms       # Manual, read-only live verification (exits nonzero on missing evidence)
npm run update:image-versions   # Regenerate public/*-versions.json and stream-versions.yml
```

The scheduled live smoke test is the daily `Update Live Data` workflow
(`.github/workflows/update-content.yml`), which runs `update:image-versions`
against the live registry every day at 10:00 UTC and files deduplicated issues.
`check:image-sboms` is the manual, read-only form of the same verification: it
writes no file and triggers no deployment, so run it locally before changing
the registry.

### Rule

**Unavailable image evidence removes website claims.** A product whose SBOM
cannot be verified does not display version data. This is intentional — showing
unverifiable versions is worse than showing nothing.

## Social preview cards

The website's primary Open Graph and Twitter preview card (`public/meta.webp`)
is dynamically generated from the official Bluefin desktop wallpaper pool
during site builds (`npm run build`).

- **Generator tooling**: `scripts/generate-social-cards.js` and
  `scripts/social-cards/template.html`.
- **Allowed wallpaper pool (36 items)**:
  - 24 first-party Bluefin monthly rotation wallpapers (January through December,
    Day and Night pairs).
  - 12 Bluefin Wolves story illustrations (`wolves/wolves/bluefin-*`).
- **Aurora & Xe exclusion**: Aurora artwork and Xe assets are strictly
  excluded from the social card pool.
- **Card layout**: Wallpaper signature layout featuring a crisp, bold Bluefin
  wordmark in the lower corner with tight multi-layered letter drop-shadows (no
  muddy background scrim), preserving full artwork vibrancy.
- **CI fast-path**: `npm run build` copies from pre-rendered cards in
  `public/cards/`, running in milliseconds without requiring Playwright browser
  binaries in CI environments.
- **Card geometry**: Rendered via Playwright at 1200×630 viewport with
  `deviceScaleFactor: 2`, producing a crisp 2400×1260 WebP image (standard
  1.91:1 Open Graph aspect ratio) encoded via `cwebp`.
- **Rotation**:
  - Monthly rotation (default): matches current calendar month and always
    selects the **Day** wallpaper variant to consistently pair with the
    documentation site's matching-month **Night** wallpaper variant. Never gate
    the monthly website card variant on build-time UTC hour.
  - Daily rotation (`--mode daily`): rotates deterministically by day-of-year across
    all 36 wallpapers.
- **Commands**:
  ```bash
  npm run generate:social-cards               # Monthly rotating wallpaper to public/meta.webp
  node scripts/generate-social-cards.js --mode daily   # Daily rotating across full pool
  node scripts/generate-social-cards.js --list  # Print all 36 allowed wallpapers in the pool
  node scripts/generate-social-cards.js --all   # Pre-render all 36 cards into public/cards/
  ```

## Sources

- ORAS referrer discovery and JSON output: `/oras-project/oras`
- Cosign verification and Sigstore transparency: `/sigstore/docs`
- Supply-chain scorecard context: `/ossf/scorecard`
- Vue script-setup template bindings: https://vuejs.org/api/sfc-script-setup
