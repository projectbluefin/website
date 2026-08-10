/**
 * First-party artwork wallpapers from the Universal Blue family, registered for
 * the back-catalogue slide pool.
 *
 * Two sources, both Apache-2.0, both pinned by commit in
 * `public/licenses/ublue-family-artwork-NOTICE.txt`:
 *
 * - **Bluefin monthly day/night set** (`ublue-os/artwork`,
 *   `wallpapers/bluefin/`). The twelve pairs are the monthly rotation that
 *   ships with Bluefin; the upstream GNOME metadata names them
 *   "Bluefin NN - <Month>". The WebP encodes already sit in
 *   `public/img/wallpapers/` (added by `cb85d6c6`) but were never registered
 *   anywhere. Pair 11 is intentionally absent: upstream replaced it with the
 *   Collapse artwork ("Collapse - November"), and the local `bluefin-11-*.webp`
 *   files are byte-identical duplicates of `bluefin-12-*.webp`, so importing
 *   them would double-book December's scene.
 * - **Bazzite Convergence pair** (`ublue-os/bazzite`, `press_kit/art/`). The
 *   two wallpapers Bazzite actually ships — Convergence DX is installed to
 *   `/usr/share/wallpapers/convergence.jxl` by the image build. Converted
 *   PNG -> WebP at identical 3940x2160 geometry (the press kit forbids
 *   modifying the artwork; a format conversion at the same dimensions is the
 *   compliant reading, approved by the owner).
 *
 * Aurora artwork is deliberately excluded everywhere: the owner has stated the
 * project does not have permission to use it. That is why the records below
 * are an explicit allowlist, one entry per file, and why
 * `backCatalogueOrder.test.ts` asserts no Aurora asset can appear here.
 *
 * Every record carries a `kind` so the reader can credit provenance, and the
 * `name` prefixes (`artwork/`, `bazzite/`) are what `classifyCuratedSlide()`
 * branches on. Records extend the generated `Wallpaper` interface so wiring
 * them into `WolvesComicReader.vue` is a plain `.map()`.
 */

import type { Wallpaper } from '@/components/wolves/wallpapers-list'

/** Provenance carried by every imported artwork record. */
export interface ArtworkWallpaper extends Wallpaper {
  /** On-screen credit bucket; see KIND_LABELS in gallery-captions.ts. */
  kind: 'artwork' | 'bazzite'
  /** Upstream repository the artwork was taken from. */
  sourceRepo: string
  /** Pinned upstream commit the import was verified against. */
  sourceCommit: string
  /** SPDX id of the upstream licence. */
  sourceLicense: 'Apache-2.0'
}

const UBLUE_ARTWORK = {
  sourceRepo: 'https://github.com/ublue-os/artwork',
  sourceCommit: '1055b244c9de8d57bfceea97d1888327f3773deb',
  sourceLicense: 'Apache-2.0',
} as const

const BAZZITE_PRESS_KIT = {
  sourceRepo: 'https://github.com/ublue-os/bazzite',
  sourceCommit: 'b4ef66995b890b111b4012257c4e29e68ad7054d',
  sourceLicense: 'Apache-2.0',
} as const

/**
 * The Bluefin monthly day/night rotation, January through December minus
 * November (see the header note on pair 11). `dayName`/`nightName` are
 * relative to `public/img/wallpapers/`, matching the generated list. Titles
 * are the upstream display names from `gnome-background-properties/`, with
 * only upstream's "Febuary" spelling corrected.
 */
export const ublueArtworkWallpapers: ArtworkWallpaper[] = [
  {
    type: 'daynight',
    name: 'artwork/bluefin-01',
    dayName: 'bluefin-01-day.webp',
    nightName: 'bluefin-01-night.webp',
    title: 'Bluefin 01 - January',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-02',
    dayName: 'bluefin-02-day.webp',
    nightName: 'bluefin-02-night.webp',
    title: 'Bluefin 02 - February',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-03',
    dayName: 'bluefin-03-day.webp',
    nightName: 'bluefin-03-night.webp',
    title: 'Bluefin 03 - March',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-04',
    dayName: 'bluefin-04-day.webp',
    nightName: 'bluefin-04-night.webp',
    title: 'Bluefin 04 - April',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-05',
    dayName: 'bluefin-05-day.webp',
    nightName: 'bluefin-05-night.webp',
    title: 'Bluefin 05 - May',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-06',
    dayName: 'bluefin-06-day.webp',
    nightName: 'bluefin-06-night.webp',
    title: 'Bluefin 06 - June',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-07',
    dayName: 'bluefin-07-day.webp',
    nightName: 'bluefin-07-night.webp',
    title: 'Bluefin 07 - July',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-08',
    dayName: 'bluefin-08-day.webp',
    nightName: 'bluefin-08-night.webp',
    title: 'Bluefin 08 - August',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-09',
    dayName: 'bluefin-09-day.webp',
    nightName: 'bluefin-09-night.webp',
    title: 'Bluefin 09 - September',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-10',
    dayName: 'bluefin-10-day.webp',
    nightName: 'bluefin-10-night.webp',
    title: 'Bluefin 10 - October',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
  {
    type: 'daynight',
    name: 'artwork/bluefin-12',
    dayName: 'bluefin-12-day.webp',
    nightName: 'bluefin-12-night.webp',
    title: 'Bluefin 12 - December',
    kind: 'artwork',
    ...UBLUE_ARTWORK,
  },
]

/**
 * The two Convergence wallpapers from the Bazzite press kit. Singles, with
 * `name` doubling as the path relative to `public/img/wallpapers/` — the
 * `bazzite/` prefix is both the classification signal and the real directory.
 */
export const bazziteArtworkWallpapers: ArtworkWallpaper[] = [
  {
    type: 'single',
    name: 'bazzite/convergence.webp',
    title: 'Convergence',
    kind: 'bazzite',
    ...BAZZITE_PRESS_KIT,
  },
  {
    type: 'single',
    name: 'bazzite/convergence-dx.webp',
    title: 'Convergence DX',
    kind: 'bazzite',
    ...BAZZITE_PRESS_KIT,
  },
]
