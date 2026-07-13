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

export function getWolvesThesisState(time: number): WolvesThesisState {
  if (time < 345 || time > 425) {
    return inactive
  }
  if (time < 347.75) {
    return active('welcome', 'We\'ve got your back.', '', '', true)
  }
  if (time < 350.5) {
    return active('welcome', 'You\'ll never walk alone ...', '', '', true)
  }
  if (time < 359) {
    return active('universal-blue', 'We are Universal Blue.')
  }
  if (time < 365) {
    return active('evolve', 'Evolve or die ...')
  }
  if (time < 395) {
    return inactive
  }
  if (time < 405) {
    return active('growing-corruption')
  }
  if (time < 408) {
    return active('legend', 'You have ascended ...', '', 'truly a great loss for humanity.')
  }
  return active('legend', 'Become Legend', '', 'truly a great loss for humanity.')
}
