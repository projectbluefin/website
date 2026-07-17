import { describe, expect, it } from 'vitest'
import { activeCaptionCue, parseCaptionCues } from '@/utils/caption-cues'

describe('caption cue parsing', () => {
  it('parses seconds|text lines into ordered cues', () => {
    const cues = parseCaptionCues('4.36|What is a guardian?\n7.35|Are we gods?\n')
    expect(cues).toHaveLength(2)
    expect(cues[0]).toMatchObject({ at: 4.36, text: 'What is a guardian?', until: 7.35 })
    expect(cues[1].until).toBe(Number.POSITIVE_INFINITY)
  })

  it('sorts out-of-order cues and skips malformed lines', () => {
    const cues = parseCaptionCues('9.4|Second\n\nnot-a-cue\n|missing time\n3.1|First\nNaN|bad number')
    expect(cues.map(cue => cue.text)).toEqual(['First', 'Second'])
    expect(cues[0].until).toBe(9.4)
  })

  it('selects the active cue for a playback time', () => {
    const cues = parseCaptionCues('1|one\n5|two\n9|three')
    expect(activeCaptionCue(cues, 0)).toBeNull()
    expect(activeCaptionCue(cues, 1)?.text).toBe('one')
    expect(activeCaptionCue(cues, 4.99)?.text).toBe('one')
    expect(activeCaptionCue(cues, 5)?.text).toBe('two')
    expect(activeCaptionCue(cues, 500)?.text).toBe('three')
  })
})
