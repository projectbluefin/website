import incomingSignalSource from './wolves-incoming-signal.txt?raw'
import { bluefinGroupSlides } from './wolves-track-zero-slides'

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
const BLUEFIN_GROUP_START_SECONDS = bluefinGroupSlides[0].window.startTime
const BLUEFIN_GROUP_END_SECONDS = bluefinGroupSlides[bluefinGroupSlides.length - 1].window.endTime
const CHANTING_BRIDGE_START_SECONDS = 229
const HEAVY_BUILD_UP_START_SECONDS = 277
const WELCOME_TEXT = 'We\'ve got your back.'
const SUPPORT_TEXT = 'You\'ll never walk alone ...'
const UNIVERSAL_BLUE_TEXT = 'We are Universal Blue.'
const EVOLVE_TEXT = 'Evolve or die ...'
const ASCENDED_TEXT = 'You have ascended ...'
const LEGEND_TEXT = 'Become Legend'
const TITANFALL_HUD_LABEL = 'Bazzite Mk6 Units: Prepare for Titanfall.'
const DEFAULT_HUD_LABEL = 'Incoming Signal'

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

export function parseIncomingSignalMessages(source: string): readonly string[] {
  return Object.freeze(
    source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
  )
}

export const wolvesIncomingSignalMessages = parseIncomingSignalMessages(incomingSignalSource)

function incomingSignalLabel(time: number): string {
  if (wolvesIncomingSignalMessages.length === 0) {
    return DEFAULT_HUD_LABEL
  }

  let messageIndex = 0
  if (time >= HEAVY_BUILD_UP_START_SECONDS) {
    messageIndex = 4
  }
  else if (time >= CHANTING_BRIDGE_START_SECONDS) {
    messageIndex = 3
  }
  else if (time >= BLUEFIN_GROUP_END_SECONDS) {
    messageIndex = 2
  }
  else if (time >= BLUEFIN_GROUP_START_SECONDS) {
    messageIndex = 1
  }

  return wolvesIncomingSignalMessages[Math.min(messageIndex, wolvesIncomingSignalMessages.length - 1)]
}

export function getWolvesHudLabel(time: number): string {
  if (time >= 408) {
    return TITANFALL_HUD_LABEL
  }
  if (time < THESIS_START_SECONDS) {
    return incomingSignalLabel(time)
  }
  return incomingSignalLabel(time)
}

export function getWolvesThesisState(time: number): WolvesThesisState {
  if (time < THESIS_START_SECONDS || time > THESIS_END_SECONDS) {
    return inactive
  }
  if (time < 347.75) {
    return active('welcome', WELCOME_TEXT, '', '', true, getWolvesHudLabel(time))
  }
  if (time < 350.5) {
    return active('welcome', SUPPORT_TEXT, '', '', true, getWolvesHudLabel(time))
  }
  if (time < 359) {
    return active('universal-blue', UNIVERSAL_BLUE_TEXT, '', '', false, getWolvesHudLabel(time))
  }
  if (time < 365) {
    return active('evolve', EVOLVE_TEXT, '', '', false, getWolvesHudLabel(time))
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
