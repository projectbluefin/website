import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ServerHighlights from '../components/server/ServerHighlights.vue'

const SERVER_VERSIONS = {
  nvidiaDrivers: [
    { label: 'Production', version: '550.120' },
    { label: 'Latest', version: '565.57' },
  ],
}

function mountHighlights() {
  return mount(ServerHighlights)
}

describe('serverHighlights.vue', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nvidia driver chips when data loads successfully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => SERVER_VERSIONS,
    })))

    const wrapper = mountHighlights()
    await flushPromises()

    const chips = wrapper.findAll('.chip.nvidia')
    expect(chips).toHaveLength(2)
    expect(chips[0].get('.chip-k').text()).toBe('Production')
    expect(chips[0].get('.chip-v').text()).toBe('550.120')
    expect(chips[1].get('.chip-k').text()).toBe('Latest')
    expect(chips[1].get('.chip-v').text()).toBe('565.57')
  })

  it('renders no nvidia chips when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network error')
    }))

    const wrapper = mountHighlights()
    await flushPromises()

    expect(wrapper.find('.nvidia-chips').exists()).toBe(false)
  })

  it('renders no nvidia chips when response has no nvidiaDrivers array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ other: 'data' }),
    })))

    const wrapper = mountHighlights()
    await flushPromises()

    expect(wrapper.find('.nvidia-chips').exists()).toBe(false)
  })

  it('renders no nvidia chips when HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
    })))

    const wrapper = mountHighlights()
    await flushPromises()

    expect(wrapper.find('.nvidia-chips').exists()).toBe(false)
  })

  it('renders static brand items with expected links', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => SERVER_VERSIONS,
    })))

    const wrapper = mountHighlights()

    const brandLinks = wrapper.findAll('.brand-title[href]')
    const hrefs = brandLinks.map(l => l.attributes('href'))
    expect(hrefs).toContain('https://freedesktop-sdk.io')
    expect(hrefs).toContain('https://github.com/NVIDIA/go-nvlib')
    expect(hrefs).toContain('https://kubestellar.io')
  })
})
