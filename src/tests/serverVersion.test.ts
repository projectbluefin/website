import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ServerVersion from '../components/server/ServerVersion.vue'

const STABLE_STREAM = {
  version: '20260801',
  buildDate: '2026-08-01',
  kernel: '6.19.11',
  systemd: '260.1',
  docker: '29.1.2',
  containerd: '2.2.1',
  ignition: '2.24.0',
  etcd: '3.6.9',
}

function stubFetchJson(payload: unknown) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  }))
}

describe('serverVersion.vue', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the stable stream version, build date, and component grid', async () => {
    const fetchMock = stubFetchJson({ streams: { stable: STABLE_STREAM } })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(ServerVersion)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/server-versions.json')

    expect(wrapper.get('.release-badge').text()).toBe('Stable release')
    expect(wrapper.get('.version').text()).toBe('20260801')
    expect(wrapper.get('.meta').text()).toContain('· Built 2026-08-01')

    const components = wrapper.findAll('.component')
    expect(components.map(c => c.get('.component-label').text())).toEqual([
      'Kernel',
      'systemd',
      'containerd',
      'Docker',
      'Ignition',
      'etcd',
    ])
    expect(components.map(c => c.get('.component-value').text())).toEqual([
      '6.19.11',
      '260.1',
      '2.2.1',
      '29.1.2',
      '2.24.0',
      '3.6.9',
    ])
    expect(wrapper.find('.loading-state').exists()).toBe(false)
  })

  it('links to the GitHub releases page in a new tab', async () => {
    vi.stubGlobal('fetch', stubFetchJson({ streams: { stable: STABLE_STREAM } }))

    const wrapper = mount(ServerVersion)
    await flushPromises()

    const link = wrapper.get('a.release-link')
    expect(link.attributes('href')).toBe('https://github.com/projectbluefin/server/releases')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders a dash for missing component values', async () => {
    vi.stubGlobal('fetch', stubFetchJson({
      streams: { stable: { ...STABLE_STREAM, etcd: '' } },
    }))

    const wrapper = mount(ServerVersion)
    await flushPromises()

    const etcd = wrapper.findAll('.component')
      .find(c => c.get('.component-label').text() === 'etcd')
    expect(etcd?.get('.component-value').text()).toBe('-')
  })

  it('omits the build date suffix when buildDate is empty', async () => {
    vi.stubGlobal('fetch', stubFetchJson({
      streams: { stable: { ...STABLE_STREAM, buildDate: '' } },
    }))

    const wrapper = mount(ServerVersion)
    await flushPromises()

    expect(wrapper.get('.meta').text()).not.toContain('Built')
    expect(wrapper.get('.version').text()).toBe('20260801')
  })

  it('shows the loading state until the fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const wrapper = mount(ServerVersion)

    expect(wrapper.get('.loading-state').text()).toContain('Loading release information')
    expect(wrapper.find('.release-panel').exists()).toBe(false)
  })

  it('stays in the loading state when the fetch rejects', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(ServerVersion)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/server-versions.json')
    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.release-panel').exists()).toBe(false)
  })

  it('stays in the loading state when the response is not ok', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(ServerVersion)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/server-versions.json')
    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.release-panel').exists()).toBe(false)
  })

  it('stays in the loading state when the payload has no stable stream', async () => {
    const fetchMock = stubFetchJson({ streams: { beta: STABLE_STREAM } })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(ServerVersion)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/server-versions.json')
    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.release-panel').exists()).toBe(false)
  })
})
