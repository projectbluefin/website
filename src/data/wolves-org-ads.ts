import flathubQr from '@/assets/svg/qr-flathub-donate.svg'
import gnomeQr from '@/assets/svg/qr-gnome-donate.svg'
import kdeQr from '@/assets/svg/qr-kde-donate.svg'
import kubeconQr from '@/assets/svg/qr-kubecon-japan-2026.svg'
import flathubImage from '@/assets/wolves/org-ads/flathub.svg'
import gnomeImage from '@/assets/wolves/org-ads/gnome.svg'
import kdeImage from '@/assets/wolves/org-ads/kde.svg'
import kubeconImage from '@/assets/wolves/org-ads/kubecon-japan-2026.png'

export interface WolvesOrgAd {
  id: 'gnome' | 'flathub' | 'kubecon' | 'kde'
  name: string
  href: string
  image: string
  imageAlt: string
  qr: string
  qrAlt: string
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
    },
    {
      id: 'kubecon',
      name: 'KubeCon CloudNativeCon Japan 2026',
      href: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-japan/?utm_source=artifacthub&utm_campaign=KubeCon-Japan-2026',
      image: kubeconImage,
      imageAlt: 'KubeCon CloudNativeCon Japan 2026',
      qr: kubeconQr,
      qrAlt: 'QR code for KubeCon CloudNativeCon Japan 2026',
    },
  ],
  [
    {
      id: 'flathub',
      name: 'Flathub',
      href: 'https://flathub.org/en/donate',
      image: flathubImage,
      imageAlt: 'Flathub',
      qr: flathubQr,
      qrAlt: 'QR code for Flathub donations',
    },
    {
      id: 'kde',
      name: 'KDE',
      href: 'https://kde.org/donate/',
      image: kdeImage,
      imageAlt: 'KDE',
      qr: kdeQr,
      qrAlt: 'QR code for KDE donations',
    },
  ],
] as const satisfies readonly [
  readonly [WolvesOrgAd, WolvesOrgAd],
  readonly [WolvesOrgAd, WolvesOrgAd],
]

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
