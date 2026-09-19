import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './sidebar'
import { AuthContext } from '../lib/auth-context-value'
import type { AuthContextValue } from '../lib/auth-context-value'

const MOCK_AUTH_VALUE: AuthContextValue = {
  user: { id: 'user-1', name: '김선생', role: '강사' },
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

  it('"성적/과제 관리" 메뉴 텍스트가 더 이상 존재하지 않는다', () => {
    renderSidebar()

    expect(screen.queryByText('성적/과제 관리')).not.toBeInTheDocument()
  })

  it('"과제 관리" 메뉴 항목이 표시되고 링크가 /homework를 가리킨다', () => {
    renderSidebar()

    const homeworkLink = screen.getByRole('link', { name: '과제 관리' })
    expect(homeworkLink).toBeInTheDocument()
    expect(homeworkLink).toHaveAttribute('href', '/homework')
  })
})
