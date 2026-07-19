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
    const fill = wrapper.get('.wc-widget-progress-fill')

    expect(fill.attributes('style')).toContain(`width: ${store.overallProgress * 100}%`)
    expect(wrapper.get('.wc-widget-progress').attributes('aria-valuenow')).toBe(String(Math.round(store.overallProgress * 100)))
    expect(wrapper.text()).toContain('DEPLOYMENT: five-years-of-universal-blue')
    expect(wrapper.text()).toContain(`${Math.round(store.overallProgress * 100)}%`)
    expect(wrapper.text()).toContain('0:10 / 4:31')
    expect(wrapper.text()).toContain('TOTAL 30:22 / 34:06')
  })
})
