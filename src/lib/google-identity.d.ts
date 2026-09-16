interface GoogleCredentialResponse {
  credential: string
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'small' | 'medium' | 'large'
  width?: number
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void
        renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
      }
    }
  }
}
