/**
 * Caption text and provenance credit for gallery slides.
 *
 * Two sources feed the gallery and neither ships display-ready captions:
 *
 * - The CNCF stream carries photographer export filenames
 *   (`KC+CNC_EU_240319_KCS_GroupPhoto_MN_001`).
 * - 43 curated wallpapers are missing from the title dictionary in
 *   scripts/generate-wallpapers.js, so `formatTitle` title-cases their basename
 *   instead (`32433026808 C8529aca08 K`).
 *
 * Both were rendered verbatim, at size, to a projected audience.
 *
 * This is a *derivation*, never an invention. The event, region, session and
 * date are literally encoded in the filename, so reading them back out is
 * faithful. A bare Flickr id encodes nothing, so it yields no caption at all
 * rather than a guess — a wrong caption on a cinema screen is worse than none.
 * Anything unrecognised is passed through untouched, because authored titles
 * ("Bluefin Advisor Chris Aniszczyk") are already correct.
 */

import type { BackCatalogueSlideKind } from './back-catalogue-order'

const REGIONS: Record<string, string> = {
  NA: 'KubeCon NA',
  EU: 'KubeCon EU',
  CN: 'KubeCon China',
  JP: 'KubeCon Japan',
  IN: 'KubeCon India',
}

const SESSIONS: Record<string, string> = {
  KCS: 'Contributor Summit',
  CS: 'Contributor Summit',
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Filename stems that name a source or a device rather than a subject. */
const SOURCE_PREFIXES = new Set([
  'cncf',
  'kubecon',
  'flickr',
  'img',
  'dsc',
  'photo',
  'pxl',
  'temp',
  'image',
  'screenshot',
])

/** A hex blob from a uuid or a Flickr secret. */
function isHexBlob(token: string): boolean {
  return /^[0-9a-f]{6,}$/i.test(token) && /\d/.test(token)
}

/**
 * A token that could plausibly describe a subject: three or more consecutive
 * letters that are not a device name or a hex blob.
 */
function isMeaningfulToken(token: string): boolean {
  return /[A-Z]{3,}/i.test(token)
    && !SOURCE_PREFIXES.has(token.toLowerCase())
    && !isHexBlob(token)
}

/**
 * A title that identifies a file rather than describing a photograph: a bare
 * Flickr id (`53322730377 Ca5b65a035 K`), a source-prefixed id
 * (`Cncf 54927603143`), a camera or phone filename (`0R0A9083`, `DSC04181`,
 * `PXL 20240720 181225593`), or a scratch export
 * (`Temp Image 20230915 011731 Aeb0b8f4 ...`).
 *
 * None of these encodes anything a caption could honestly say. A few carry a
 * timestamp, but "July 2024" alone describes no subject — on a cinema screen
 * that is noise wearing a caption's clothes. All of them render no caption.
 *
 * The meaningless-token test only fires on titles that also carry a long number
 * or hex blob. Without that guard it swallows short authored titles whose only
 * word happens to be a generic noun, such as "Photo A".
 */
function isOpaqueIdentifier(title: string): boolean {
  const tokens = title.split(/[\s_]+/).filter(Boolean)
  if (tokens.length === 0) {
    return false
  }
  if (/^\d{9,}$/.test(tokens[0])) {
    return true
  }
  const looksLikeAFilename = tokens.some(token => /^\d{6,}$/.test(token) || isHexBlob(token))
  if (looksLikeAFilename && !tokens.some(isMeaningfulToken)) {
    return true
  }
  return tokens.length === 1
    && !/[a-z]/.test(tokens[0])
    && (tokens[0].match(/\d/g)?.length ?? 0) >= 4
}

function formatSixDigitDate(token: string): string | undefined {
  if (!/^\d{6}$/.test(token)) {
    return undefined
  }
  const month = Number(token.slice(2, 4))
  if (month < 1 || month > 12) {
    return undefined
  }
  return `${MONTHS[month - 1]} 20${token.slice(0, 2)}`
}

function formatEightDigitDate(token: string): string | undefined {
  if (!/^20\d{6}$/.test(token)) {
    return undefined
  }
  const month = Number(token.slice(4, 6))
  if (month < 1 || month > 12) {
    return undefined
  }
  return `${MONTHS[month - 1]} ${token.slice(0, 4)}`
}

/**
 * `MaintainerSummitBreakoutsB206` -> `Maintainer Summit Breakouts B206`.
 *
 * Splits only before an initial-capital word or a capital-plus-digit room code,
 * never inside an all-caps run: the CNCF feed contains wordplay like
 * `KuberTENes` that a naive boundary split would break into `Kuber TENes`.
 */
function humaniseSession(token: string): string {
  const mapped = SESSIONS[token]
  if (mapped) {
    return mapped
  }
  return token
    .split('-')
    .map(part => SESSIONS[part] ?? part
      .replace(/([a-z\d])([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z]\d)/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .join(' · ')
}

/** Photographer initials (`MN`, `ML-MN`) and trailing frame counters. */
function isPhotographerOrCounter(token: string): boolean {
  return /^\d+$/.test(token) || /^[A-Z]{2,3}(?:-[A-Z]{2,3})*$/.test(token)
}

function formatIsoDate(token: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(token)
  if (!match) {
    return undefined
  }
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return undefined
  }
  return `${MONTHS[month - 1]} ${match[1]}`
}

function formatUnderscoreExportTitle(title: string, leadingDate: string): string {
  const parts: string[] = []

  for (const token of title.split('_').slice(1)) {
    if (isPhotographerOrCounter(token)) {
      continue
    }
    parts.push(humaniseSession(token))
  }

  parts.push(leadingDate)
  return parts.filter(Boolean).join(' · ')
}

function formatCncfExportTitle(title: string): string {
  const tokens = title.split('_').filter(Boolean)
  const parts: string[] = []
  let date: string | undefined

  for (const token of tokens.slice(1)) {
    const sixDigit = formatSixDigitDate(token)
    if (sixDigit) {
      date = sixDigit
      continue
    }
    if (REGIONS[token]) {
      parts.push(REGIONS[token])
      continue
    }
    // Session abbreviations are checked before the photographer/counter filter:
    // `KCS` is indistinguishable from a photographer's initials by shape alone.
    if (SESSIONS[token]) {
      parts.push(SESSIONS[token])
      continue
    }
    if (isPhotographerOrCounter(token)) {
      continue
    }
    parts.push(humaniseSession(token))
  }

  if (parts.length === 0) {
    parts.push('KubeCon + CloudNativeCon')
  }
  if (date) {
    parts.push(date)
  }
  return parts.join(' · ')
}

/**
 * Display caption for a slide title. Returns an empty string when the title
 * carries no meaning, in which case the caption is not rendered at all.
 */
export function formatGalleryCaption(title: string | undefined): string {
  const trimmed = (title ?? '').trim()
  if (trimmed.length === 0 || isOpaqueIdentifier(trimmed)) {
    return ''
  }

  if (trimmed.startsWith('KC+CNC')) {
    return formatCncfExportTitle(trimmed)
  }

  // A second photographer grammar in the same feed: `2024-06-06_OHSNAP_...`.
  const isoDate = formatIsoDate(trimmed.split('_')[0])
  if (isoDate && trimmed.includes('_')) {
    return formatUnderscoreExportTitle(trimmed, isoDate)
  }

  const tokens = trimmed.split(/\s+/)
  const leadingDate = formatEightDigitDate(tokens[0])
  if (leadingDate && tokens.length > 1) {
    const rest = tokens.slice(1).filter(token => !/^\d+$/.test(token))
    return [...rest.map(token => token.toUpperCase() === token ? token : token), leadingDate]
      .filter(Boolean)
      .join(' · ')
  }

  return trimmed
}

const KIND_LABELS: Record<BackCatalogueSlideKind, string> = {
  cncf: 'CNCF STREAM //',
  curated: 'BLUEFIN SHOWCASE //',
  showcase: 'BLUEFIN SHOWCASE //',
  mascot: 'BLUEFIN ORIGINAL //',
  hero: 'BLUEFIN ORIGINAL //',
  artwork: 'UNIVERSAL BLUE ARTWORK //',
  bazzite: 'BAZZITE ARTWORK //',
}

/**
 * Provenance credit. Keyed on `kind`, never on whether the file happens to sit
 * on our disk: 38 CNCF conference photos are mirrored under `wolves/people/`
 * and crediting those to Bluefin misattributes someone else's photography.
 */
export function getGalleryCaptionLabel(slide: { kind?: BackCatalogueSlideKind, isLocal?: boolean }): string {
  if (slide.kind) {
    return KIND_LABELS[slide.kind]
  }
  return slide.isLocal ? 'BLUEFIN SHOWCASE //' : 'CNCF STREAM //'
}
