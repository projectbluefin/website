import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import { useCinematicStore } from '@/stores/cinematic'

vi.mock('@/composables/useDualBufferPlayer', () => ({
  useDualBufferPlayer: () => ({
    activeSide: ref<'a' | 'b'>('a'),
    start: vi.fn(),
    togglePlay: vi.fn(),
    seekTo: vi.fn(),
    seekToRatio: vi.fn(),
    skip: vi.fn(),
    destroy: vi.fn(),
  }),
}))

describe('wolves cinematic stage status plate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the generic theater and ads while hiding Wolves-only presentation', async () => {
    const store = useCinematicStore()
    store.loadExperience({
      id: 'album-test',
      title: 'Album Test',
      artwork: 'album.jpg',
      segments: [{
        id: 'album-track-1',
        kind: 'youtube',
        youtubeId: 'album-track-1',
        chapter: 'ALBUM',
        title: 'Track One',
        artist: 'Artist',
        artwork: 'track.jpg',
        durationSeconds: 120,
      }, {
        id: 'album-track-2',
        kind: 'youtube',
        youtubeId: 'album-track-2',
        chapter: 'ALBUM',
        title: 'Track Two',
        artist: 'Artist',
        artwork: 'track-2.jpg',
        durationSeconds: 120,
      }],
    })
    store.enterCinematic()
    store.segmentIndex = 1

    const wrapper = mount(CinematicStage, {
      global: {
        stubs: {
          TheaterExperience: { template: '<div class="theater-experience-stub" />' },
          WolvesOrgAds: { template: '<div class="org-ads-stub" />' },
          Nameplate: true,
          CinematicCaptions: true,
          CinematicTransition: true,
        },
      },
    })

    expect(wrapper.find('.theater-experience-stub').exists()).toBe(true)
    expect(wrapper.find('.org-ads-stub').exists()).toBe(true)
    expect(wrapper.findAll('.wc-layer').every(layer => !layer.classes().includes('wc-layer--audio-only'))).toBe(true)
  })

  it('keeps Track 0 communications when the slide deck reports a people title', async () => {
    const store = useCinematicStore()
    store.segmentIndex = 0
    store.updateTime(192.279, 425, 192.279)

    const wrapper = mount(CinematicStage, {
      global: {
        stubs: {
          TheaterExperience: {
            name: 'TheaterExperienceStub',
            emits: ['statusPlate'],
            template: '<div class="theater-experience-stub" />',
            mounted() {
              this.$emit('statusPlate', { detail: 'Title', label: 'The First Disciple | Upender of Antipatterns' })
            },
          },
          Nameplate: {
            name: 'NameplateStub',
            props: {
              detail: { type: String, default: '' },
              label: { type: String, default: '' },
            },
            template: '<div class="nameplate-stub">{{ detail }}|{{ label }}</div>',
          },
          CinematicCaptions: true,
          CinematicTransition: true,
          WolvesOrgAds: true,
        },
      },
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Seven Days to the Wolves|The Blue Delivers')
  })
})
