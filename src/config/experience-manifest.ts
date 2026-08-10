/**
 * Manifest schema consumed by the cinematic runtime.
 *
 * Shipped manifests are generated YouTube experiences. The optional image kind
 * remains part of the validated schema, but no shipped manifest uses it.
 * Synced text uses `seconds|text` cues on the source media timeline.
 */

import type { CinematicSegment } from '@/config/wolves-cinematic'

export type ExperienceMediaKind = 'youtube' | 'image'

/**
 * Which authored presentation a manifest belongs to, if any. `'generic'` (the
 * default when omitted) is any back-catalogue album — its own title/artist
 * credit and freeform decorative treatment. `'wolves-standard'` and
 * `'wolves-directors-cut'` are both the authored Wolves show and share its
 * display and theater treatment; they differ only in which segments and intro
 * play. Consumers that mean "is this an authored Wolves presentation" must
 * check both, not just one.
 */
export type PresentationProfile = 'generic' | 'wolves-standard' | 'wolves-directors-cut'

/**
 * One playable segment. Extends the wolves CinematicSegment so the existing
 * runtime consumes it unchanged; adds the authored duration (drives the
 * overall seek-bar timeline) and the media kind.
 */
export interface ExperienceSegment extends CinematicSegment {
  /** Media type; omitted means 'youtube'. */
  kind?: ExperienceMediaKind
  /** Image URL for kind 'image' (relative to BASE_URL or absolute). */
  imageUrl?: string
  /** Authored segment length in seconds; drives overall timeline math. */
  durationSeconds: number
}

export interface ExperienceManifest {
  /** Stable identifier. */
  id: string
  /** Optional upstream playlist identifier used to match generated launchers. */
  sourcePlaylistId?: string
  /** Launcher card + lobby title. */
  title: string
  /** Optional launcher card sub-line. */
  subtitle?: string
  /** Cover artwork (relative to BASE_URL or absolute). Never re-encoded. */
  artwork: string
  /** Optional credits line for the launcher card. */
  credits?: string
  /**
   * Mount the authored Wolves intro sequence before the segments. Only the
   * Wolves experience sets this; it is authored content, not generic.
   */
  includeIntro?: boolean
  /** Which authored presentation this manifest belongs to; see `PresentationProfile`. */
  presentationProfile?: PresentationProfile
  segments: ExperienceSegment[]
}

/** Shape of public/experiences/catalogue.json (generated, see scripts/update-back-catalogue.js). */
export interface BackCatalogue {
  experiences: ExperienceManifest[]
}

/**
 * Runtime validation for the fetched catalogue. Trust boundary: the JSON is
 * generated in-repo, so only structural sanity is checked.
 */
export function parseBackCatalogue(data: unknown): BackCatalogue {
  if (!data || typeof data !== 'object' || !Array.isArray((data as BackCatalogue).experiences)) {
    throw new TypeError('Malformed back catalogue: expected an experiences array')
  }
  for (const experience of (data as BackCatalogue).experiences) {
    if (typeof experience?.id !== 'string' || typeof experience?.title !== 'string'
      || typeof experience?.artwork !== 'string' || !Array.isArray(experience?.segments)) {
      throw new TypeError('Malformed back catalogue: bad experience entry')
    }
    for (const segment of experience.segments) {
      if (typeof segment?.id !== 'string' || typeof segment?.title !== 'string'
        || typeof segment?.durationSeconds !== 'number'
        || (segment.kind !== 'image' && typeof segment?.youtubeId !== 'string')) {
        throw new TypeError(`Malformed back catalogue: bad segment in ${experience.id}`)
      }
    }
  }
  return data as BackCatalogue
}
