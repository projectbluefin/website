/**
 * Spotify Authorization Code with PKCE — the documented flow for browser apps with
 * no backend (no client secret needed, refresh tokens supported).
 * Docs: developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const VERIFIER_KEY = 'wolves-spotify-pkce-verifier'

/** Web Playback SDK requires streaming + the two identity scopes; queueing needs playback-state control. */
export const SPOTIFY_SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state'

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

function clientId(): string {
  return import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''
}

function redirectUri(): string {
  return import.meta.env.VITE_OAUTH_REDIRECT_URI
    ?? `${window.location.origin}${window.location.pathname}`
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

/** Full-page redirect to Spotify consent. The verifier survives in sessionStorage. */
export async function beginSpotifyLogin(): Promise<void> {
  if (!clientId()) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured')
  }

  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)))
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: await createChallenge(verifier),
  })

  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
}

/**
 * Detects the ?code= redirect callback. Returns tokens when this page load is a
 * Spotify callback, null otherwise. Strips OAuth params from the URL either way.
 */
export async function completeSpotifyLogin(): Promise<SpotifyTokens | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const verifier = sessionStorage.getItem(VERIFIER_KEY)

  if (!code || !verifier) {
    return null
  }

  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())
  sessionStorage.removeItem(VERIFIER_KEY)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed: ${response.status}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresIn: data.expires_in ?? 3600,
  }
}

export async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${response.status}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    // Spotify may rotate the refresh token; keep the old one when it doesn't.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 3600,
  }
}
