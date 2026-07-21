import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import { useCinematicStore } from '@/stores/cinematic'

describe('media widget', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  it('drives its primary progress telemetry from the authored overall timeline while keeping segment time secondary', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.jumpToSegment(5)
    store.updateTime(10, 271, 10)

    const wrapper = mount(MediaWidget)
    const asciiProgress = wrapper.get('.wc-widget-progress-ascii')

    expect(asciiProgress.findAll('.is-filled')).toHaveLength(Math.round(store.segmentProgress * 40))
    expect(asciiProgress.findAll('.is-dino')).toHaveLength(Math.floor(Math.round(store.segmentProgress * 40) / 10))
    expect(wrapper.get('.wc-widget-progress').attributes('aria-valuenow')).toBe(String(Math.round(store.segmentProgress * 100)))
    expect(wrapper.text()).not.toContain('DEPLOYMENT: five-years-of-universal-blue')
    expect(wrapper.text()).toContain('0:10 / 4:31')
    expect(wrapper.text()).toContain('TOTAL 28:48 / 32:32')
  })
})
