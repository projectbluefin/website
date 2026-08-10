/**
 * The authored Track 0 companion-video playlist.
 *
 * These are the documentary/tribute uploads the theater plays beside the
 * scored show. The list lives here rather than inside `TheaterExperience.vue`
 * because two surfaces now read it: the standard Track 0 sidecar loop, and the
 * Director's Cut finale, which drives one specific entry through the YouTube
 * IFrame API. Order is authored — the finale addresses its video by index and
 * a test pins the pairing, so reordering this list is a visible change to both
 * surfaces, not a cosmetic edit.
 */
export const TRACKZERO_SIDECAR_VIDEO_IDS = [
  'xu_yE8h3jT8',
  'PjryN2F6fF0',
  'jRXB67fcXZA',
  'tcj7O-hsCN0',
  '-lo2IXn9RK4',
  '_4SQ2mWxnEc',
  'bCA6l-VlpAY',
] as const
