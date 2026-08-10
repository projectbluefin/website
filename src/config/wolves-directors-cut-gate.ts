/**
 * Whether this build is allowed to expose the Director's Cut.
 *
 * The Director's Cut is under active revision and is not part of the show the public site
 * performs. It stays reachable while iterating locally and disappears from anything deployed,
 * so the cut can be revved fast without a half-finished act reaching the live route.
 *
 * This is one constant on purpose. The cut has two entrances — the lobby button and the
 * `?directors-cut` deep link — and a wall that only covers the button is not a wall: the link
 * survives in URLs, chat logs, and recording scripts long after the button is gone. Both read
 * this, so neither can be gated without the other.
 *
 * `import.meta.env.DEV` is Vite's own build-mode flag, already used for the runtime's other
 * development-only surfaces. It is statically replaced at build time, so the production bundle
 * takes the `false` branch and the gated code is dropped rather than merely hidden.
 */
export const DIRECTORS_CUT_ENABLED: boolean = import.meta.env.DEV
