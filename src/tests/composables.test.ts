import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const width = ref(0)

describe('composables', () => {
  beforeEach(() => {
    width.value = 0
    vi.resetModules()
    vi.doMock('@vueuse/core', () => ({
      useWindowSize: () => ({ width }),
    }))
  })

  afterEach(() => {
    vi.doUnmock('@vueuse/core')
    vi.resetModules()
  })

  it('uses 956px as the tablet breakpoint', async () => {
    const { IS_TABLET } = await import('../composables')

    width.value = 956
    expect(IS_TABLET.value).toBe(true)

    width.value = 957
    expect(IS_TABLET.value).toBe(false)
  })

  it('updates the responsive helper when the width changes', async () => {
    const { IS_TABLET } = await import('../composables')

    width.value = 1200
    expect(IS_TABLET.value).toBe(false)

    width.value = 640
    expect(IS_TABLET.value).toBe(true)
  })
})
