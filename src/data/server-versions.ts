// Bluefin Server has no version updater. Values come from the attested SPDX
// asset on the latest projectbluefin/server release (v26.10.1494); see
// docs/skills/content-maintenance/SKILL.md for the refresh recipe.
export const SERVER_VERSIONS = {
  fdsdk: '26.08',
  kernel: '7.2.11',
  systemd: '261.4',
  ignition: '2.27.0',
  k0s: '1.36.5',
  kubeadm: '1.35.10',
  containerd: '2.1.9',
  zfs: '2.4.4',
  nvidia: '595.112.07',
} as const
