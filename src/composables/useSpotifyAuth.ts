import { ref } from 'vue'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const STORAGE_PREFIX = 'wolves.spotify.'
const STORAGE_KEYS = ['state', 'verifier', 'accessToken', 'refreshToken', 'expiresAt'] as const
const SPOTIFY_SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state'

export type SpotifyAuthStatus = 'idle' | 'authorizing' | 'authorized' | 'expired' | 'error'
export type SpotifyAuthErrorCode
  = | 'cancelled'
    | 'popup-blocked'
    | 'state-mismatch'
    | 'consent-denied'
    | 'token-exchange-failed'
    | 'refresh-failed'

export class SpotifyAuthError extends Error {
  constructor(
    public readonly code: SpotifyAuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SpotifyAuthError'
  }
}

export class SpotifyAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpotifyAuthConfigurationError'
  }
}

interface SpotifyTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
}

interface SpotifyTokens {
  accessToken: string
  refreshToken: string | null
}

export interface SpotifyAuthDependencies {
  clientId?: string
  crypto?: Pick<Crypto, 'getRandomValues' | 'subtle'>
  fetch?: typeof window.fetch
  location?: Pick<Location, 'assign' | 'origin' | 'pathname'>
  now?: () => number
  redirectUri?: string
  storage?: Storage
}

function storageKey(key: typeof STORAGE_KEYS[number]): string {
  return `${STORAGE_PREFIX}${key}`
}

function getStorage(dependencies: SpotifyAuthDependencies): Storage {
  return dependencies.storage ?? sessionStorage
}

function getClientId(dependencies: SpotifyAuthDependencies): string {
  const clientId = dependencies.clientId ?? import.meta.env.VITE_SPOTIFY_CLIENT_ID
  if (!clientId?.trim()) {
    throw new SpotifyAuthConfigurationError('VITE_SPOTIFY_CLIENT_ID is required for Spotify authorization')
  }
  return clientId
}

function getLocation(dependencies: SpotifyAuthDependencies): Pick<Location, 'assign' | 'origin' | 'pathname'> {
  return dependencies.location ?? window.location
}

function getRedirectUri(dependencies: SpotifyAuthDependencies): string {
  return dependencies.redirectUri ?? `${getLocation(dependencies).origin}${getLocation(dependencies).pathname}`
}

function getFetch(dependencies: SpotifyAuthDependencies): typeof window.fetch {
  return dependencies.fetch ?? window.fetch.bind(window)
}

function getCrypto(dependencies: SpotifyAuthDependencies): Pick<Crypto, 'getRandomValues' | 'subtle'> {
  return dependencies.crypto ?? window.crypto
}

function getNow(dependencies: SpotifyAuthDependencies): () => number {
  return dependencies.now ?? Date.now
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomValue(crypto: Pick<Crypto, 'getRandomValues' | 'subtle'>, bytesLength: number): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytesLength)))
}

async function createCodeChallenge(
  verifier: string,
  crypto: Pick<Crypto, 'getRandomValues' | 'subtle'>,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return bytesToBase64Url(new Uint8Array(digest))
}

function parseTokenResponse(data: SpotifyTokenResponse): SpotifyTokens {
  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error('Spotify token response was incomplete')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
  }
}

function storeTokens(
  storage: Storage,
  tokens: SpotifyTokens,
  expiresIn: number,
  now: () => number,
  previousRefreshToken: string | null = null,
): void {
  storage.setItem(storageKey('accessToken'), tokens.accessToken)
  storage.setItem(storageKey('refreshToken'), tokens.refreshToken ?? previousRefreshToken ?? '')
  storage.setItem(storageKey('expiresAt'), String(now() + expiresIn * 1000))
}

async function requestToken(
  dependencies: SpotifyAuthDependencies,
  parameters: URLSearchParams,
): Promise<SpotifyTokenResponse> {
  const response = await getFetch(dependencies)(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parameters,
  })
  if (!response.ok) {
    throw new Error(`Spotify token endpoint returned ${response.status}`)
  }
  return response.json() as Promise<SpotifyTokenResponse>
}

export function clearSpotifySession(storage: Storage = sessionStorage): void {
  for (const key of STORAGE_KEYS) {
    storage.removeItem(storageKey(key))
  }
}

