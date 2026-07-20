import gnomeQr from '@/assets/svg/qr-gnome-donate.svg'
import qrKofiAlexanderVanHee from '@/assets/svg/qr-kofi-alexandervanhee.svg'
import qrKofiKolunmi from '@/assets/svg/qr-kofi-kolunmi.svg'
import kubeconQr from '@/assets/svg/qr-kubecon-japan-2026.svg'
import gnomeImage from '@/assets/wolves/org-ads/gnome.svg'
import kubeconImage from '@/assets/wolves/org-ads/kubecon-japan-2026.png'

const bazaarImage = `${import.meta.env.BASE_URL}img/bazaar.svg`

export interface WolvesOrgAdQr {
  qr: string
  qrAlt: string
  maintainer: string
}

export interface WolvesOrgAd {
  id: 'gnome' | 'kubecon' | 'bazaar'
  name: string
  href: string
  image: string
  imageAlt: string
  qr: string
  qrAlt: string
  qrOptions?: readonly WolvesOrgAdQr[]
}

export const WOLVES_AD_ROTATION_SECONDS = 30
export const WOLVES_AD_FADE_SECONDS = 4

export const WOLVES_ORG_AD_PAIRS = [
  [
    {
      id: 'gnome',
      name: 'GNOME',
      href: 'https://donate.gnome.org/',
      image: gnomeImage,
      imageAlt: 'GNOME',
      qr: gnomeQr,
      qrAlt: 'QR code for GNOME donations',
      qrOptions: undefined,
    },
    {
      id: 'kubecon',
      name: 'KubeCon CloudNativeCon Japan 2026',
      href: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-japan/?utm_source=artifacthub&utm_campaign=KubeCon-Japan-2026',
      image: kubeconImage,
      imageAlt: 'KubeCon CloudNativeCon Japan 2026',
      qr: kubeconQr,
      qrAlt: 'QR code for KubeCon CloudNativeCon Japan 2026',
      qrOptions: undefined,
    },
  ],
  [
    {
      id: 'bazaar',
      name: 'Bazaar',
      href: 'https://usebazaar.com',
      image: bazaarImage,
      imageAlt: 'Bazaar app store',
      qr: qrKofiKolunmi,
      qrAlt: 'QR code for Kolunmi on Ko-fi',
      qrOptions: [
        { qr: qrKofiKolunmi, qrAlt: 'QR code for Kolunmi on Ko-fi', maintainer: 'Kolunmi' },
        { qr: qrKofiAlexanderVanHee, qrAlt: 'QR code for Alexander van Hee on Ko-fi', maintainer: 'Alexander van Hee' },
      ],
    },
  ],
] as const satisfies readonly (readonly WolvesOrgAd[])[]

export function getWolvesOrgAdBlend(elapsedSeconds: number) {
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0
  if (safeElapsed < WOLVES_AD_ROTATION_SECONDS) {
    return {
      opacities: [1, 0] as const,
      interactivePairIndex: 0 as const,
    }
  }

  const interval = Math.floor(safeElapsed / WOLVES_AD_ROTATION_SECONDS)
  const currentPairIndex = (interval % 2) as 0 | 1
  const previousPairIndex = (1 - currentPairIndex) as 0 | 1
  const progress = Math.min(
    1,
    (safeElapsed % WOLVES_AD_ROTATION_SECONDS) / WOLVES_AD_FADE_SECONDS,
  )
  const opacities: [number, number] = [0, 0]
  opacities[previousPairIndex] = 1 - progress
  opacities[currentPairIndex] = progress

  return {
    opacities,
    interactivePairIndex: progress < 0.5 ? previousPairIndex : currentPairIndex,
  }
}
