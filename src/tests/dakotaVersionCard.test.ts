import type { DakotaVersions } from '../composables'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock getDakotaVersions to bypass the module-level singleton cache
const getDakotaVersionsMock = vi.fn<() => Promise<DakotaVersions>>()
vi.mock('../composables', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../composables')>()
  return { ...orig, getDakotaVersions: () => getDakotaVersionsMock() }
})

// Import after mock is set up
const { default: DakotaVersionCard } = await import('../components/dakota/DakotaVersionCard.vue')

const FULL_VERSIONS: DakotaVersions = {
  generatedAt: '2026-08-01T00:00:00Z',
  isos: [
    { label: 'Download ISO', filename: 'dakota-live-alpha4.iso' },
    { label: 'Download DX', filename: 'dakota-dx-live-alpha4.iso' },
  ],
  packages: {
    'kernel': '6.19.11',
    'gnome': '50.0',
    'mesa': '26.0.5',
    'nvidia': '595.71',
    'freedesktop-sdk': '25.08',
    'bootc': '1.1.5',
  },
}

function mountCard() {
  return mount(DakotaVersionCard)
}

describe('dakotaVersionCard.vue', () => {
  afterEach(() => {
    getDakotaVersionsMock.mockReset()
  })

  it('renders version rows from fetched data', async () => {
    getDakotaVersionsMock.mockResolvedValue(FULL_VERSIONS)

    const wrapper = mountCard()
    await flushPromises()

    const rows = wrapper.findAll('.version-row')
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.map(r => r.get('.version-label').text())).toContain('Kernel')
    expect(rows.map(r => r.get('.version-label').text())).toContain('GNOME')
    expect(rows.find(r => r.get('.version-label').text() === 'Kernel')!
      .get('.version-value').text()).toBe('6.19.11')
  })

  it('renders download entries from fetched ISO data', async () => {
    getDakotaVersionsMock.mockResolvedValue(FULL_VERSIONS)

    const wrapper = mountCard()
    await flushPromises()

    const entries = wrapper.findAll('.download-entry')
    expect(entries).toHaveLength(2)

    const firstDl = entries[0].get('a.entry-dl')
    expect(firstDl.text()).toContain('Download ISO')
    expect(firstDl.attributes('href')).toBe('https://projectbluefin.dev/dakota-live-alpha4.iso')

    const firstChecksum = entries[0].get('a.entry-checksum')
    expect(firstChecksum.attributes('href')).toBe('https://projectbluefin.dev/dakota-live-alpha4.iso-CHECKSUM')

    expect(entries[0].get('.entry-filename').text()).toBe('dakota-live-alpha4.iso')
  })

  it('uses fallback ISOs when versions have no isos field', async () => {
    getDakotaVersionsMock.mockResolvedValue({
      generatedAt: '2026-08-01',
      packages: {},
    })

    const wrapper = mountCard()
    await flushPromises()

    const entries = wrapper.findAll('.download-entry')
    expect(entries).toHaveLength(1)
    expect(entries[0].get('a.entry-dl').text()).toContain('Download ISO')
  })

  it('shows no version rows when fetch fails (versions stays null)', async () => {
    getDakotaVersionsMock.mockRejectedValue(new Error('network error'))

    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.findAll('.version-row')).toHaveLength(0)
    expect(wrapper.find('.version-info').exists()).toBe(false)
  })

  it('still renders fallback download when fetch fails', async () => {
    getDakotaVersionsMock.mockRejectedValue(new Error('network error'))

    const wrapper = mountCard()
    await flushPromises()

    // FALLBACK_ISOS kicks in because versions.value?.isos is undefined
    const entries = wrapper.findAll('.download-entry')
    expect(entries).toHaveLength(1)
    expect(entries[0].get('a.entry-dl').text()).toContain('Download ISO')
  })

  it('renders the alpha badge', () => {
    getDakotaVersionsMock.mockResolvedValue(FULL_VERSIONS)

    const wrapper = mountCard()
    expect(wrapper.get('.alpha-badge-title').text()).toContain('Alpha')
    expect(wrapper.get('.alpha-badge-sub').text()).toContain('precautions')
  })

  it('filters version rows to known labels only', async () => {
    getDakotaVersionsMock.mockResolvedValue({
      ...FULL_VERSIONS,
      packages: {
        ...FULL_VERSIONS.packages,
        unknownPackage: '1.0.0',
      },
    })

    const wrapper = mountCard()
    await flushPromises()

    const labels = wrapper.findAll('.version-row').map(r => r.get('.version-label').text())
    expect(labels).not.toContain('unknownPackage')
  })
})
