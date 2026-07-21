import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import qrDonate from '@/assets/svg/qr-donate.svg'
import qrStore from '@/assets/svg/qr-store.svg'
import WolvesQrCodes from '../components/wolves/WolvesQrCodes.vue'

describe('wolvesQrCodes.vue', () => {
  it('renders QR images from Vite imports', () => {
    const wrapper = mount(WolvesQrCodes)
    const qrImages = wrapper.findAll('.qr-image-box img')

    expect(qrImages).toHaveLength(2)
    expect(qrImages[0].attributes('src')).toBe(qrStore)
    expect(qrImages[1].attributes('src')).toBe(qrDonate)
    expect(wrapper.get('a[href="https://store.projectbluefin.io"]').text()).toContain('VISIT STORE')
    expect(wrapper.get('a[href="https://github.com/sponsors/castrojo"]').text()).toContain('DONATE')
    expect(wrapper.find('google-cast-launcher.chromecast-btn').exists()).toBe(true)
  })
})
