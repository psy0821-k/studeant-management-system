import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import GoogleLoginButton from '../components/google-login-button'
import { useAuth } from '../lib/use-auth'
import { ApiError } from '../lib/api-client'

function LoginPage() {
  const { loginWithPassword, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await loginWithPassword(username, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleCredential(credential: string) {
    setError(null)
    try {
      await loginWithGoogle(credential)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Google 로그인에 실패했습니다.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-page-title text-gray-900">학생 관리 시스템</h1>
        <p className="mt-1 text-body-small text-gray-500">로그인해서 계속하기</p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <Input
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-body-small text-error-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-caption text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          또는
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex justify-center">
          <GoogleLoginButton onCredential={handleGoogleCredential} />
        </div>
      </Card>
    </div>
  )
}

export default LoginPage
