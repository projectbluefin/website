import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SectionContributors from '../components/sections/SectionContributors.vue'
import { i18n } from '../locales/schema'

interface Contributor {
  id: number
  login: string
  html_url: string
  avatar_url: string
}

function mockFetch(handler: (url: string) => Promise<{ ok: boolean, status: number, json: () => Promise<unknown> }>) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mountContributors() {
  return mount(SectionContributors, { global: { plugins: [i18n] } })
}

describe('sectionContributors.vue', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the loading state before data arrives', async () => {
    mockFetch(() => new Promise(() => {}))
    const wrapper = mountContributors()

    expect(wrapper.get('.contributors-state').text()).toContain('Loading contributors...')
    expect(wrapper.find('.contributor-grid').exists()).toBe(false)
  })

  it('renders the i18n copy and both call-to-action links pointing to projectbluefin', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }))
    const wrapper = mountContributors()

    const heading = wrapper.get('.contributors-header h2').text()
    expect(heading).toBe(i18n.global.t('Community.Contribute.Tag'))
    expect(heading).not.toContain('Community.')

    const buttons = wrapper.findAll('.contributors-button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('href')).toBe('https://github.com/projectbluefin')
    expect(buttons[1].attributes('href')).toBe('https://docs.projectbluefin.io/donations')
    buttons.forEach((button) => {
      expect(button.attributes('target')).toBe('_blank')
      expect(button.attributes('rel')).toBe('noopener noreferrer')
    })
    await flushPromises()
  })

  it('renders circular avatar images and profile links for all contributors', async () => {
    const fixture: Contributor[] = [
      { id: 1, login: 'alice', html_url: 'https://github.com/alice', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
      { id: 2, login: 'bob', html_url: 'https://github.com/bob', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4' },
    ]
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => fixture,
    }))
    const wrapper = mountContributors()
    await flushPromises()

    const profiles = wrapper.findAll('.contributor-profile')
    expect(profiles).toHaveLength(2)

    const names = wrapper.findAll('.contributor-name').map(n => n.text())
    expect(names).toEqual(['alice', 'bob'])

    const avatars = wrapper.findAll('.contributor-avatar')
    expect(avatars).toHaveLength(2)
    expect(avatars[0].attributes('src')).toBe('https://avatars.githubusercontent.com/u/1?v=4&s=160')
    expect(avatars[0].attributes('width')).toBe('80')
    expect(avatars[0].attributes('height')).toBe('80')
    expect(avatars[0].attributes('loading')).toBe('lazy')

    expect(profiles[0].attributes('href')).toBe('https://github.com/alice')
    expect(profiles[0].attributes('target')).toBe('_blank')
    expect(profiles[0].attributes('rel')).toBe('noopener noreferrer')
  })

  it('shows the unavailable state when the endpoint returns an empty array', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }))
    const wrapper = mountContributors()
    await flushPromises()

    const state = wrapper.get('.contributors-state')
    expect(state.text()).toContain('The contributor list is unavailable right now.')
    expect(state.get('a').attributes('href')).toBe('https://github.com/projectbluefin')
    expect(wrapper.find('.contributor-grid').exists()).toBe(false)
  })

  it('shows the unavailable state when fetch rejects', async () => {
    mockFetch(async () => {
      throw new Error('Network error')
    })
    const wrapper = mountContributors()
    await flushPromises()

    const state = wrapper.get('.contributors-state')
    expect(state.text()).toContain('The contributor list is unavailable right now.')
    expect(wrapper.find('.contributor-grid').exists()).toBe(false)
  })

  it('shows the unavailable state when fetch returns a non-200 status', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }))
    const wrapper = mountContributors()
    await flushPromises()

    const state = wrapper.get('.contributors-state')
    expect(state.text()).toContain('The contributor list is unavailable right now.')
    expect(wrapper.find('.contributor-grid').exists()).toBe(false)
  })

  it('marks the contributor list as an aria-live region and toggles aria-busy', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { id: 10, login: 'dev', html_url: 'https://github.com/dev', avatar_url: 'https://avatars.githubusercontent.com/u/10' },
      ],
    }))
    const wrapper = mountContributors()
    expect(wrapper.get('.contributors-list').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.contributors-list').attributes('aria-busy')).toBe('true')

    await flushPromises()
    expect(wrapper.get('.contributors-list').attributes('aria-busy')).toBe('false')
  })
})
