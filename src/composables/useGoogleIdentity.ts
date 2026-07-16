const GOOGLE_IDENTITY_SRC = 'https://accounts.google.com/gsi/client'

export class GoogleIdentityConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleIdentityConfigurationError'
  }
}

export interface GoogleIdentityDependencies {
  clientId?: string
  getGoogle?: () => GoogleIdentity | undefined
  loadScript?: (source: string) => Promise<void>
}

let googleIdentityScriptPromise: Promise<void> | null = null

function loadGoogleIdentityScript(source: string): Promise<void> {
  if (window.google?.accounts.id) {
    return Promise.resolve()
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.querySelector(`script[src="${source}"]`) as HTMLScriptElement | null
      ?? document.createElement('script')

    const handleError = () => {
      googleIdentityScriptPromise = null
      reject(new Error('Google Identity Services failed to load'))
    }

    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!script.parentNode) {
      script.src = source
      script.async = true
      document.head.appendChild(script)
    }
  })

  return googleIdentityScriptPromise
}

export function useGoogleIdentity(dependencies: GoogleIdentityDependencies = {}) {
  const clientId = dependencies.clientId ?? import.meta.env.VITE_GOOGLE_CLIENT_ID
  const loadScript = dependencies.loadScript ?? loadGoogleIdentityScript
  const getGoogle = dependencies.getGoogle ?? (() => window.google)

  async function signIn(): Promise<void> {
    if (!clientId?.trim()) {
      throw new GoogleIdentityConfigurationError('VITE_GOOGLE_CLIENT_ID is required for Google sign-in')
    }

    await loadScript(GOOGLE_IDENTITY_SRC)
    const google = getGoogle()
    if (!google?.accounts.id) {
      throw new GoogleIdentityConfigurationError('Google Identity Services is unavailable after loading')
    }

    await new Promise<void>((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: () => resolve(),
      })
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          reject(new Error('Google sign-in was not completed'))
        }
      })
    })
  }

  return {
    signIn,
    reset: () => undefined,
  }
}
