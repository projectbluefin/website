/**
 * How far ahead the theater fetches and decodes its slides, and the shortest
 * hold that depth can actually keep up with.
 *
 * These two numbers used to live as private constants inside
 * `WolvesComicReader.vue`, with the hold floor they imply typed as a literal
 * `1.5` in the Director's Cut schedule test. That made the relationship
 * unenforceable in both directions: shortening the preload window or deepening
 * the lookahead would silently invalidate the floor the schedule was written
 * against, and the test would keep passing while the show started arriving
 * late on a cold cache.
 */

/** Seconds of upcoming slides to keep fetched and decoded ahead of the cue. */
export const PRELOAD_WINDOW_SECONDS = 8

/** Ceiling so a run of very short slides cannot fetch the whole gallery at once. */
export const MAX_LOOKAHEAD_SLIDES = 12

/**
 * The shortest hold the preloader can cover, in seconds.
 *
 * The lookahead ceiling is what binds: at `MAX_LOOKAHEAD_SLIDES` slides in
 * flight, the deepest slide is only `PRELOAD_WINDOW_SECONDS` away if the holds
 * average at least this long. Schedule anything shorter and the preload lead
 * collapses — the reader waits for decode at the boundary, the previous slide
 * holds past its beat, and the sequence walks off the music.
 */
export const TRACK_ZERO_SLIDE_MINIMUM_HOLD_SECONDS = PRELOAD_WINDOW_SECONDS / MAX_LOOKAHEAD_SLIDES
