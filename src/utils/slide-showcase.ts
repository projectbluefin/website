/**
 * Showcase treatment for slides that do not fill the comic portal.
 *
 * `.comic-viewport` is a fixed 3:2 portal with a frosted-glass surface
 * (translucent fill + backdrop blur). A 3:2 landscape slide covers that
 * surface edge to edge, but a portrait photograph pillarboxes and the
 * `public/characters/` hero art is square with an alpha channel, so the
 * frosted surface shows through *and* around the silhouette. For those
 * slides the owner wants the chrome gone: the box turns fully translucent
 * and the stage artwork behind the portal shows through instead
 * ("showcase art, not frosted glass").
 *
 * Two qualification signals, either is sufficient:
 *
 * - `kind === 'hero'`. The character art is mostly square (measured 2026-08:
 *   every `public/characters/` asset lands between 0.94 and 1.62, the
 *   majority exactly 1:1) and RGBA, so a measured-orientation rule would
 *   miss the square dinosaurs the owner explicitly named, and even the
 *   wider ones expose the box surface through their transparent surround.
 * - Measured aspect (`naturalWidth / naturalHeight`) narrower than the
 *   portal: the image pillarboxes under `object-fit: contain`, leaving
 *   visible surface on both flanks. Portrait photos are the common case,
 *   but 4:3 and square shots pillarbox too.
 *
 * Slides wider than the portal (thin top/bottom letterbox) keep the frosted
 * surface; an unmeasured slide keeps it as well, so the treatment never
 * pops from translucent back to frosted once it has been applied.
 */
export const COMIC_PORTAL_ASPECT = 3 / 2

export function slideAspectFromNaturalSize(naturalWidth: number, naturalHeight: number): number | null {
  if (naturalWidth > 0 && naturalHeight > 0) {
    return naturalWidth / naturalHeight
  }
  return null
}

export function isShowcaseSlide(kind: string | undefined, slideAspect: number | null | undefined): boolean {
  if (kind === 'hero') {
    return true
  }
  if (typeof slideAspect !== 'number' || !Number.isFinite(slideAspect) || slideAspect <= 0) {
    return false
  }
  return slideAspect < COMIC_PORTAL_ASPECT
}
