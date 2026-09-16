import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { apiClient, ApiError } from './api-client'
import { AuthContext } from './auth-context-value'
import { clearSession, persistSession, readStoredUser, getStoredToken } from './auth-storage'
import type { AuthUser } from '../types/auth'

interface LoginResponse {
  token: string
  user: AuthUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [isLoading, setIsLoading] = useState(() => getStoredToken() !== null)

  useEffect(() => {
    if (!getStoredToken()) {
      return
    }

    apiClient
      .get<{ user: AuthUser }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          setUser(null)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password })
    persistSession(res.token, res.user)
    setUser(res.user)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await apiClient.post<LoginResponse>('/auth/google', { credential })
    persistSession(res.token, res.user)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithPassword, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
