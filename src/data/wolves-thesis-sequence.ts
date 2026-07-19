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
const WELCOME_TEXT = 'We\'ve got your back.'
const SUPPORT_TEXT = 'You\'ll never walk alone ...'
const UNIVERSAL_BLUE_TEXT = 'We are Universal Blue.'
const EVOLVE_TEXT = 'Evolve or die ...'
const ASCENDED_TEXT = 'You have ascended ...'
const LEGEND_TEXT = 'Become Legend'
const TITANFALL_HUD_LABEL = 'Bazzite Mk6 Units: Prepare for Titanfall'
const DEFAULT_HUD_LABEL = 'Celebrating Five Years of Universal Blue'
// Finale top-status compression window: thesis lines end at 365, Titanfall holds from 408.
const SIGNAL_COMPRESS_START_SECONDS = 365
const SIGNAL_COMPRESS_END_SECONDS = 408

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

// A `---` line in the editable source splits the early ambient signals from the
// climax reports: everything before the delimiter cycles from load, while the
// full list (delimiter dropped) only plays out in the finale compression window.
const SIGNAL_CLIMAX_DELIMITER = /^-{3,}$/

export function parseIncomingSignalMessages(source: string): readonly string[] {
  return Object.freeze(
    source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !SIGNAL_CLIMAX_DELIMITER.test(line)),
  )
}

export function parseEarlySignalMessages(source: string): readonly string[] {
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  const delimiterIndex = lines.findIndex(line => SIGNAL_CLIMAX_DELIMITER.test(line))
  if (delimiterIndex === -1) {
    return Object.freeze(lines)
  }
  return Object.freeze(lines.slice(0, delimiterIndex))
}

export const wolvesIncomingSignalMessages = parseIncomingSignalMessages(incomingSignalSource)
export const wolvesEarlySignalMessages = parseEarlySignalMessages(incomingSignalSource)

export function getWolvesHudLabel(time: number): string {
  if (time < 175.96) {
    // Only the first authored line holds from load. The remaining ambient
    // signals name heroes who haven't appeared yet, so they are reserved
    // until after the Jorge Bluefin hero window ends (196.36).
    return wolvesEarlySignalMessages[0] ?? DEFAULT_HUD_LABEL
  }
  if (time < 196.36) {
    return 'The Blue Delivers'
  }
  if (time < 229) {
    // Post-hero window: the remaining ambient signals play out right after the
    // heroes they reference, compressed evenly with the pod status closing the
    // run so it hands off into the ImagePullBackOff warning at 229.
    const messages = [...wolvesEarlySignalMessages.slice(1), 'pod/thriving-community created']
    const span = (229 - 196.36) / messages.length
    const phraseIndex = Math.floor((time - 196.36) / span + 1e-9)
    return messages[Math.min(phraseIndex, messages.length - 1)] ?? DEFAULT_HUD_LABEL
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
  // Finale window (345+): the thesis lines lead the top status bar at their
  // music-synced timestamps, then every incoming-signal message compresses
  // evenly into the remaining window, finishing on the Titanfall hold at 408.
  if (time < 347.75) {
    return WELCOME_TEXT
  }
  if (time < 350.5) {
    return SUPPORT_TEXT
  }
  if (time < 359) {
    return UNIVERSAL_BLUE_TEXT
  }
  if (time < SIGNAL_COMPRESS_START_SECONDS) {
    return EVOLVE_TEXT
  }
  if (time >= SIGNAL_COMPRESS_END_SECONDS) {
    return TITANFALL_HUD_LABEL
  }
  if (wolvesIncomingSignalMessages.length === 0) {
    return DEFAULT_HUD_LABEL
  }
  const span = (SIGNAL_COMPRESS_END_SECONDS - SIGNAL_COMPRESS_START_SECONDS) / wolvesIncomingSignalMessages.length
  const phraseIndex = Math.floor((time - SIGNAL_COMPRESS_START_SECONDS) / span + 1e-9)
  return wolvesIncomingSignalMessages[Math.min(phraseIndex, wolvesIncomingSignalMessages.length - 1)] ?? DEFAULT_HUD_LABEL
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
