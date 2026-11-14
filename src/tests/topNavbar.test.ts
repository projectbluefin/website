import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import TopNavbar from '../components/TopNavbar.vue'
import { setLocale } from '../composables/useLocale'
import { i18n } from '../locales/schema'

function mountNavbar() {
  return mount(TopNavbar, {
    global: {
      plugins: [i18n],
    },
  })
}

describe('topNavbar.vue', () => {
  afterEach(() => {
    setLocale('en-US')
  })
  it('renders the brand link and desktop navigation groups', () => {
    const wrapper = mountNavbar()

    const brand = wrapper.get('a.navbar__brand')
    expect(brand.attributes('href')).toBe('/')
    const wordmark = brand.get('img.navbar__wordmark')
    expect(wordmark.attributes('src')).toMatch(/^\/brands\/bluefin-wordmark\.svg|^data:image\/svg\+xml/)
    expect(wordmark.attributes('alt')).toBe('Bluefin')

    const switchBtns = wrapper.findAll('.product-switch__btn')
    expect(switchBtns).toHaveLength(2)
    expect(switchBtns[0].text()).toBe('Bluefin')
    expect(switchBtns[1].text()).toBe('Bluefin Server')

    expect(wrapper.get('.navbar__items--right').findAll('a.navbar__link')).toHaveLength(5)
  })
  it('marks external links with target and rel while internal links stay same-tab', () => {
    const wrapper = mountNavbar()

    const docsLink = wrapper.get('a[href="https://docs.projectbluefin.io/introduction"]')
    expect(docsLink.text()).toBe('Documentation')
    expect(docsLink.attributes('target')).toBeUndefined()
    expect(docsLink.classes()).toContain('navbar__link--active')
  })

  it('toggles the mobile menu and closes it when a mobile link is clicked', async () => {
    const wrapper = mountNavbar()

    expect(wrapper.find('#navbar-mobile-menu').exists()).toBe(false)

    const toggle = wrapper.get('button.navbar__menu-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.text()).toBe('☰')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toBe('✕')

    const mobileLinks = wrapper.findAll('#navbar-mobile-menu a.navbar__mobile-link')
    expect(mobileLinks).toHaveLength(7)
    await mobileLinks[0].trigger('click')
    expect(wrapper.find('#navbar-mobile-menu').exists()).toBe(false)
  })

  it('renders the full link set in order and mirrors it into the mobile menu', async () => {
    const wrapper = mountNavbar()

    const switchHrefs = wrapper.findAll('.product-switch__btn')
      .map(link => link.attributes('href'))
    expect(switchHrefs).toEqual(['/', '/server/'])

    const rightHrefs = wrapper.get('.navbar__items--right')
      .findAll('a.navbar__link')
      .map(link => link.attributes('href'))
    expect(rightHrefs).toEqual([
      'https://docs.projectbluefin.io/introduction',
      'https://docs.projectbluefin.io/blog',
      'https://docs.projectbluefin.io/reports',
      'https://github.com/ublue-os/bluefin/discussions',
      'https://store.projectbluefin.io',
    ])

    await wrapper.get('button.navbar__menu-toggle').trigger('click')
    const mobileHrefs = wrapper.findAll('#navbar-mobile-menu a.navbar__mobile-link')
      .map(link => link.attributes('href'))
    expect(mobileHrefs).toEqual(['/', '/server/', ...rightHrefs])
  })
  it('renders locale-driven labels captured from the active locale at mount', () => {
    setLocale('de-DE')
    const wrapper = mountNavbar()

    const rightLabels = wrapper.get('.navbar__items--right')
      .findAll('a.navbar__link')
      .map(link => link.text())
    expect(rightLabels[0]).toBe('Dokumentation')
    const docsLink = wrapper.get('a[href="https://docs.projectbluefin.io/introduction"]')
    expect(docsLink.text()).toBe('Dokumentation')
    expect(docsLink.classes()).toContain('navbar__link--active')
  })

  it('exposes the mobile menu state to assistive technology', async () => {
    const wrapper = mountNavbar()
    const toggle = wrapper.get('button.navbar__menu-toggle')

    expect(toggle.attributes('aria-controls')).toBe('navbar-mobile-menu')
    expect(toggle.attributes('aria-label')).toBe('Open navigation menu')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-label')).toBe('Close navigation menu')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-label')).toBe('Open navigation menu')
    expect(wrapper.find('#navbar-mobile-menu').exists()).toBe(false)
  })

  it('rounds the product switch buttons to match their pill container', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/TopNavbar.vue'), 'utf8')
    const buttonRule = source.match(/\.product-switch__btn \{([^{}]*)/)

    expect(buttonRule?.[1]).toContain('border-radius: 9999px')
  })
})
