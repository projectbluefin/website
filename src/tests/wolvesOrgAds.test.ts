import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import WolvesOrgAds from '@/components/wolves/cinematic/WolvesOrgAds.vue'
import {
  getWolvesOrgAdBlend,
  WOLVES_AD_FADE_SECONDS,
  WOLVES_AD_ROTATION_SECONDS,
  WOLVES_ORG_AD_PAIRS,
} from '@/data/wolves-org-ads'
import { useCinematicStore } from '@/stores/cinematic'

describe('wolves organization ad pairs', () => {
  it('starts a synchronized four-second crossfade every 30 seconds', () => {
    expect(WOLVES_AD_ROTATION_SECONDS).toBe(30)
    expect(WOLVES_AD_FADE_SECONDS).toBe(4)
    expect(getWolvesOrgAdBlend(0).opacities).toEqual([1, 0])
    expect(getWolvesOrgAdBlend(29.999).opacities).toEqual([1, 0])
    expect(getWolvesOrgAdBlend(30).opacities).toEqual([1, 0])
    expect(getWolvesOrgAdBlend(32).opacities).toEqual([0.5, 0.5])
    expect(getWolvesOrgAdBlend(34).opacities).toEqual([0, 1])
    expect(getWolvesOrgAdBlend(62).opacities).toEqual([0.5, 0.5])
    expect(getWolvesOrgAdBlend(64).opacities).toEqual([1, 0])
  })

  it('pairs GNOME with KubeCon and Bazaar with two creator Ko-fi links', () => {
    expect(WOLVES_ORG_AD_PAIRS.map(pair => pair.map(ad => ad.id))).toEqual([
      ['gnome', 'kubecon'],
      ['bazaar-kolunmi', 'bazaar-alexandervanhee'],
    ])
    expect(WOLVES_ORG_AD_PAIRS[1].map(ad => ad.href)).toEqual([
      'https://ko-fi.com/kolunmi',
      'https://ko-fi.com/alexandervanhee',
    ])
  })
})

describe('wolvesOrgAds component', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders two synchronized pairs with Pair A initially visible', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1
    store.updateTime(0, 180)

    const wrapper = mount(WolvesOrgAds)

    expect(wrapper.findAll('.wc-org-ad-pair')).toHaveLength(2)
    expect(wrapper.get('.wc-org-ad-pair[data-pair="0"]').findAll('.wc-org-ad')).toHaveLength(2)
    expect(wrapper.get('.wc-org-ad-pair[data-pair="1"]').findAll('.wc-org-ad')).toHaveLength(2)
    expect(wrapper.get('.wc-org-ad-pair[data-pair="0"]').attributes('data-opacity')).toBe('1')
    expect(wrapper.get('.wc-org-ad-pair[data-pair="1"]').attributes('data-opacity')).toBe('0')
  })

  it('crossfades both slots from Pair A to Pair B using player time', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1
    const wrapper = mount(WolvesOrgAds)

    store.updateTime(32, 180)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.wc-org-ad-pair[data-pair="0"]').attributes('data-opacity')).toBe('0.5')
    expect(wrapper.get('.wc-org-ad-pair[data-pair="1"]').attributes('data-opacity')).toBe('0.5')
  })

  it('does not render ads for Part I', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 0

    const wrapper = mount(WolvesOrgAds)

    expect(wrapper.find('.wc-org-ads').exists()).toBe(false)
  })
})