export async function completeSpotifyAuthorization(
  callbackUrl: URL,
  dependencies: SpotifyAuthDependencies = {},
): Promise<SpotifyTokens> {
  const storage = getStorage(dependencies)
  const providerError = callbackUrl.searchParams.get('error')
  if (providerError) {
    clearSpotifySession(storage)
    throw new SpotifyAuthError(
      providerError === 'access_denied' ? 'consent-denied' : 'cancelled',
      `Spotify authorization was not completed: ${providerError}`,
    )
  }

  const code = callbackUrl.searchParams.get('code')
  if (!code) {
    clearSpotifySession(storage)
    throw new SpotifyAuthError('cancelled', 'Spotify authorization was cancelled')
  }

  const state = callbackUrl.searchParams.get('state')
  const expectedState = storage.getItem(storageKey('state'))
  if (!state || state !== expectedState) {
    clearSpotifySession(storage)
    throw new SpotifyAuthError('state-mismatch', 'Spotify authorization state did not match')
  }

  const verifier = storage.getItem(storageKey('verifier'))
  if (!verifier) {
    clearSpotifySession(storage)
    throw new SpotifyAuthError('token-exchange-failed', 'Spotify authorization verifier was unavailable')
  }

  try {
    const clientId = getClientId(dependencies)
    const response = await requestToken(dependencies, new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(dependencies),
    }))
    const tokens = parseTokenResponse(response)
    storeTokens(storage, tokens, response.expires_in!, getNow(dependencies))
    storage.removeItem(storageKey('state'))
    storage.removeItem(storageKey('verifier'))
    return tokens
  }
  catch (error) {
    if (error instanceof SpotifyAuthConfigurationError) {
      clearSpotifySession(storage)
      throw error
    }
    clearSpotifySession(storage)
    throw new SpotifyAuthError('token-exchange-failed', 'Spotify authorization token exchange failed')
  }
}

function initialStatus(storage: Storage, now: () => number): SpotifyAuthStatus {
  const accessToken = storage.getItem(storageKey('accessToken'))
  if (!accessToken) {
    return 'idle'
  }
  return Number(storage.getItem(storageKey('expiresAt'))) <= now() ? 'expired' : 'authorized'
}

export function useSpotifyAuth(dependencies: SpotifyAuthDependencies = {}) {
  const storage = getStorage(dependencies)
  const now = getNow(dependencies)
  const accessToken = ref(storage.getItem(storageKey('accessToken')))
  const status = ref<SpotifyAuthStatus>(initialStatus(storage, now))
  const error = ref<SpotifyAuthError | SpotifyAuthConfigurationError | null>(null)

  function clear(): void {
    clearSpotifySession(storage)
    accessToken.value = null
    status.value = 'idle'
    error.value = null
  }

  async function authorize(): Promise<void> {
    try {
      const clientId = getClientId(dependencies)
      const crypto = getCrypto(dependencies)
      const verifier = randomValue(crypto, 64)
      const state = randomValue(crypto, 32)
      const challenge = await createCodeChallenge(verifier, crypto)
      const location = getLocation(dependencies)

      storage.setItem(storageKey('state'), state)
      storage.setItem(storageKey('verifier'), verifier)
      error.value = null
      status.value = 'authorizing'

      const authorizeUrl = new URL(AUTHORIZE_URL)
      authorizeUrl.search = new URLSearchParams({
        client_id: clientId,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        redirect_uri: getRedirectUri(dependencies),
        response_type: 'code',
        scope: SPOTIFY_SCOPES,
        state,
      }).toString()
      location.assign(authorizeUrl.toString())
    }
    catch (caught) {
      const configurationError = caught instanceof SpotifyAuthConfigurationError
        ? caught
        : new SpotifyAuthError('popup-blocked', 'Spotify authorization could not be opened')
      error.value = configurationError
      status.value = 'error'
      throw configurationError
    }
  }

  async function refresh(): Promise<void> {
    const refreshToken = storage.getItem(storageKey('refreshToken'))
    try {
      const clientId = getClientId(dependencies)
      if (!refreshToken) {
        throw new Error('Spotify refresh token was unavailable')
      }

      const response = await requestToken(dependencies, new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }))
      const tokens = parseTokenResponse(response)
      storeTokens(storage, tokens, response.expires_in!, now, refreshToken)
      accessToken.value = tokens.accessToken
      status.value = 'authorized'
      error.value = null
    }
    catch (caught) {
      if (caught instanceof SpotifyAuthConfigurationError) {
        error.value = caught
        status.value = 'error'
        throw caught
      }
      clearSpotifySession(storage)
      accessToken.value = null
      const refreshError = new SpotifyAuthError('refresh-failed', 'Spotify token refresh failed')
      error.value = refreshError
      status.value = 'error'
      throw refreshError
    }
  }

  return { authorize, refresh, clear, accessToken, status, error }
}
