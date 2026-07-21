import gnomeQr from '@/assets/svg/qr-gnome-donate.svg'
import kdeQr from '@/assets/svg/qr-kde-donate.svg'
import qrKofiAlexanderVanHee from '@/assets/svg/qr-kofi-alexandervanhee.svg'
import qrKofiKolunmi from '@/assets/svg/qr-kofi-kolunmi.svg'
import gnomeImage from '@/assets/wolves/org-ads/gnome.svg'
import kdeImage from '@/assets/wolves/org-ads/kde.svg'

const bazaarImage = `${import.meta.env.BASE_URL}img/bazaar.svg`

export interface WolvesOrgAd {
  id: 'gnome' | 'kde' | 'bazaar-eva' | 'bazaar-alex'
  name: string
  href: string
  image: string
  imageAlt: string
  qr: string
  qrAlt: string
  supportLabel?: string
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
      supportLabel: 'Support GNOME',
    },
    {
      id: 'bazaar-eva',
      name: 'Bazaar // Eva',
      href: 'https://ko-fi.com/kolunmi',
      image: bazaarImage,
      imageAlt: 'Bazaar app store',
      qr: qrKofiKolunmi,
      qrAlt: 'QR code for Eva on Ko-fi',
      supportLabel: 'Support Eva',
    },
  ],
  [
    {
      id: 'kde',
      name: 'KDE',
      href: 'https://kde.org/donate/',
      image: kdeImage,
      imageAlt: 'KDE',
      qr: kdeQr,
      qrAlt: 'QR code for KDE donations',
      supportLabel: 'Support KDE',
    },
    {
      id: 'bazaar-alex',
      name: 'Bazaar // Alex',
      href: 'https://ko-fi.com/alexandervanhee',
      image: bazaarImage,
      imageAlt: 'Bazaar app store',
      qr: qrKofiAlexanderVanHee,
      qrAlt: 'QR code for Alex on Ko-fi',
      supportLabel: 'Support Alex',
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
