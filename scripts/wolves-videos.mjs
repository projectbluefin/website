/**
 * The show's videos, in running order, and how to load each one's authored data.
 *
 * This is the single registry both `wolves-cue-at.mjs` and `wolves-frame-audit.mjs`
 * resolve against. It exists because the alternative — a second lookup table in the
 * second tool — is how two tools start disagreeing about what "video 1" means, and
 * this repository has already lost days to that exact ambiguity.
 *
 * Keep it in step with docs/reference/wolves-video-order.md. Add a video here when
 * its data becomes addressable, rather than growing a private table somewhere else.
 */

/** Ordinal running order of the show's videos. */
export const VIDEOS = {
  prologue: {
    ordinal: 1,
    title: 'The Gardener and the Winnower (scored prologue)',
    load: async loadModule =>
      (await loadModule('/src/data/wolves-directors-cut-intro.ts')).buildDirectorsCutPrologueSegment(),
    loadGeometry: async (loadModule) => {
      const artwork = await loadModule('/src/data/wolves-directors-cut-artwork.ts')
      return artwork.DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => ({
        file: record.localPath.split('/').pop(),
        width: record.sourceWidth,
        height: record.sourceHeight,
      }))
    },
  },
}

export const ALIASES = { 1: 'prologue', first: 'prologue', gardener: 'prologue', winnower: 'prologue' }

/**
 * Resolve a caller's name for a video to its registry entry.
 *
 * Returns `{ key, video }` so a caller can report the canonical name it resolved to,
 * rather than echoing back whatever alias the user typed.
 */
export function resolveVideo(named) {
  const key = ALIASES[named] ?? named ?? 'prologue'
  return { key, video: VIDEOS[key] ?? null }
}

export function knownVideoNames() {
  return Object.keys(VIDEOS).join(', ')
}

/**
 * Is this argument a video the registry knows?
 *
 * Callers need this to resolve a video name *before* they try to read an argument as a
 * timestamp. Numeric ordinals like `1` are legitimate video names and also parse as
 * timestamps, so a parse-first parser silently swallows the ordinal and answers about
 * the default video — which is exactly the class of confident-but-wrong answer these
 * tools exist to prevent.
 */
export function isKnownVideo(named) {
  return named != null && (Object.hasOwn(ALIASES, named) || Object.hasOwn(VIDEOS, named))
}
