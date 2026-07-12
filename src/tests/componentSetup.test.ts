import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('vue component test harness', () => {
  it('mounts an interactive component', async () => {
    const wrapper = mount({
      data: () => ({ count: 0 }),
      template: '<button @click="count++">{{ count }}</button>',
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toBe('1')
  })
})
