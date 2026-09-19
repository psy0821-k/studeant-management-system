import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StudentDetailPage from './student-detail-page'
import { apiClient } from '../lib/api-client'
import type { Student } from '../types/student'
import type { GradeRecord } from '../types/grade'

// recharts의 ResponsiveContainer는 jsdom에서 크기가 0으로 계산되어 자식을 렌더링하지 않으므로,
// 성적 추이 그래프의 데이터 포인트 개수는 LineChart에 전달된 data prop을 통해 검증한다.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ data }: { data: { examName: string; score: number }[] }) => (
      <div data-testid="line-chart">
        {data.map((point) => (
          <span key={point.examName} data-testid="chart-point">
            {point.examName}
          </span>
        ))}
      </div>
    ),
  }
})

vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const mockedApiClient = vi.mocked(apiClient, true)

const STUDENT: Student = {
  id: 'student-1',
  name: '홍길동',
  grade: '중2',
  gender: '남',
  school: '테스트중학교',
  classId: null,
  className: null,
  phone: '010-1234-5678',
  parentPhone: '010-1111-2222',
  status: '재원',
  enrolledAt: '2026-01-01',
}

function makeGrade(overrides: Partial<GradeRecord>): GradeRecord {
  return {
    id: 'grade-1',
    studentId: STUDENT.id,
    subject: '수학',
    examName: '2학기 중간고사',
    examType: '학교시험',
    score: 88,
    gradeLevel: null,
    rank: null,
    rankInGrade: null,
    examDate: '2026-09-01',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/students/${STUDENT.id}`]}>
      <Routes>
        <Route path="/students/:id" element={<StudentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillGradeForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { examName: string; score: string; examDate: string },
) {
  await user.type(screen.getByPlaceholderText(/시험명/), values.examName)
  await user.type(screen.getByPlaceholderText(/점수/), values.score)
  const dateInput = document.querySelector('input[type="date"]')
  if (dateInput) {
    await user.type(dateInput, values.examDate)
  }
}

describe('학생 상세 페이지: 학교 성적 섹션', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === `/students/${STUDENT.id}`) return Promise.resolve(STUDENT)
      if (path === '/classes') return Promise.resolve([])
      if (path.startsWith('/grades')) return Promise.resolve([])
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('학교 성적을 입력하고 저장하면 apiClient.post가 호출되고 목록에 새 행이 렌더링된다', async () => {
    const user = userEvent.setup()
    const created = makeGrade({ id: 'new-grade', examName: '2학기 중간고사', score: 92, examDate: '2026-09-15' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await fillGradeForm(user, { examName: '2학기 중간고사', score: '92', examDate: '2026-09-15' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalledWith('/grades', expect.objectContaining({
      studentId: STUDENT.id,
      examName: '2학기 중간고사',
      examType: '학교시험',
      score: 92,
      examDate: '2026-09-15',
    })))

    await waitFor(() => expect(screen.getByText('92')).toBeInTheDocument())
  })

  it('학교 성적이 2건 이상이면 LineChart에 examName 개수만큼 데이터 포인트가 렌더링된다', async () => {
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === `/students/${STUDENT.id}`) return Promise.resolve(STUDENT)
      if (path === '/classes') return Promise.resolve([])
      if (path.startsWith('/grades')) {
        return Promise.resolve([
          makeGrade({ id: 'g1', examName: '1학기 기말고사', score: 80, examDate: '2026-07-01' }),
          makeGrade({ id: 'g2', examName: '2학기 중간고사', score: 85, examDate: '2026-09-01' }),
        ])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })

    renderPage()

    await waitFor(() => expect(screen.getAllByTestId('chart-point')).toHaveLength(2))
  })

  it('삭제 버튼 클릭 후 확인하면 apiClient.delete가 호출되고 목록/그래프에서 제거된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === `/students/${STUDENT.id}`) return Promise.resolve(STUDENT)
      if (path === '/classes') return Promise.resolve([])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeGrade({ id: 'g1', examName: '삭제 대상 시험', score: 70 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    mockedApiClient.delete.mockResolvedValueOnce(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => expect(screen.getByText('삭제 대상 시험')).toBeInTheDocument())

    const row = screen.getByText('삭제 대상 시험').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockedApiClient.delete).toHaveBeenCalledWith('/grades/g1'))
    await waitFor(() => expect(screen.queryByText('삭제 대상 시험')).not.toBeInTheDocument())
  })

  it('점수 0으로 저장하면 에러 없이 정상 저장된다', async () => {
    const user = userEvent.setup()
    const created = makeGrade({ id: 'zero-grade', examName: '최저점 시험', score: 0, examDate: '2026-09-01' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await fillGradeForm(user, { examName: '최저점 시험', score: '0', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalled())
    expect(screen.queryByText(/점수는 0~100/)).not.toBeInTheDocument()
  })

  it('점수 100으로 저장하면 에러 없이 정상 저장된다', async () => {
    const user = userEvent.setup()
    const created = makeGrade({ id: 'max-grade', examName: '만점 시험', score: 100, examDate: '2026-09-01' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await fillGradeForm(user, { examName: '만점 시험', score: '100', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalled())
    expect(screen.queryByText(/점수는 0~100/)).not.toBeInTheDocument()
  })

  it('점수 범위를 벗어나면(-1 또는 101) 인라인 에러가 표시되고 apiClient.post가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await fillGradeForm(user, { examName: '범위 밖 점수', score: '-1', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/점수는 0~100/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText(/점수/)).toHaveValue('-1')
  })

  it('시험명 또는 시험일을 비운 채 저장하면 인라인 에러가 표시되고 API가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/점수/), '80')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/시험명.*시험일|필수/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
  })

  it('삭제 확인 다이얼로그에서 취소하면 apiClient.delete가 호출되지 않고 목록이 유지된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === `/students/${STUDENT.id}`) return Promise.resolve(STUDENT)
      if (path === '/classes') return Promise.resolve([])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeGrade({ id: 'g1', examName: '유지될 시험', score: 70 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderPage()
    await waitFor(() => expect(screen.getByText('유지될 시험')).toBeInTheDocument())

    const row = screen.getByText('유지될 시험').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: '삭제' }))

    expect(mockedApiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByText('유지될 시험')).toBeInTheDocument()
  })

  it('apiClient.post가 실패하면 인라인 에러가 표시되고 목록에 낙관적으로 추가되지 않는다', async () => {
    const user = userEvent.setup()
    mockedApiClient.post.mockRejectedValueOnce(new Error('서버 오류'))

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await fillGradeForm(user, { examName: '실패할 시험', score: '80', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalled())
    expect(await screen.findByText(/실패했습니다|저장에 실패/)).toBeInTheDocument()
    expect(screen.queryByText('실패할 시험')).not.toBeInTheDocument()
  })

  it('학교 성적이 0건이면 그래프 영역이 빈 상태로 에러 없이 렌더링된다', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/grades?studentId=${STUDENT.id}`),
      ),
    )
    expect(screen.getByText('성적 데이터가 없습니다.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })
})
