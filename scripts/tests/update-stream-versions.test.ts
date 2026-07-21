import { describe, expect, it, vi } from 'vitest'
import { buildStreamVersionData, createHeader, extractSbomPackageVersions, latestPv } from '../update-stream-versions.js'

describe('update-stream-versions helpers', () => {
  it('returns package versions for the latest release in a stream', () => {
    expect(latestPv({
      'bluefin-stable': {
        releases: {
          latest: {
            packageVersions: {
              fedora: 'F42',
              kernel: '6.13.0',
            },
          },
        },
      },
    }, 'bluefin-stable')).toEqual({
      fedora: 'F42',
      kernel: '6.13.0',
    })
  })

  it('builds the public stream versions document from SBOM streams', () => {
    expect(buildStreamVersionData({
      'bluefin-stable': {
        releases: {
          latest: {
            packageVersions: {
              fedora: 'F42',
              kernel: '6.13.0',
              gnome: '48.1',
              mesa: '25.0.1',
            },
          },
        },
      },
      'bluefin-nvidia-open-stable': {
        releases: {
          latest: {
            packageVersions: {
              nvidia: '570.124.06',
            },
          },
        },
      },
      'bluefin-lts': {
        releases: {
          latest: {
            packageVersions: {
              kernel: '6.12.0',
              gnome: '47.5',
              mesa: '24.3.4',
            },
          },
        },
      },
      'bluefin-lts-hwe': {
        releases: {
          latest: {
            packageVersions: {
              kernel: '6.14.0',
            },
          },
        },
      },
      'bluefin-gdx-lts': {
        releases: {
          latest: {
            packageVersions: {
              nvidia: '550.90.07',
            },
          },
        },
      },
    })).toEqual({
      stable: {
        base: 'Fedora 42',
        kernel: '6.13.0',
        gnome: '48.1',

        mesa: '25.0.1',
        nvidia: 'unknown',
      },
      lts: {
        base: 'CentOS Stream 10',
        kernel: '6.12.0',
        gnome: '47.5',
        mesa: '24.3.4',
        hwe: '6.14.0',
        nvidia: '550.90.07',
      },
    })
  })

  it('skips a newest release record with no package versions', () => {
    expect(latestPv({
      'bluefin-stable': {
        releases: {
          'stable-20260606': {},
          'stable-20260531': {
            packageVersions: {
              kernel: '7.0.8-200.fc44',
              gnome: '50.1',
              mesa: '26.0.8',
            },
          },
        },
      },
    }, 'bluefin-stable')).toEqual({
      kernel: '7.0.8-200.fc44',
      gnome: '50.1',
      mesa: '26.0.8',
    })
  })

  it('extracts package versions from the OCI SBOM artifact shape', () => {
    expect(extractSbomPackageVersions({ artifacts: [
      { name: 'kernel-core', version: '7.0.12-201.fc44' },
      { name: 'gnome-shell', version: '50.3-1.fc44' },
      { name: 'mesa', version: '26.1.4-1.fc44' },
      { name: 'mesa', version: '26.1.4-4.fc44' },
      { name: 'systemd', version: '259.7-1.fc44' },
      { name: 'podman', version: '5:5.8.4-1.fc44' },
      { name: 'pipewire', version: '1.6.8-1.fc44' },
      { name: 'flatpak', version: '1.18.0-1.fc44' },
    ] })).toEqual({
      base: 'Fedora 44',
      kernel: '7.0.12-201',
      gnome: '50.3-1',
      mesa: '26.1.4-4',
      systemd: '259.7-1',
      podman: '5.8.4-1',
      pipewire: '1.6.8-1',
      flatpak: '1.18.0-1',
    })
  })

  it('falls back to defaults when streams are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(buildStreamVersionData({})).toEqual({
      stable: {
        base: 'Fedora 44',
        kernel: 'unknown',
        gnome: 'unknown',
        mesa: 'unknown',
        nvidia: 'unknown',
      },
      lts: {
        base: 'CentOS Stream 10',
        kernel: 'unknown',
        gnome: 'unknown',
        mesa: 'unknown',
        hwe: 'unknown',
        nvidia: 'unknown',
      },
    })

    expect(warn).toHaveBeenCalled()
  })

  it('creates the generated header with a stable date', () => {
    expect(createHeader('2025-02-14')).toContain('# Last updated: 2025-02-14')
  })
})
