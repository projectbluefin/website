import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'

function lobbyStubs() {
  return {
    WolvesBackCatalogue: { template: '<section class="wolves-back-catalogue-stub" />' },
    WolvesCharacterGallery: { template: '<div class="wolves-character-gallery-stub" />' },
    WolvesQrCodes: { template: '<section class="wolves-qr-codes-stub" />' },
  }
}

describe('wolves cinematic lobby', () => {
  it('renders the exact Director\'s Cut teaser and button label', () => {
    const wrapper = mount(CinematicLobby, {
      global: {
        stubs: lobbyStubs(),
      },
    })

    expect(wrapper.get('.wc-lobby-directors-cut-copy').text()).toBe(
      'Bluefin\'s universe is just beginning, and its future is bleaker than presented here. Enjoy the longer original vision as it comes together:',
    )
    expect(wrapper.get('.wc-lobby-directors-cut-btn').text()).toBe(
      'SEVEN DAYS TO THE WOLVES: DIRECTOR\'S CUT',
    )
  })

  it('places the Director\'s Cut teaser before the QR codes and back catalogue', () => {
    const wrapper = mount(CinematicLobby, {
      global: {
        stubs: lobbyStubs(),
      },
    })

    const directorsCut = wrapper.get('.wc-lobby-directors-cut').element
    const qrCodes = wrapper.get('.wolves-qr-codes-stub').element
    const backCatalogue = wrapper.get('.wolves-back-catalogue-stub').element

    expect(directorsCut.compareDocumentPosition(qrCodes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(directorsCut.compareDocumentPosition(backCatalogue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('emits enterDirectorsCut when the Director\'s Cut button is clicked', async () => {
    const wrapper = mount(CinematicLobby, {
      global: {
        stubs: lobbyStubs(),
      },
    })

    await wrapper.get('.wc-lobby-directors-cut-btn').trigger('click')

    expect(wrapper.emitted('enterDirectorsCut')).toHaveLength(1)
  })
})
