import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { DIRECTORS_CUT_FINALE_ANCHORS } from '@/data/wolves-directors-cut-finale'
import { DIRECTORS_CUT_FINALE_START } from '@/data/wolves-directors-cut-timeline'
import { useCinematicStore, WOLVES_DIRECTORS_CUT_EXPERIENCE, WOLVES_EXPERIENCE } from '@/stores/cinematic'

/**
 * Chrome suppression is a store fact, not a component fact: three separate
 * surfaces (`WolvesApp.vue`, `CinematicStage.vue`, `TheaterExperience.vue`)
 * read the same derived state, so a Director's Cut run that seeks backward
 * restores every one of them at once. These tests pin the derivation.
 */
function directorsCutAt(time: number) {
  const store = useCinematicStore()
  store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
  store.enterCinematic()
  store.updateTime(time, 424, time)
  return store
}

describe('director\'s cut finale store state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is inactive before the finale beat', () => {
    const store = directorsCutAt(DIRECTORS_CUT_FINALE_START - 0.01)
    expect(store.directorFinaleActive).toBe(false)
    expect(store.directorTerminalBlack).toBe(false)
  })

  it('activates exactly on the finale beat and stays active to the end', () => {
    expect(directorsCutAt(DIRECTORS_CUT_FINALE_START).directorFinaleActive).toBe(true)
    expect(directorsCutAt(424).directorFinaleActive).toBe(true)
  })

  it('pre-arms before the cover so the companion player is never cold', () => {
    expect(directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm - 0.01).directorFinalePrearmed).toBe(false)
    const prearmed = directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    expect(prearmed.directorFinalePrearmed).toBe(true)
    expect(prearmed.directorFinaleActive).toBe(false)
  })

  it('never fires for the standard seven-part show', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(420, 424, 420)
    expect(store.directorFinalePrearmed).toBe(false)
    expect(store.directorFinaleActive).toBe(false)
    expect(store.directorTerminalBlack).toBe(false)
  })

  it('never fires outside the cinematic phase', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterIntro()
    store.updateTime(420, 424, 420)
    expect(store.directorFinaleActive).toBe(false)
  })

  it('restores the show when the transport is seeked back before the finale', () => {
    const store = directorsCutAt(420)
    expect(store.directorFinaleActive).toBe(true)
    store.updateTime(200, 424, 200)
    expect(store.directorFinaleActive).toBe(false)
    expect(store.directorFinalePrearmed).toBe(false)
    expect(store.directorTerminalBlack).toBe(false)
  })

  it('goes black on the terminal fade beat', () => {
    expect(directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd - 0.01).directorTerminalBlack).toBe(false)
    expect(directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd).directorTerminalBlack).toBe(true)
  })

  it('lands terminal black on Track 0\'s clock, not on the finish that now ends Ghosts', () => {
    // terminalFadeEnd (422.301s) is authored 1.699s before the 424s segment
    // end — ahead of the final PRE_END_THRESHOLD_S the transport never
    // publishes — so Track 0's black lands on a tick that actually arrives.
    const store = directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    expect(store.directorTerminalBlack).toBe(false)
    store.updateTime(
      DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd,
      424,
      DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd,
    )
    expect(store.directorTerminalBlack).toBe(true)

    // finish() now lands on the cut's LAST segment, well past Track 0's finale,
    // so it must never stand in for the finale's terminal black. The id is
    // derived from the manifest rather than typed in: which song ends this cut
    // is exactly the thing that changes when the running order is re-authored.
    directorsCutAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    store.finish()
    expect(store.finished).toBe(true)
    expect(store.segment.id).toBe(WOLVES_DIRECTORS_CUT_EXPERIENCE.segments[WOLVES_DIRECTORS_CUT_EXPERIENCE.segments.length - 1].id)
    expect(store.directorTerminalBlack).toBe(false)
  })

  it('clears the finished latch when the transport publishes an earlier time', () => {
    const store = directorsCutAt(420)
    store.finish()
    expect(store.finished).toBe(true)
    store.updateTime(100, 424, 100)
    expect(store.finished).toBe(false)
    expect(store.directorTerminalBlack).toBe(false)
  })

  it('finishes the multi-song transport on its last segment', () => {
    const store = directorsCutAt(420)
    store.finish()
    expect(store.segmentIndex).toBe(store.segments.length - 1)
    expect(store.segment.id).toBe(WOLVES_DIRECTORS_CUT_EXPERIENCE.segments[WOLVES_DIRECTORS_CUT_EXPERIENCE.segments.length - 1].id)
    expect(store.isLastSegment).toBe(true)
    expect(store.playing).toBe(false)
  })

  it('starts a fresh Director\'s Cut run without a stale finished latch', () => {
    const store = directorsCutAt(420)
    store.finish()
    store.enterCinematic()
    expect(store.finished).toBe(false)
    expect(store.directorFinaleActive).toBe(false)
  })
})
