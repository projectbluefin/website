import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import Navigation from '../components/Navigation.vue'
import { setLocale } from '../composables/useLocale'
import { i18n } from '../locales/schema'

const section = ref('null')
const visibleSection = computed(() => section.value)
const originalScrollIntoView = Element.prototype.scrollIntoView
const originalScrollTo = window.scrollTo

function mountNavigation() {
  return mount(Navigation, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      provide: { visibleSection },
    },
  })
}

function setScrollGeometry(scrollY: number, scrollHeight: number, innerHeight: number) {
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true, configurable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
}

describe('navigation.vue', () => {
  beforeEach(() => {
    section.value = 'null'
    Element.prototype.scrollIntoView = vi.fn()
    window.scrollTo = vi.fn()
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView
    window.scrollTo = originalScrollTo
    document.body.innerHTML = ''
    setLocale('en-US')
    // happy-dom defaults; tests that override scroll geometry must not leak it
    setScrollGeometry(0, 0, 768)
  })

  it('renders one translated link per section', () => {
    const wrapper = mountNavigation()

    const links = wrapper.findAll('nav ul li a')
    expect(links).toHaveLength(5)
    expect(links.map(link => link.attributes('href'))).toEqual([
      '#scene-users',
      '#scene-developers',
      '#scene-mission',
      '#scene-picker',
      '#scene-community',
    ])
    expect(links.map(link => link.text())).toEqual([
      'For You',
      'For Devs',
      'Our Mission',
      'Try Out',
      'Community',
    ])
    wrapper.unmount()
  })

  it('marks the injected visible section as active', async () => {
    const wrapper = mountNavigation()

    expect(wrapper.find('a.active').exists()).toBe(false)
    expect(wrapper.get('.bg').attributes('style')).toContain('opacity: 0')

    section.value = '#scene-mission'
    await nextTick()

    expect(wrapper.get('a[href="#scene-mission"]').classes()).toContain('active')
    expect(wrapper.get('.bg').attributes('style')).toContain('opacity: 1')
    wrapper.unmount()
  })

  it('scrolls to the target section when a link is clicked', async () => {
    const target = document.createElement('div')
    target.id = 'scene-users'
    document.body.appendChild(target)

    const wrapper = mountNavigation()
    await wrapper.get('a[href="#scene-users"]').trigger('click')

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    wrapper.unmount()
  })

  it('reveals the scroll-up button near the page bottom and scrolls to top on click', async () => {
    const wrapper = mountNavigation()

    expect(wrapper.find('button.btn-up').exists()).toBe(false)

    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    const buttonUp = wrapper.get('button.btn-up')
    await buttonUp.trigger('click')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    wrapper.unmount()
  })

  it('hides the scroll-up button again after scrolling away from the bottom', async () => {
    const wrapper = mountNavigation()

    // Near the bottom: 4500 >= 5000 - 1000 - 256
    setScrollGeometry(4500, 5000, 1000)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.find('button.btn-up').exists()).toBe(true)

    setScrollGeometry(100, 5000, 1000)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.find('button.btn-up').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders locale-driven labels that follow the active locale', async () => {
    const wrapper = mountNavigation()
    expect(wrapper.get('a[href="#scene-users"]').text()).toContain('For You')

    setLocale('de-DE')
    await nextTick()

    expect(wrapper.get('a[href="#scene-users"]').text()).toContain('Für Dich')
    expect(wrapper.get('a[href="#scene-mission"]').text()).toContain('Unsere Mission')
    wrapper.unmount()
  })

  it('positions the section indicator under the visible section', async () => {
    const wrapper = mountNavigation()

    section.value = '#scene-mission'
    await nextTick()

    // The indicator offset derives from the link's index among the ul's
    // childNodes; the third of five links sits at (3 - 1) * 20% = 40%.
    expect(wrapper.get('.bg').attributes('style')).toContain('left: 40%')
    expect(wrapper.get('.bg').attributes('style')).toContain('width: 20%')

    section.value = '#scene-community'
    await nextTick()
    expect(wrapper.get('.bg').attributes('style')).toContain('left: 80%')
    wrapper.unmount()
  })

  it('marks no link active when the visible section has no matching link', async () => {
    const wrapper = mountNavigation()

    section.value = '#scene-does-not-exist'
    await nextTick()

    expect(wrapper.find('a.active').exists()).toBe(false)
    wrapper.unmount()
  })
})
