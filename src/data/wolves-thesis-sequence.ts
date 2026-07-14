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

const inactive: WolvesThesisState = { active: false, mode: 'inactive', text: '', subtitle: '', warning: '', dayPulse: false, hudLabel: '' }

function active(mode: WolvesThesisMode, text = '', subtitle = '', warning = '', dayPulse = false): WolvesThesisState {
  return {
    active: true,
    mode,
    text,
    subtitle,
    warning,
    dayPulse,
    hudLabel: 'Incoming Signal: Universal Blue',
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

function incomingSignalText(time: number): string {
  if (wolvesIncomingSignalMessages.length === 0) {
    return ''
  }

  const phraseIndex = Math.floor(
    (time - THESIS_START_SECONDS) / (60 / TRACK_ZERO_BPM * PHRASE_BEATS) + 1e-9,
  )
  return wolvesIncomingSignalMessages[Math.min(phraseIndex, wolvesIncomingSignalMessages.length - 1)]
}

export function getWolvesThesisState(time: number): WolvesThesisState {
  if (time < THESIS_START_SECONDS || time > THESIS_END_SECONDS) {
    return inactive
  }
  if (time < 347.75) {
    return active('welcome', incomingSignalText(time), '', '', true)
  }
  if (time < 350.5) {
    return active('welcome', incomingSignalText(time), '', '', true)
  }
  if (time < 359) {
    return active('universal-blue', incomingSignalText(time))
  }
  if (time < 365) {
    return active('evolve', incomingSignalText(time))
  }
  if (time < 395) {
    return active('corruption', incomingSignalText(time))
  }
  if (time < 405) {
    return active('growing-corruption', incomingSignalText(time))
  }
  if (time < 408) {
    return active('legend', incomingSignalText(time), '', 'truly a great loss for humanity.')
  }
  return active('legend', incomingSignalText(time), '', 'truly a great loss for humanity.')
}
