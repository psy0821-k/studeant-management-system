import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './sidebar'
import { AuthContext } from '../lib/auth-context-value'
import type { AuthContextValue } from '../lib/auth-context-value'

const MOCK_AUTH_VALUE: AuthContextValue = {
  user: null,
  isLoading: false,
  loginWithPassword: async () => {},
  loginWithGoogle: async () => {},
  logout: () => {},
}

function renderSidebar() {
  return render(
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('모의고사 관리 메뉴 항목이 표시된다', () => {
    renderSidebar()

    expect(screen.getByText('모의고사 관리')).toBeInTheDocument()
  })

  it('모의고사 관리 메뉴의 링크가 /mock-exams를 가리킨다', () => {
    renderSidebar()

    const link = screen.getByRole('link', { name: '모의고사 관리' })
    expect(link).toHaveAttribute('href', '/mock-exams')
  })
})
