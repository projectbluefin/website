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
  if (time < 349) {
    return active('welcome', 'We\'ve got your back, welcome to the path.', '', '', time < 348)
  }
  if (time < 350.5 || (time >= 353.5 && time < 355)) {
    return active('corruption')
  }
  if (time < 353.5) {
    return active('universal-blue', 'We are Universal Blue.')
  }
  if (time < 359) {
    return active('evolve', 'Evolve or die ...')
  }
  if (time < 395) {
    return inactive
  }
  if (time < 405) {
    return active('growing-corruption')
  }
  return active('legend', 'Become Legend', 'You have ascended ...', 'truly a great loss for humanity.')
}
