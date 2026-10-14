import { describe, expect, it } from 'vitest'

// Test the chip label mapping logic extracted from DakotaVersionChips.vue
const LABELS: Record<string, string> = {
  'kernel': 'Kernel',
  'gnome': 'GNOME',
  'freedesktop-sdk': 'Freedesktop SDK',
  'mesa': 'Mesa',
  'bootc': 'bootc',
  'nvidia': 'Nvidia',
  'systemd': 'systemd',
  'podman': 'Podman',
  'pipewire': 'PipeWire',
  'flatpak': 'Flatpak',
  'baseline': 'x86-64',
}

const FEATURE_KEYS = new Set(['baseline'])

function makeChips(packages: Record<string, string>) {
  return Object.entries(packages)
    .filter(([, v]) => v)
    .map(([key, value]) => ({
      label: LABELS[key] ?? key,
      value,
      isFeature: FEATURE_KEYS.has(key),
    }))
}

describe('dakotaVersionChips', () => {
  it('maps all known keys to labels', () => {
    const chips = makeChips({
      'kernel': '6.19.11',
      'gnome': '50.0',
      'freedesktop-sdk': '25.08.11',
      'mesa': '26.0.5',
      'bootc': '1.15.2',
      'nvidia': '595.71.05',
      'systemd': '260.1',
      'podman': '5.8.2',
      'pipewire': '1.6.1',
      'flatpak': '1.16.6',
      'baseline': 'x86-64-v3',
    })
    expect(chips.find(c => c.label === 'Kernel')?.value).toBe('6.19.11')
    expect(chips.find(c => c.label === 'GNOME')?.value).toBe('50.0')
    expect(chips.find(c => c.label === 'Freedesktop SDK')?.value).toBe('25.08.11')
    expect(chips.find(c => c.label === 'x86-64')?.value).toBe('x86-64-v3')
  })

  it('marks baseline as feature, others as versions', () => {
    const chips = makeChips({ kernel: '6.19.11', baseline: 'x86-64-v3' })
    expect(chips.find(c => c.label === 'x86-64')?.isFeature).toBe(true)
    expect(chips.find(c => c.label === 'Kernel')?.isFeature).toBe(false)
  })

  it('filters out null/empty values', () => {
    const chips = makeChips({ kernel: '6.19.11', gnome: '', nvidia: '595.71.05' })
    expect(chips).toHaveLength(2)
    expect(chips.find(c => c.label === 'GNOME')).toBeUndefined()
  })

  it('baseline chip is last in order', () => {
    const chips = makeChips({ kernel: '6.19.11', gnome: '50.0', baseline: 'x86-64-v3' })
    expect(chips.at(-1).label).toBe('x86-64')
  })
})
