import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loreEntries } from '../components/wolves/lore'
import WolvesLoreColumn from '../components/wolves/WolvesLoreColumn.vue'

describe('wolvesLoreColumn Logic', () => {
  it('renders the artifact selected by the soundtrack timeline', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: 'arthur-c-clarke-3',
        duration: 20,
      },
    })

    vi.advanceTimersByTime(5_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('It is a bitter thought, but you must face it.')
  })

  it('types quote source characters without generated glyphs', async () => {
    vi.useFakeTimers()
    const entry = loreEntries.find(entry => entry.id === 'arthur-c-clarke-3')
    if (!entry || entry.type !== 'quote') {
      throw new Error('Expected a quote fixture')
    }

    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: entry.id,
        duration: 1,
      },
    })

    vi.advanceTimersByTime(50)
    await wrapper.vm.$nextTick()

    const renderedQuote = wrapper.find('.lore-quote-text').text()
    expect(renderedQuote).not.toBe('')
    expect(entry.data.quote.startsWith(renderedQuote)).toBe(true)
  })

  it('types transmission source characters without generated glyphs', async () => {
    vi.useFakeTimers()
    const entry = loreEntries.find(entry => entry.id === 'lorem-prologue-1')
    if (!entry || entry.type !== 'conversation') {
      throw new Error('Expected a transmission fixture')
    }

    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: entry.id,
        duration: 0.01,
      },
    })

    vi.advanceTimersByTime(50)
    await wrapper.vm.$nextTick()

    const renderedMessage = wrapper.find('.conversation-message p').text()
    expect(renderedMessage).not.toBe('')
    expect(entry.data.messages[0].text.startsWith(renderedMessage)).toBe(true)
  })

  it('renders The Children sound effects with the established SFX treatment', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: 'lorem-prologue-2',
        duration: 0.01,
      },
    })

    await wrapper.find('.quote-viewport').trigger('click')

    const soundEffects = wrapper.findAll('.sfx-message')
    expect(soundEffects).toHaveLength(3)
    expect(soundEffects.map(effect => effect.find('.sfx-text').text())).toEqual([
      'static noise and distant explosions',
      'heavy static',
      'connection dropping',
    ])
    expect(soundEffects.every(effect => !effect.find('.conversation-message-header').exists())).toBe(true)
  })

  it('keeps two mascot layers mounted during rotation', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: 'arthur-c-clarke-3',
        duration: 20,
      },
    })

    expect(wrapper.findAll('.mascot-avatar')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(15_000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.mascot-avatar-current').classes()).toContain('is-fading-out')
    expect(wrapper.find('.mascot-avatar-next').classes()).toContain('is-fading-in')
  })

  it('smoothly advances long quotes at reading beats', async () => {
    vi.useFakeTimers()
    const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo')
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: 'arthur-c-clarke-3',
        duration: 0.01,
      },
    })

    vi.advanceTimersByTime(1_000)
    await wrapper.vm.$nextTick()

    expect(scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: 'smooth',
    })
  })

  it('scrolls a completed quote after its final character renders', async () => {
    vi.useFakeTimers()
    const entry = loreEntries.find(entry => entry.id === 'arthur-c-clarke-3')
    if (!entry || entry.type !== 'quote') {
      throw new Error('Expected a quote fixture')
    }

    const renderedTextAtScroll: string[] = []
    const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo')
      .mockImplementation(function (this: HTMLElement) {
        renderedTextAtScroll.push(this.querySelector('.lore-quote-text')?.textContent ?? '')
      })
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: entry.id,
        duration: 0.01,
      },
    })

    await vi.advanceTimersByTimeAsync(1_000)

    expect(scrollTo).toHaveBeenCalled()
    expect(renderedTextAtScroll).toContain(entry.data.quote)
    wrapper.unmount()
  })

  it('holds and fades the Golden Era vision before Sarah speaks', async () => {
    vi.useFakeTimers()
    const entry = loreEntries.find(entry => entry.id === 'lorem-pursuit-1')
    if (!entry || entry.type !== 'conversation') {
      throw new Error('Expected the Golden Era transmission fixture')
    }

    const climaxMessage = entry.data.messages.find(message => message.speaker === 'BUR//S')
    if (!climaxMessage) {
      throw new Error('Expected the Golden Era vision fixture')
    }

    const vision = climaxMessage.text.slice(climaxMessage.text.indexOf('. ') + 2)
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: entry.id,
        duration: 0.01,
      },
    })

    vi.advanceTimersByTime(8_800)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain(vision)

    vi.advanceTimersByTime(50)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.climax-sentence').text()).toBe(vision)
    expect(wrapper.findAll('.conversation-message')
      .filter(message => !(message.attributes('style') ?? '').includes('display: none'))
      .map(message => message.find('.conversation-speaker').text())).not.toContain('SARAH')

    vi.advanceTimersByTime(1_050)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.conversation-message')
      .filter(message => !(message.attributes('style') ?? '').includes('display: none'))
      .map(message => message.find('.conversation-speaker').text())).toContain('SARAH')
  })

  it('keeps Golden Era dialogue visible while Sarah is still typing', async () => {
    vi.useFakeTimers()
    const entry = loreEntries.find(entry => entry.id === 'lorem-pursuit-1')
    if (!entry || entry.type !== 'conversation') {
      throw new Error('Expected the Golden Era transmission fixture')
    }

    const sarah = entry.data.messages.find(message => message.speaker === 'SARAH')
    if (!sarah) {
      throw new Error('Expected the Golden Era Sarah fixture')
    }

    const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo')
    const wrapper = mount(WolvesLoreColumn, {
      props: {
        artifactId: entry.id,
        duration: 0.01,
      },
    })

    await vi.advanceTimersByTimeAsync(9_900)
    scrollTo.mockClear()

    await vi.advanceTimersByTimeAsync(500)

    const sarahText = wrapper.findAll('.conversation-message')
      .find(message => message.find('.conversation-speaker').text() === 'SARAH')
      ?.find('p')
      .text() ?? ''
    expect(sarahText).not.toBe(sarah.text)
    expect(scrollTo).toHaveBeenCalled()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
})
