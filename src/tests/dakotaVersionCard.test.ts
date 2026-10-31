import type { DakotaVersions } from '../composables'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DakotaVersionCard from '../components/dakota/DakotaVersionCard.vue'
import { DAKOTA_ISOS } from '../data/dakota-isos'

// Mock getDakotaVersions to bypass the module-level singleton cache.
// vi.mock is hoisted above all imports, so the plain static import above is
// fine — the factory's reference to the mock is inside a closure that only
// runs when a test calls getDakotaVersions.
const getDakotaVersionsMock = vi.fn<() => Promise<DakotaVersions>>()
vi.mock('../composables', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../composables')>()
  return { ...orig, getDakotaVersions: () => getDakotaVersionsMock() }
})

const FULL_VERSIONS: DakotaVersions = {
  checkedAt: '2026-08-01T00:00:00Z',
  status: 'verified',
  sources: [
    { id: 'dakota', image: 'ghcr.io/projectbluefin/dakota:latest', imageDigest: 'sha256:aaa', sbomDigest: 'sha256:bbb' },
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
    // The fixture has exactly 6 known packages — an exact count catches
    // off-by-one and filter regressions that a loose bound would hide.
    expect(rows).toHaveLength(6)
    expect(rows.map(r => r.get('.version-label').text())).toContain('Kernel')
    expect(rows.map(r => r.get('.version-label').text())).toContain('GNOME')
    expect(rows.find(r => r.get('.version-label').text() === 'Kernel')!
      .get('.version-value').text()).toBe('6.19.11')
  })

  it('renders download entries from the committed ISO list', async () => {
    getDakotaVersionsMock.mockResolvedValue(FULL_VERSIONS)

    const wrapper = mountCard()
    await flushPromises()

    const entries = wrapper.findAll('.download-entry')
    expect(entries).toHaveLength(DAKOTA_ISOS.length)

    const [first] = DAKOTA_ISOS
    const firstDl = entries[0].get('a.entry-dl')
    expect(firstDl.text()).toContain(first.label)
    expect(firstDl.attributes('href')).toBe(`https://projectbluefin.dev/${first.filename}`)

    const firstChecksum = entries[0].get('a.entry-checksum')
    expect(firstChecksum.attributes('href')).toBe(`https://projectbluefin.dev/${first.filename}-CHECKSUM`)

    expect(entries[0].get('.entry-filename').text()).toBe(first.filename)
  })

  it('ignores a stale isos field left in cached dakota-versions.json', async () => {
    getDakotaVersionsMock.mockResolvedValue({
      ...FULL_VERSIONS,
      isos: [{ label: 'Download ISO', filename: 'dakota-live-alpha5.iso' }],
    } as DakotaVersions)

    const wrapper = mountCard()
    await flushPromises()

    const filenames = wrapper.findAll('.entry-filename').map(e => e.text())
    expect(filenames).toEqual(DAKOTA_ISOS.map(iso => iso.filename))
    expect(filenames).not.toContain('dakota-live-alpha5.iso')
  })

  it('shows no version rows when fetch fails (versions stays null)', async () => {
    getDakotaVersionsMock.mockRejectedValue(new Error('network error'))

    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.findAll('.version-row')).toHaveLength(0)
    expect(wrapper.find('.version-info').exists()).toBe(false)
  })

  it('still renders downloads when fetch fails', async () => {
    getDakotaVersionsMock.mockRejectedValue(new Error('network error'))

    const wrapper = mountCard()
    await flushPromises()

    const entries = wrapper.findAll('.download-entry')
    expect(entries).toHaveLength(DAKOTA_ISOS.length)
    expect(entries[0].get('.entry-filename').text()).toBe(DAKOTA_ISOS[0].filename)
  })

  it('marks Dakota as Beta with a corner ribbon', () => {
    getDakotaVersionsMock.mockResolvedValue(FULL_VERSIONS)

    const wrapper = mountCard()
    expect(wrapper.get('.corner-ribbon').text()).toBe('Beta')
    expect(wrapper.text()).not.toContain('Alpha')
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

    // Exactly the 6 known labels survive the filter — without the filter the
    // unknown package would render a 7th row with an empty label.
    const rows = wrapper.findAll('.version-row')
    expect(rows).toHaveLength(6)
    const labels = rows.map(r => r.get('.version-label').text())
    expect(labels).not.toContain('unknownPackage')
    labels.forEach(label => expect(label.length).toBeGreaterThan(0))
  })
})
