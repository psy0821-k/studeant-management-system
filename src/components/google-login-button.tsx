import { useEffect, useRef } from 'react'

interface GoogleLoginButtonProps {
  onCredential: (credential: string) => void
}

function GoogleLoginButton({ onCredential }: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId || !containerRef.current || !window.google) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    })
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
    })
  }, [clientId, onCredential])

  if (!clientId) {
    return (
      <p className="text-body-small text-gray-400">
        Google 로그인이 아직 설정되지 않았습니다.
      </p>
    )
  }

  return <div ref={containerRef} />
}

export default GoogleLoginButton
