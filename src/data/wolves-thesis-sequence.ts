import incomingSignalSource from './wolves-incoming-signal.txt?raw'

export type WolvesThesisMode = 'inactive' | 'welcome' | 'corruption' | 'universal-blue' | 'evolve' | 'growing-corruption' | 'legend'

export interface WolvesThesisState {
  active: boolean
  mode: WolvesThesisMode
  text: string
  subtitle: string
  warning: string
  dayPulse: boolean
  hudLabel: string
}

const THESIS_START_SECONDS = 345
const THESIS_END_SECONDS = 425
const TRACK_ZERO_BPM = 152
const PHRASE_BEATS = 16
const DEFAULT_HUD_LABEL = 'Incoming Signal: Universal Blue'
const TITANFALL_HUD_LABEL = 'Bazzite Mk6 Units: Prepare for Titanfall'

const inactive: WolvesThesisState = { active: false, mode: 'inactive', text: '', subtitle: '', warning: '', dayPulse: false, hudLabel: '' }

function active(
  mode: WolvesThesisMode,
  text = '',
  subtitle = '',
  warning = '',
  dayPulse = false,
  hudLabel = 'Incoming Signal: Universal Blue',
): WolvesThesisState {
  return {
    active: true,
    mode,
    text,
    subtitle,
    warning,
    dayPulse,
    hudLabel,
  }
}

export function parseIncomingSignalMessages(source: string): readonly string[] {
  return Object.freeze(
    source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
  )
}

export const wolvesIncomingSignalMessages = parseIncomingSignalMessages(incomingSignalSource)

export function getWolvesHudLabel(time: number): string {
  const interval = (60 / TRACK_ZERO_BPM) * PHRASE_BEATS
  if (time < 175.96) {
    if (wolvesIncomingSignalMessages.length === 0) {
      return DEFAULT_HUD_LABEL
    }
    const phraseIndex = Math.floor(time / interval)
    return wolvesIncomingSignalMessages[phraseIndex % wolvesIncomingSignalMessages.length] ?? DEFAULT_HUD_LABEL
  }
  if (time < 196.36) {
    return 'The Blue Delivers'
  }
  if (time < 229) {
    return 'pod/thriving-community created'
  }
  if (time < 253) {
    return 'Warning: ImagePullBackOff'
  }
  if (time < 277) {
    return '"humans/collaboration:latest" is currently experimental.'
  }
  if (time < 345) {
    return 'Falling back to "humans/trying-their-best:v1" slowly'
  }
  if (time < 408) {
    if (wolvesIncomingSignalMessages.length === 0) {
      return DEFAULT_HUD_LABEL
    }
    const phraseIndex = Math.floor((time - THESIS_START_SECONDS) / interval + 1e-9)
    return wolvesIncomingSignalMessages[Math.min(phraseIndex, wolvesIncomingSignalMessages.length - 1)] ?? DEFAULT_HUD_LABEL
  }
  return TITANFALL_HUD_LABEL
}

export function getWolvesThesisState(time: number): WolvesThesisState {
  if (time < THESIS_START_SECONDS || time > THESIS_END_SECONDS) {
    return inactive
  }
  if (time < 347.75) {
    return active('welcome', 'We\'ve got your back.', '', '', true, getWolvesHudLabel(time))
  }
  if (time < 350.5) {
    return active('welcome', 'You\'ll never walk alone ...', '', '', true, getWolvesHudLabel(time))
  }
  if (time < 359) {
    return active('universal-blue', 'We are Universal Blue.', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 365) {
    return active('evolve', 'Evolve or die ...', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 395) {
    return inactive
  }
  if (time < 405) {
    return active('growing-corruption', '', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 408) {
    return active('legend', 'You have ascended ...', '', 'truly a great loss for humanity.', false, getWolvesHudLabel(time))
  }
  return active('legend', 'Become Legend', '', 'truly a great loss for humanity.', false, getWolvesHudLabel(time))
}
