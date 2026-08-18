import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ServerFeatures from '../components/server/ServerFeatures.vue'

function mountFeatures() {
  return mount(ServerFeatures)
}

describe('serverFeatures.vue', () => {
  it('renders all system extension cards with names and links', () => {
    const wrapper = mountFeatures()

    const grids = wrapper.findAll('.app-grid')
    const cards = grids[0].findAll('.app-card')
    expect(cards).toHaveLength(11)

    const names = cards.map(c => c.get('.app-name').text())
    expect(names).toEqual([
      'Falco',
      'KubeVirt',
      'KubeStellar',
      'k3s',
      'Inspektor Gadget',
      'kured',
      'Podman',
      'Docker',
      'Tailscale',
      'Incus',
      'ZFS',
    ])

    // All cards are external links
    cards.forEach((card) => {
      expect(card.attributes('target')).toBe('_blank')
      expect(card.attributes('rel')).toBe('noopener noreferrer')
      expect(card.attributes('href')).toBeTruthy()
    })
  })

  it('applies CNCF tier badges and CSS classes', () => {
    const wrapper = mountFeatures()

    const graduatedCards = wrapper.findAll('.app-card.graduated')
    expect(graduatedCards).toHaveLength(1)
    expect(graduatedCards[0].get('.app-badge.graduated').text()).toBe('CNCF Graduated')

    const incubatingCards = wrapper.findAll('.app-card.incubating')
    expect(incubatingCards).toHaveLength(2)
    expect(incubatingCards.map(card => card.get('.app-name').text())).toEqual(['KubeVirt', 'KubeStellar'])

    const sandboxCards = wrapper.findAll('.app-card.sandbox')
    expect(sandboxCards).toHaveLength(4)
    expect(sandboxCards.map(card => card.get('.app-name').text())).toEqual([
      'k3s',
      'Inspektor Gadget',
      'kured',
      'Podman',
    ])
  })

  it('renders AI client cards with org badges', () => {
    const wrapper = mountFeatures()

    const allGrids = wrapper.findAll('.app-grid')
    const clientGrid = allGrids[1]

    const clientNames = clientGrid.findAll('.app-name').map(n => n.text())
    expect(clientNames).toEqual(['Goose', 'linux-mcp-server'])

    const badges = clientGrid.findAll('.app-badge').map(b => b.text())
    expect(badges).toEqual(['Agentic AI Foundation', 'RHEL Lightspeed'])
  })

  it('renders the RHEL Lightspeed attribution row', () => {
    const wrapper = mountFeatures()

    const lightspeedRow = wrapper.get('.lightspeed-row')
    expect(lightspeedRow.text()).toContain('RHEL Lightspeed')
    expect(lightspeedRow.get('a').attributes('href')).toContain('redhat.com')
  })

  it('cards without CNCF tier get no badge element', () => {
    const wrapper = mountFeatures()

    // Docker, Tailscale, Incus and ZFS have no CNCF tier
    const otherCards = wrapper.findAll('.app-card.other')
    // Guard against the selector silently matching nothing
    expect(otherCards).toHaveLength(4)
    otherCards.forEach((card) => {
      expect(card.find('.app-badge').exists()).toBe(false)
    })
  })
})
