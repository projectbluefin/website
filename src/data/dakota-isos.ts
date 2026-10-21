export interface DakotaIso {
  label: string
  filename: string
}

/**
 * Dakota live ISO downloads, served from https://projectbluefin.dev/<filename>.
 *
 * Kept in the bundle rather than in public/dakota-versions.json: that file is
 * regenerated daily and reaches deploys through the live-data Actions cache,
 * which restores the previous run's copy over the checkout. An ISO bump
 * committed there would ship the old filename until the next daily refresh.
 */
export const DAKOTA_ISOS: readonly DakotaIso[] = [
  { label: 'Download ISO', filename: 'dakota-live-alpha6.iso' },
]
