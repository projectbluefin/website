# Translation Guide

Thank you for translating the Project Bluefin website! This guide covers
everything you need to add or update a locale.

---

## Quick Start

1. Copy `src/locales/en-US.json` to a new file named after your locale
   (see [Locale file naming](#locale-file-naming) below).
2. Translate the string values — **never change the keys**.
3. Open a PR with your file. That's it — the locale is picked up automatically
   at build time.

---

## Locale File Naming

File names must follow the
[BCP 47](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language)
convention that browsers report via `Navigator.language`:

| Locale | File |
|--------|------|
| American English (reference) | `en-US.json` |
| German | `de-DE.json` |
| French | `fr-FR.json` |
| Japanese | `ja-JP.json` |
| Brazilian Portuguese | `pt-BR.json` |
| Korean | `ko-KR.json` |
| Russian | `ru-RU.json` |
| Vietnamese | `vi-VN.json` |
| Traditional Chinese (HK) | `zh-HK.json` |
| Traditional Chinese (TW) | `zh-TW.json` |
| Dutch | `nl-NL.json` |
| Slovak | `sk-SK.json` |
| Esperanto | `eo.json` |

---

## Field Type Reference

The locale JSON contains three kinds of values. Putting the wrong formatting in
the wrong field will either render as raw markup or break the page.

### Plain string

Render as-is — no markup processed. Use only plain text.

```json
"TopBar": { "Docs": "Documentation" }
```

### Markdown string

Rendered through a Markdown parser. You may use:
- `[link text](https://url)` — hyperlinks
- `**bold**` — bold text
- `_italic_` — italic text

Do **not** use raw HTML tags in Markdown fields.

### HTML string

Rendered via `v-html`. You may use inline HTML tags such as `<a>`, `<b>`,
`<strong>`, `<br>`, etc. Markdown syntax is **not** processed here.

---

## Field-by-Field Reference

The table below covers every key in `en-US.json`. The **Type** column tells you
which formatting rules apply.

> **Tip:** Fields not listed here are plain strings — when in doubt, treat a
> field as plain text.

### `TopBar`

| Key | Type | Notes |
|-----|------|-------|
| `Docs` | Plain | Navigation label |
| `AskBluefin` | Plain | Navigation label |
| `Blog` | Plain | Navigation label |
| `Changelog` | Plain | Navigation label |
| `Reports` | Plain | Navigation label |
| `Discussions` | Plain | Navigation label |
| `Feedback` | Plain | Navigation label |
| `Store` | Plain | Navigation label; may include parenthetical |

### `Landing`

| Key | Type | Notes |
|-----|------|-------|
| `Title` | Plain | Hero headline |
| `DiscoverButton` | Plain | Button label |
| `TryOutButton` | Plain | Button label |

### `Users`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | Small label above section title |
| `Title` | Plain | Section title |
| `Intro` | Plain | Introductory paragraph |
| `Box1` | Plain | Feature box label |
| `Box2` | Plain | Feature box label |
| `Box3` | Plain | Feature box label |
| `Features` | **Markdown** | Contains `[text](url)` links |
| `BluefinArtworkAlt` | Plain | `alt` text for artwork image |

### `EvolutionQuote`

| Key | Type | Notes |
|-----|------|-------|
| `Quote` | Plain | Pull quote text |
| `Author` | Plain | Attribution |
| `WikiLink` | Plain | Raw URL — do **not** add Markdown or HTML |

### `Devs`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | Small label above section title |
| `Title` | Plain | Section title |
| `Features` | **Markdown** | Contains `[text](url)` links and inline Markdown |
| `BoxOne`–`BoxSix` | Plain | Feature box labels |
| `RuntimeContainers` | **Markdown** | Contains `[text](url)` links |
| `CNJourney` | Plain | Paragraph; no markup |
| `KarlArtworkAlt` | Plain | `alt` text for artwork image |
| `TowerJoke` | **HTML** | Contains `<b>` tag — use HTML, not Markdown |

### `InitiativeQuote`

| Key | Type | Notes |
|-----|------|-------|
| `Quote` | Plain | Pull quote text |
| `Author` | Plain | Attribution |
| `WikiLink` | Plain | Raw URL |

### `Mission`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | Small label |
| `Title` | Plain | Section title |
| `Text.NewBreed` | Plain | Paragraph |
| `Text.Change` | Plain | Paragraph |
| `Text.CloudNative` | Plain | Paragraph |
| `Text.Sustainability` | Plain | Paragraph |
| `CleverGirl` | Plain | Caption |
| `BluefinChillAlt` | Plain | `alt` text |

### `SpreadQuote`

| Key | Type | Notes |
|-----|------|-------|
| `Quote` | Plain | Pull quote |
| `Author` | Plain | Attribution |
| `WikiLink` | Plain | Raw URL |

### `Video`

| Key | Type | Notes |
|-----|------|-------|
| `Url` | Plain | YouTube embed URL — **do not translate** |
| `Title` | Plain | `<iframe>` title attribute |
| `Text.Passion` | **Markdown** | Contains `[text](url)` links |
| `Text.StateOfTheArt` | **Markdown** | Contains `**bold**` and `[text](url)` links |

### `Bazaar`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | Small label |
| `Title` | Plain | Section title |
| `Description` | **HTML** | Contains `<a href="..." target="_blank">` tags |
| `Additional` | **HTML** | Contains `<a>`, `<br>`, `<strong>` tags |
| `FlathubButton` | Plain | Button label |

### `TryBluefin`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | |
| `Title` | Plain | |
| `Description.Choice` | **Markdown** | Contains `[text](url)` links |
| `Description.Updates` | Plain | |
| `Label.*` | Plain | All button / UI labels |
| `Lts.Title` | Plain | |
| `Lts.Subtitle` | Plain | |
| `Lts.Description` | Plain | |
| `Stable.Title` | Plain | |
| `Stable.Subtitle` | Plain | |
| `Stable.Description` | Plain | |
| `Architecture.Question` | Plain | |
| `Architecture.x86` | Plain | |
| `Architecture.arm` | Plain | |
| `Gpu.Question` | Plain | |
| `Gpu.DefaultSelection` | Plain | |
| `Gpu.AMDIntel` | Plain | |
| `Gpu.Nvidia` | Plain | |
| `Kernel.Question` | Plain | |
| `Kernel.Regular` | Plain | |
| `Kernel.HWE` | Plain | |
| `Selection.*` | Plain | All labels and descriptions |
| `Download.IsoDescription` | Plain | |
| `Download.IsoDownload` | Plain | Button label |
| `Download.Checksum` | Plain | Button label |
| `Download.Registry` | Plain | Button label |
| `Download.Documentation.Intro` | **Markdown** | Contains `[text](url)` links |
| `Download.Documentation.Downloads` | **Markdown** | Contains `[text](url)` links |
| `Download.Documentation.SecureBoot` | **Markdown** | Contains `[text](url)` links |
| `Download.ChooseRelease` | Plain | Button label |

### `Community`

| Key | Type | Notes |
|-----|------|-------|
| `Tag` | Plain | |
| `Title` | Plain | |
| `Documentation.*` | Plain | All labels and descriptions |
| `Contribute.*` | Plain | All labels and descriptions |

### `News`

| Key | Type | Notes |
|-----|------|-------|
| `Title` | Plain | |
| `Loading` | Plain | Loading state label |
| `NoPosts` | Plain | Empty state label |
| `ViewAll` | Plain | Link label |

### `Flock`

| Key | Type | Notes |
|-----|------|-------|
| `Title` | Plain | |
| `Description` | Plain | |
| `AlumniTitle` | Plain | |
| `SponsorsTitle` | Plain | |

### `Footer`

| Key | Type | Notes |
|-----|------|-------|
| `PoweredBy` | Plain | Label |
| `Project.Title` | Plain | |
| `Project.Ublue` | Plain | |
| `Credits.Intro` | Plain | |
| `Credits.Website` | **Markdown** | Contains `[name](url)` links — **do not translate the names or URLs** |
| `Credits.Logos` | **Markdown** | Same — do not translate names/URLs |
| `Credits.ImageEdit` | **Markdown** | Same |
| `Credits.Wallpapers` | **Markdown** | Same |
| `Credits.Translations` | **Markdown** | Same |
| `Credits.Thanks` | **Markdown** | Same |
| `Copyright` | Plain | Contains `{date}` placeholder — keep it as-is |

### `Navbar`

| Key | Type | Notes |
|-----|------|-------|
| `ForYou` | Plain | Nav item |
| `ForDevs` | Plain | Nav item |
| `OurMission` | Plain | Nav item |
| `TryOut` | Plain | Nav item |
| `Community` | Plain | Nav item |

---

## Rules and Tips

### Never change keys or structure

The JSON keys (left side of `:`) must remain exactly as they are in
`en-US.json`. The application imports all locale files with the same schema.

### Keep placeholders intact

Some strings contain Vue i18n interpolation placeholders like `{date}`. Copy
them verbatim into your translation:

```json
"Copyright": "Copyright {date} © Project Bluefin and Universal Blue"
```

### Do not translate proper nouns or brand names

Names like **Bluefin**, **Flathub**, **Homebrew**, **Flatpak**, **GNOME**, and
**Fedora** should not be translated. Likewise, keep URLs, GitHub usernames, and
credit attributions (`Credits.*`) unchanged.

### Keep links in Markdown fields

If the English string is:
```
"[announcement blog post](https://www.ypsidanger.com/...)"
```
Your translation should preserve the URL and only translate the link text:
```
"[Ankündigungs-Blogbeitrag](https://www.ypsidanger.com/...)"
```

### Do not add HTML to Markdown fields (and vice versa)

If a field is marked **Markdown** in this guide, use Markdown syntax.
If it is marked **HTML**, use HTML tags. Mixing them produces broken output.

---

## Validating Your Work

There is currently no automated schema check for locale files. Before opening
your PR:

1. Make sure every key present in `en-US.json` also appears in your file.
2. Make sure no extra keys were accidentally added.
3. Check that all `{placeholder}` tokens are preserved.
4. Open the dev server (`npm run dev`) and visually inspect the page with your
   locale selected to catch obvious rendering issues.

---

## Asking for Help

- **Discord:** [discord.gg/projectbluefin](https://discord.gg/projectbluefin)
- **GitHub Discussions:** open a thread in the website repository
- Check existing locale files (e.g. `fr-FR.json`, `de-DE.json`) for examples
  of how other translators have handled edge cases.
