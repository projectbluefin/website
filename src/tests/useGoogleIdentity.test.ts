import { describe, expect, it, vi } from 'vitest'
import {
  GoogleIdentityConfigurationError,
  useGoogleIdentity,
} from '../composables/useGoogleIdentity'

describe('google Identity Services', () => {
  it('rejects missing Google client configuration before loading the provider', async () => {
    const loadScript = vi.fn()
    const identity = useGoogleIdentity({ clientId: '', loadScript })

    await expect(identity.signIn()).rejects.toBeInstanceOf(GoogleIdentityConfigurationError)
    expect(loadScript).not.toHaveBeenCalled()
  })

  it('resolves only after the GIS credential callback', async () => {
    let credentialCallback: (() => void) | undefined
    const initialize = vi.fn((config: { callback: () => void }) => {
      credentialCallback = config.callback
    })
    const prompt = vi.fn()
    const identity = useGoogleIdentity({
      clientId: 'google-client',
      loadScript: vi.fn(async () => undefined),
      getGoogle: () => ({
        accounts: {
          id: { initialize, prompt },
        },
      }),
    })

    const signIn = identity.signIn()
    await Promise.resolve()
    expect(prompt).toHaveBeenCalledOnce()

    credentialCallback?.()
    await expect(signIn).resolves.toBeUndefined()
  })
})
