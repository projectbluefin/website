import type { CinematicTransitionLine, TransitionSfxEffect } from '@/config/wolves-cinematic'

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

interface TransitionSfxCue {
  effect: TransitionSfxEffect
}

type BrowserAudioContext = AudioContext & { webkitAudioContext?: never }

function resolveAudioContextCtor():
  | (new () => BrowserAudioContext)
  | null {
  if (typeof window === 'undefined') {
    return null
  }
  return (window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }).webkitAudioContext ?? null) as (new () => BrowserAudioContext) | null
}

function noiseValue(index: number) {
  const seeded = Math.sin((index + 1) * 12.9898) * 43758.5453
  return ((seeded - Math.floor(seeded)) * 2) - 1
}

function buildNoiseBuffer(context: BrowserAudioContext, durationSeconds: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < length; index++) {
    channel[index] = noiseValue(index) * 0.85
  }
  return buffer
}

function connectNodes(nodes: AudioNode[]) {
  for (let index = 0; index < nodes.length - 1; index++) {
    nodes[index]?.connect(nodes[index + 1]!)
  }
}

function scheduleStatic(context: BrowserAudioContext, startAt: number) {
  const source = context.createBufferSource()
  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(2400, startAt)
  bandpass.Q.setValueAtTime(1.4, startAt)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(0.22, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)

  source.buffer = buildNoiseBuffer(context, 0.2)
  connectNodes([source, bandpass, gain, context.destination])
  source.start(startAt)
  source.stop(startAt + 0.2)
}

function scheduleKnock(context: BrowserAudioContext, startAt: number, frequency = 110) {
  const body = context.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(frequency, startAt)
  body.frequency.exponentialRampToValueAtTime(frequency * 0.72, startAt + 0.22)

  const overtone = context.createOscillator()
  overtone.type = 'square'
  overtone.frequency.setValueAtTime(frequency * 2.1, startAt)
  overtone.frequency.exponentialRampToValueAtTime(frequency * 1.2, startAt + 0.12)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(0.28, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24)

  const toneBus = context.createGain()
  toneBus.gain.setValueAtTime(1, startAt)
  connectNodes([body, toneBus, gain, context.destination])
  connectNodes([overtone, toneBus])

  body.start(startAt)
  overtone.start(startAt)
  body.stop(startAt + 0.24)
  overtone.stop(startAt + 0.18)
}

function scheduleExplosion(context: BrowserAudioContext, startAt: number) {
  const noise = context.createBufferSource()
  noise.buffer = buildNoiseBuffer(context, 0.95)

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(220, startAt)
  lowpass.frequency.exponentialRampToValueAtTime(80, startAt + 0.9)

  const rumble = context.createOscillator()
  rumble.type = 'sawtooth'
  rumble.frequency.setValueAtTime(58, startAt)
  rumble.frequency.exponentialRampToValueAtTime(34, startAt + 0.9)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(0.34, startAt + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.95)

  connectNodes([noise, lowpass, gain, context.destination])
  connectNodes([rumble, gain])

  noise.start(startAt)
  rumble.start(startAt)
  noise.stop(startAt + 0.95)
  rumble.stop(startAt + 0.95)
}

function cueSpacing(effect: TransitionSfxEffect) {
  switch (effect) {
    case 'static':
      return 0.28
    case 'bulkhead-knock':
      return 0.46
    case 'bulkhead-response':
      return 0.72
    case 'explosion':
      return 1.15
  }
}

function scheduleCue(context: BrowserAudioContext, cue: TransitionSfxCue, startAt: number) {
  switch (cue.effect) {
    case 'static':
      scheduleStatic(context, startAt)
      return
    case 'bulkhead-knock':
      scheduleKnock(context, startAt)
      return
    case 'bulkhead-response':
      scheduleKnock(context, startAt, 98)
      scheduleKnock(context, startAt + 0.24, 92)
      return
    case 'explosion':
      scheduleExplosion(context, startAt)
  }
}

export function transitionSfxCues(lines: readonly CinematicTransitionLine[]): readonly TransitionSfxCue[] {
  return lines.flatMap<TransitionSfxCue>((line) => {
    if (line.kind === 'static') {
      return [{ effect: line.effect }]
    }
    if (line.kind === 'sfx') {
      return [{ effect: line.effect }]
    }
    return []
  })
}

export function createTransitionSfxPlayer() {
  let context: BrowserAudioContext | null = null
  let unlockListener: (() => void) | null = null
  let lastPlayedKey = ''

  function ensureContext() {
    if (context) {
      return context
    }
    const AudioContextCtor = resolveAudioContextCtor()
    if (!AudioContextCtor) {
      return null
    }
    try {
      context = new AudioContextCtor()
    }
    catch {
      context = null
    }
    return context
  }

  async function unlock() {
    const audioContext = ensureContext()
    if (!audioContext) {
      return false
    }
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume()
      }
      catch {
        return false
      }
    }
    return audioContext.state === 'running'
  }

  function armFromUserGestures() {
    if (unlockListener || typeof window === 'undefined') {
      return
    }
    unlockListener = () => {
      void unlock()
    }
    for (const eventName of UNLOCK_EVENTS) {
      window.addEventListener(eventName, unlockListener, { passive: true })
    }
  }

  async function playTransition(key: string, lines: readonly CinematicTransitionLine[]) {
    if (lastPlayedKey === key) {
      return
    }
    lastPlayedKey = key

    const cues = transitionSfxCues(lines)
    if (!cues.length) {
      return
    }
    if (!await unlock()) {
      return
    }

    const audioContext = ensureContext()
    if (!audioContext || audioContext.state !== 'running') {
      return
    }

    let startAt = audioContext.currentTime + 0.04
    for (const cue of cues) {
      try {
        scheduleCue(audioContext, cue, startAt)
      }
      catch {
        return
      }
      startAt += cueSpacing(cue.effect)
    }
  }

  function destroy() {
    if (unlockListener && typeof window !== 'undefined') {
      for (const eventName of UNLOCK_EVENTS) {
        window.removeEventListener(eventName, unlockListener)
      }
    }
    unlockListener = null
    const audioContext = context
    context = null
    void audioContext?.close?.().catch(() => {})
  }

  return {
    armFromUserGestures,
    destroy,
    playTransition,
  }
}
