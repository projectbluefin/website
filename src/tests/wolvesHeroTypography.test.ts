import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import TheaterExperience from '@/components/wolves/cinematic/TheaterExperience.vue'
import { useCinematicStore } from '@/stores/cinematic'

describe('wolves hero typography timeline', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function renderAt(nativeTime: number) {
    const store = useCinematicStore()
    store.segmentIndex = 0
    store.updateTime(nativeTime, 425, nativeTime)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
    await nextTick()
    return wrapper
  }

  it.each([
    [345, 'welcome', 'We\'ve got your back.'],
    [347.75, 'welcome', 'You\'ll never walk alone ...'],
    [350.5, 'universal-blue', 'We are Universal Blue.'],
    [359, 'evolve', 'Evolve or die ...'],
    [405, 'legend', 'You have ascended ...'],
    [408, 'legend', 'Become Legend'],
    [425, 'legend', 'Become Legend'],
  ])('renders the exact authored cue at %s seconds', async (time, mode, text) => {
    const wrapper = await renderAt(Number(time))
    expect(wrapper.get(`.wc-thesis--${mode}`).text()).toContain(text)
  })

  it.each([344.999, 365, 404.999, 425.001])(
    'does not render readable hero text outside authored cue windows at %s',
    async (time) => {
      const wrapper = await renderAt(time)
      expect(wrapper.find('.wc-thesis-text').exists()).toBe(false)
    },
  )
})
