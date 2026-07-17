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
  if (time < 175.96) {
    return 'Incoming Signal'
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
  if (time < 347.75) {
    return 'We\'ve got your back.'
  }
  if (time < 350.5) {
    return 'You\'ll never walk alone ...'
  }
  if (time < 359) {
    return 'Welcome to indie cloud native'
  }
  if (time < 365) {
    return 'Evolve or die ...'
  }
  if (time < 395) {
    return ''
  }
  if (time < 405) {
    return ''
  }
  if (time < 408) {
    return 'You have ascended ...'
  }
  return 'Become Legend'
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
