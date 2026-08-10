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

  it('renders the standard splash title and a centered frame with no offset layout class', () => {
    const wrapper = mount(CinematicLobby, {
      global: {
        stubs: lobbyStubs(),
      },
    })

    expect(wrapper.get('.wc-lobby-title').text()).toBe('SEVEN DAYSTO THE WOLVES')
    expect(wrapper.get('.wc-lobby-frame').classes()).not.toContain('wc-lobby-frame--left')
  })

  it('places the Director\'s Cut teaser immediately after Jorge\'s quote, after the standard CTA, and before the QR codes and back catalogue', () => {
    const wrapper = mount(CinematicLobby, {
      global: {
        stubs: lobbyStubs(),
      },
    })

    const standardCta = wrapper.get('.wc-lobby-enter').element
    const quote = wrapper.get('.wc-lobby-quote').element
    const directorsCut = wrapper.get('.wc-lobby-directors-cut').element
    const qrCodes = wrapper.get('.wolves-qr-codes-stub').element
    const backCatalogue = wrapper.get('.wolves-back-catalogue-stub').element

    // "Immediately after" is a DOM-adjacency claim, not just document order:
    // nothing else may render between Jorge's quote and the teaser block.
    expect(quote.nextElementSibling).toBe(directorsCut)

    expect(standardCta.compareDocumentPosition(directorsCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
