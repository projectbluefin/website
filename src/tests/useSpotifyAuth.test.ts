import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeSpotifyAuthorization,
  SpotifyAuthConfigurationError,
  useSpotifyAuth,
} from '../composables/useSpotifyAuth'

const storageKeys = [
  'wolves.spotify.state',
  'wolves.spotify.verifier',
  'wolves.spotify.accessToken',
  'wolves.spotify.refreshToken',
  'wolves.spotify.expiresAt',
]

const crypto = {
  getRandomValues: (bytes: Uint8Array) => {
    bytes.fill(1)
    return bytes
  },
  subtle: {
    digest: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  },
}

beforeEach(() => {
  storageKeys.forEach(key => sessionStorage.removeItem(key))
})

describe('spotify browser authorization', () => {
  it('rejects a callback with a different PKCE state and clears session data', async () => {
    sessionStorage.setItem('wolves.spotify.state', 'expected')
    sessionStorage.setItem('wolves.spotify.verifier', 'verifier')

    await expect(completeSpotifyAuthorization(new URL('https://site/?code=x&state=wrong')))
      .rejects
      .toMatchObject({ code: 'state-mismatch' })

    expect(sessionStorage.getItem('wolves.spotify.verifier')).toBeNull()
  })

  it('classifies denied and cancelled callbacks while clearing session data', async () => {
    sessionStorage.setItem('wolves.spotify.state', 'expected')
    sessionStorage.setItem('wolves.spotify.verifier', 'verifier')

    await expect(completeSpotifyAuthorization(new URL('https://site/?error=access_denied')))
      .rejects
      .toMatchObject({ code: 'consent-denied' })
    expect(sessionStorage.getItem('wolves.spotify.state')).toBeNull()

    await expect(completeSpotifyAuthorization(new URL('https://site/')))
      .rejects
      .toMatchObject({ code: 'cancelled' })
  })

  it('stores PKCE data and redirects to Spotify authorization', async () => {
    const assign = vi.fn()
    const auth = useSpotifyAuth({
      clientId: 'spotify-client',
      crypto,
      location: {
        assign,
        origin: 'https://site',
        pathname: '/wolves/',
      },
    })

    await auth.authorize()

    const authorizationUrl = new URL(assign.mock.calls[0][0])
    expect(authorizationUrl.origin).toBe('https://accounts.spotify.com')
    expect(authorizationUrl.searchParams.get('client_id')).toBe('spotify-client')
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(sessionStorage.getItem('wolves.spotify.state')).not.toBeNull()
    expect(sessionStorage.getItem('wolves.spotify.verifier')).not.toBeNull()
    expect(auth.status.value).toBe('authorizing')
  })

  it('reports missing Spotify configuration explicitly', async () => {
    const auth = useSpotifyAuth({
      clientId: '',
      crypto,
      location: {
        assign: vi.fn(),
        origin: 'https://site',
        pathname: '/wolves/',
      },
    })

    await expect(auth.authorize()).rejects.toBeInstanceOf(SpotifyAuthConfigurationError)
    expect(auth.status.value).toBe('error')
  })

  it('exchanges a validated callback and removes one-time PKCE data', async () => {
    sessionStorage.setItem('wolves.spotify.state', 'expected')
    sessionStorage.setItem('wolves.spotify.verifier', 'verifier')
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
    }), { status: 200 }))

    await completeSpotifyAuthorization(new URL('https://site/?code=code&state=expected'), {
      clientId: 'spotify-client',
      fetch,
      redirectUri: 'https://site/',
    })

    expect(fetch).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('wolves.spotify.state')).toBeNull()
    expect(sessionStorage.getItem('wolves.spotify.verifier')).toBeNull()
    expect(sessionStorage.getItem('wolves.spotify.accessToken')).toBe('access')
  })

  it('refreshes an expired access token without retaining it after clear', async () => {
    sessionStorage.setItem('wolves.spotify.accessToken', 'expired')
    sessionStorage.setItem('wolves.spotify.refreshToken', 'refresh')
    sessionStorage.setItem('wolves.spotify.expiresAt', '0')
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'fresh',
      expires_in: 3600,
    }), { status: 200 }))
    const auth = useSpotifyAuth({ clientId: 'spotify-client', fetch })

    expect(auth.status.value).toBe('expired')
    await auth.refresh()

    expect(auth.status.value).toBe('authorized')
    expect(auth.accessToken.value).toBe('fresh')
    auth.clear()
    expect(auth.accessToken.value).toBeNull()
    expect(sessionStorage.getItem('wolves.spotify.refreshToken')).toBeNull()
  })

  it('clears session data after a refresh failure', async () => {
    sessionStorage.setItem('wolves.spotify.accessToken', 'expired')
    sessionStorage.setItem('wolves.spotify.refreshToken', 'refresh')
    sessionStorage.setItem('wolves.spotify.expiresAt', '0')
    const auth = useSpotifyAuth({
      clientId: 'spotify-client',
      fetch: vi.fn(async () => new Response('', { status: 401 })),
    })

    await expect(auth.refresh()).rejects.toMatchObject({ code: 'refresh-failed' })

    expect(auth.status.value).toBe('error')
    expect(auth.accessToken.value).toBeNull()
    expect(sessionStorage.getItem('wolves.spotify.refreshToken')).toBeNull()
  })
})
