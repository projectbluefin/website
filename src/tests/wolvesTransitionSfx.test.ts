import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTransitionSfxPlayer, transitionSfxCues } from '@/components/wolves/cinematic/transition-sfx'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'

const originalAudioContextDescriptor = Object.getOwnPropertyDescriptor(window, 'AudioContext')

function createAudioParamMock() {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
}

function createAudioNodeMock() {
  return {
    connect: vi.fn(),
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = []
  state: AudioContextState = 'running'
  currentTime = 10
  sampleRate = 48_000
  destination = { kind: 'destination' } as unknown as AudioDestinationNode
  resume = vi.fn(async () => {
    this.state = 'running'
  })

  close = vi.fn(async () => {})
  bufferSourceStarts = 0
  oscillatorStarts = 0

  constructor() {
    MockAudioContext.instances.push(this)
  }

  createBuffer(_channels: number, length: number) {
    return {
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer
  }

  createBufferSource() {
    const node = {
      ...createAudioNodeMock(),
      buffer: null as AudioBuffer | null,
      start: vi.fn(() => { this.bufferSourceStarts++ }),
      stop: vi.fn(),
    }
    return node as unknown as AudioBufferSourceNode
  }

  createBiquadFilter() {
    return {
      ...createAudioNodeMock(),
      type: 'lowpass',
      frequency: createAudioParamMock(),
      Q: createAudioParamMock(),
    } as unknown as BiquadFilterNode
  }

  createGain() {
    return {
      ...createAudioNodeMock(),
      gain: createAudioParamMock(),
    } as unknown as GainNode
  }

  createOscillator() {
    const node = {
      ...createAudioNodeMock(),
      type: 'sine',
      frequency: createAudioParamMock(),
      start: vi.fn(() => { this.oscillatorStarts++ }),
      stop: vi.fn(),
    }
    return node as unknown as OscillatorNode
  }
}

describe('transition-sfx helper', () => {
  beforeEach(() => {
    MockAudioContext.instances = []
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    })
  })

  afterEach(() => {
    if (originalAudioContextDescriptor) {
      Object.defineProperty(window, 'AudioContext', originalAudioContextDescriptor)
    }
    else {
      Reflect.deleteProperty(window, 'AudioContext')
    }
    vi.restoreAllMocks()
  })

  it('extracts exactly the authored static and sfx cues from the structured transition lines', () => {
    expect(transitionSfxCues(CINEMATIC_SEGMENTS[4].transitionLore ?? [])).toEqual([
      { effect: 'bulkhead-knock' },
      { effect: 'bulkhead-response' },
    ])

    expect(transitionSfxCues(CINEMATIC_SEGMENTS[3].transitionLore ?? [])).toEqual([
      { effect: 'static' },
    ])
  })

  it('plays each transition key only once but replays on a new transition entry', async () => {
    const player = createTransitionSfxPlayer()

    await player.playTransition('segment-4-entry-1', CINEMATIC_SEGMENTS[4].transitionLore ?? [])
    const [context] = MockAudioContext.instances
    const firstPassOscillators = context.oscillatorStarts

    await player.playTransition('segment-4-entry-1', CINEMATIC_SEGMENTS[4].transitionLore ?? [])
    expect(context.oscillatorStarts).toBe(firstPassOscillators)

    await player.playTransition('segment-4-entry-2', CINEMATIC_SEGMENTS[4].transitionLore ?? [])

    expect(firstPassOscillators).toBeGreaterThan(0)
    expect(context.oscillatorStarts).toBe(firstPassOscillators * 2)
    player.destroy()
  })

  it('silently skips playback when the audio context stays blocked', async () => {
    class BlockedAudioContext extends MockAudioContext {
      override state: AudioContextState = 'suspended'
      override resume = vi.fn(async () => {
        throw new Error('blocked')
      })
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: BlockedAudioContext,
    })
    const player = createTransitionSfxPlayer()

    await expect(player.playTransition('segment-5-entry-1', CINEMATIC_SEGMENTS[5].transitionLore ?? [])).resolves.toBeUndefined()

    const [context] = BlockedAudioContext.instances
    expect(context?.bufferSourceStarts ?? 0).toBe(0)
    expect(context?.oscillatorStarts ?? 0).toBe(0)
    player.destroy()
  })
})
