export interface CaptionCue {
  /** Start time in seconds. */
  at: number
  text: string
  /** End time in seconds (start of the next cue, or Infinity for the final cue). */
  until: number
}

/**
 * Parses the repository caption format (`seconds|text`, one cue per line), the same
 * format used by src/data/wolves-destiny-captions.txt. A cue displays from its own
 * timestamp until the next cue begins.
 */
export function parseCaptionCues(raw: string): CaptionCue[] {
  const cues: CaptionCue[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const separator = trimmed.indexOf('|')
    if (separator <= 0) {
      continue
    }
    const at = Number.parseFloat(trimmed.slice(0, separator))
    const text = trimmed.slice(separator + 1).trim()
    if (!Number.isFinite(at) || !text) {
      continue
    }
    cues.push({ at, text, until: Number.POSITIVE_INFINITY })
  }

  cues.sort((a, b) => a.at - b.at)
  for (let i = 0; i < cues.length - 1; i++) {
    cues[i].until = cues[i + 1].at
  }
  return cues
}

export function activeCaptionCue(cues: CaptionCue[], time: number): CaptionCue | null {
  for (const cue of cues) {
    if (time >= cue.at && time < cue.until) {
      return cue
    }
  }
  return null
}
