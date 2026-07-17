/**
 * Google OAuth via the Google Identity Services token model — the documented flow
 * for browser-only apps. GIS owns the popup/consent UX and PKCE details; public
 * SPA clients cannot hold refresh tokens, so "refresh" is a silent re-request
 * (prompt: '') against the existing Google session, falling back to interactive
 * consent only when the session is gone.
 * Docs: developers.google.com/identity/oauth2/web/guides/use-token-model
 */

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

export interface GoogleTokens {
  accessToken: string
  expiresIn: number
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  callback: (response: TokenResponse) => void
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GisWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: TokenResponse) => void
          error_callback?: (error: { type?: string, message?: string }) => void
        }) => TokenClient
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
let tokenClient: TokenClient | null = null

function loadGis(): Promise<void> {
  const gisWindow = window as GisWindow
  if (gisWindow.google?.accounts?.oauth2) {
    return Promise.resolve()
  }
  if (gisPromise) {
    return gisPromise
  }

  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      gisPromise = null
      script.remove()
      reject(new Error('Google Identity Services failed to load'))
    })
    document.head.appendChild(script)
  })
  return gisPromise
}

async function getTokenClient(): Promise<TokenClient> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured')
  }

  await loadGis()
  const oauth2 = (window as GisWindow).google?.accounts?.oauth2
  if (!oauth2) {
    throw new Error('Google Identity Services unavailable')
  }

  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: () => {}, // replaced per request in requestGoogleToken
    })
  }
  return tokenClient
}

function requestToken(client: TokenClient, prompt: string): Promise<GoogleTokens> {
  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error_description ?? response.error ?? 'Google auth failed'))
        return
      }
      resolve({
        accessToken: response.access_token,
        expiresIn: response.expires_in ?? 3600,
      })
    }
    client.requestAccessToken({ prompt })
  })
}

/** Interactive login (account chooser + consent when needed). Must run from a user gesture. */
export async function beginGoogleLogin(): Promise<GoogleTokens> {
  return requestToken(await getTokenClient(), 'consent')
}

/** Silent renewal against the existing Google session; throws if interaction is required. */
export async function refreshGoogleToken(): Promise<GoogleTokens> {
  return requestToken(await getTokenClient(), '')
}
