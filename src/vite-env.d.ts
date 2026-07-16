/// <reference types="vite/client" />

interface GoogleIdentityPromptNotification {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string
        callback: (response: { credential?: string }) => void
      }) => void
      prompt: (callback: (notification: GoogleIdentityPromptNotification) => void) => void
    }
  }
}

interface Window {
  google?: GoogleIdentity
}

declare module '*.json' {
  const value: any
  export default value
}

declare module '*.txt?raw' {
  const value: string
  export default value
}
