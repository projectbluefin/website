import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SectionPicker from '../components/sections/SectionPicker.vue'
import { SERVER_VERSIONS } from '../data/server-versions'
import { i18n } from '../locales/schema'

const wrappers: ReturnType<typeof mount>[] = []

function mountPicker(classicStatus: 'verified' | 'unavailable' = 'verified') {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.endsWith('/dakota-versions.json')) {
      return {
        ok: true,
        json: async () => ({
          checkedAt: '2026-08-25T00:00:00.000Z',
          status: 'verified',
          sources: [],
          packages: {
            kernel: '7.0.7',
            gnome: '50.2',
            mesa: '26.0.6',
            systemd: '260.2',
            podman: '5.8.2',
            pipewire: '1.6.1',
            flatpak: '1.16.6',
            bootc: '1.15.2',
            nvidia: '595.71.05'
          }
        })
      }
    }
    if (input.endsWith('/stream-versions.yml')) {
      return {
        ok: true,
        text: async () => `stable:
  status: ${classicStatus}
  pipewire: 1.4.9
  gnome: 49.4
  kernel: 9.1.0
  podman: 5.6.0
  mesa: 25.2.7
  base: Fedora 44
  systemd: 258.3
  nvidia: 580.95.05
lts:
  status: verified
  kernel: 8.2.0
`
      }
    }
    throw new Error('offline')
  }))

  const wrapper = mount(SectionPicker, {
    global: {
      plugins: [i18n],
      provide: { visibleSection: ref('') }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

function versionRows(card: ReturnType<ReturnType<typeof mount>['get']>) {
  return card.findAll('.version-row').map(row => [
    row.get('.version-label').text(),
    row.get('.version-value').text()
  ])
}

describe('sectionPicker.vue', () => {
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) {
      wrapper.unmount()
    }
    vi.unstubAllGlobals()
  })

  it('keeps Classic and LTS separate from next-generation product destinations', () => {
    const wrapper = mountPicker()
    const primaryDestinations = wrapper.get('.classic-download-grid')
      .findAll('.card-box')
      .map(card => card.attributes('href'))
    const nextDestinations = wrapper.get('.next-generation-section')
      .findAll('.card-box')
      .map(card => card.attributes('href'))

    expect(new Set(primaryDestinations)).toEqual(new Set([
      'https://docs.projectbluefin.io/downloads/',
      undefined
    ]))
    expect(new Set(nextDestinations)).toEqual(new Set([
      '/dakota/',
      '/server/',
      'https://github.com/projectbluefin/utah'
    ]))
    const classic = wrapper.find('a.card-box[href="https://docs.projectbluefin.io/downloads/"]')
    expect(classic.exists()).toBe(true)
    expect(classic.get('img').attributes('alt')).toBe('Bluefin Classic')
  })

  it('keeps LTS Coming Soon and non-downloadable even if a version feed reports it verified', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const lts = wrapper.findAll('.card-box').find(card => card.find('img[alt="Bluefin LTS"]').exists())

    expect(lts).toBeDefined()
    expect(lts?.element.tagName).toBe('DIV')
    expect(lts?.attributes('href')).toBeUndefined()
    expect(lts?.get('.alpha-badge-title').text()).toBe('Coming Soon')
    expect(lts?.findAll('.version-row')).toHaveLength(0)
  })

  it('withholds unverified Classic metadata without disabling its download destination', async () => {
    const wrapper = mountPicker('unavailable')
    await flushPromises()
    const classic = wrapper.find('a.card-box[href="https://docs.projectbluefin.io/downloads/"]')

    expect(classic.exists()).toBe(true)
    expect(classic.findAll('.version-row')).toHaveLength(0)
  })

  it('renders Bluefin Server rows from its own release data, not Classic stream metadata', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const server = wrapper.get('a.card-box[href="/server/"]')

    expect(versionRows(server)).toEqual([
      ['Base OS', `FDSDK ${SERVER_VERSIONS.fdsdk}`],
      ['Kernel', SERVER_VERSIONS.kernel],
      ['systemd', SERVER_VERSIONS.systemd],
      ['Ignition', SERVER_VERSIONS.ignition],
      ['k0s', SERVER_VERSIONS.k0s],
      ['kubeadm', SERVER_VERSIONS.kubeadm],
      ['OpenZFS', SERVER_VERSIONS.zfs],
      ['NVidia Driver', SERVER_VERSIONS.nvidia]
    ])
    expect(server.text()).not.toContain('Fedora 44')
    expect(server.text()).not.toContain('9.1.0')
  })

  it('renders Classic version rows with labels in CLASSIC_KEYS order', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const classic = wrapper.get('a.card-box[href="https://docs.projectbluefin.io/downloads/"]')

    expect(versionRows(classic)).toEqual([
      ['Base OS', 'Fedora 44'],
      ['Kernel', '9.1.0'],
      ['systemd', '258.3'],
      ['Mesa', '25.2.7'],
      ['GNOME', '49.4'],
      ['PipeWire', '1.4.9']
    ])
  })

  it('renders Dakota version rows with labels in DAKOTA_KEYS order', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const dakota = wrapper.get('a.card-box[href="/dakota/"]')

    expect(versionRows(dakota)).toEqual([
      ['Kernel', '7.0.7'],
      ['systemd', '260.2'],
      ['bootc', '1.15.2'],
      ['Mesa', '26.0.6'],
      ['NVidia Driver', '595.71.05'],
      ['GNOME', '50.2'],
      ['PipeWire', '1.6.1']
    ])
  })

  it('does not display packages absent from the image SBOM or unverified sources', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const labels = wrapper.findAll('.version-label').map(label => label.text())

    for (const absent of ['Freedesktop SDK', 'Homebrew', 'Podman', 'podman', 'Flatpak', 'flatpak', 'OGC Kernel']) {
      expect(labels).not.toContain(absent)
    }
    expect(wrapper.text()).not.toContain('4593.2.1')
    expect(wrapper.text()).not.toContain('6.12.87')
    expect(wrapper.text()).not.toContain('8.2.0')
  })
})
