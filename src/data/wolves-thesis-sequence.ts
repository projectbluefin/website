import {
  getTrackZeroHudLabel,
  parseTrackZeroEarlySignalMessages,
  parseTrackZeroSignalMessages,
  wolvesEarlySignalMessages,
  wolvesIncomingSignalMessages,
  getTrackZeroSectionMessages,
} from './wolves-track-zero-manifest'

export { parseTrackZeroEarlySignalMessages as parseEarlySignalMessages }
export { parseTrackZeroSignalMessages as parseIncomingSignalMessages }
export { wolvesEarlySignalMessages, wolvesIncomingSignalMessages, getTrackZeroSectionMessages }

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
const ASCENDED_TEXT = 'You have ascended ...'
const LEGEND_TEXT = 'Become Legend'
const DEFAULT_HUD_LABEL = 'Celebrating Five Years of Universal Blue'

const inactive: WolvesThesisState = { active: false, mode: 'inactive', text: '', subtitle: '', warning: '', dayPulse: false, hudLabel: '' }

function active(
  mode: WolvesThesisMode,
  text = '',
  subtitle = '',
  warning = '',
  dayPulse = false,
  hudLabel = DEFAULT_HUD_LABEL,
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

export function getWolvesHudLabel(time: number): string {
  return getTrackZeroHudLabel(time)
}

export function getWolvesThesisState(time: number): WolvesThesisState {
  if (time < THESIS_START_SECONDS || time > THESIS_END_SECONDS) {
    return inactive
  }
  // The welcome/universal-blue/evolve lines moved to the top status bar
  // (getWolvesHudLabel); their center-text renders are intentionally blank
  // while the modes keep driving the day pulse and visual treatments.
  if (time < 350.5) {
    return active('welcome', '', '', '', true, getWolvesHudLabel(time))
  }
  if (time < 359) {
    return active('universal-blue', '', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 365) {
    return active('evolve', '', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 395) {
    return inactive
  }
  if (time < 405) {
    return active('growing-corruption', '', '', '', false, getWolvesHudLabel(time))
  }
  if (time < 408) {
    return active('legend', ASCENDED_TEXT, '', 'truly a great loss for humanity.', false, getWolvesHudLabel(time))
  }
  return active('legend', LEGEND_TEXT, '', 'truly a great loss for humanity.', false, getWolvesHudLabel(time))
}
