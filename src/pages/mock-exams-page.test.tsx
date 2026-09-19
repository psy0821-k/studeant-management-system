import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MockExamsPage from './mock-exams-page'
import { apiClient } from '../lib/api-client'
import type { Student } from '../types/student'
import type { GradeRecord } from '../types/grade'

// recharts의 ResponsiveContainer는 jsdom에서 크기가 0으로 계산되어 자식을 렌더링하지 않으므로,
// 모의고사 추이 그래프의 데이터 포인트 개수는 LineChart에 전달된 data prop을 통해 검증한다.
// (student-detail-page.test.tsx와 동일한 mock 패턴 재사용)
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

const STUDENT_1: Student = {
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

const STUDENT_2: Student = {
  id: 'student-2',
  name: '김철수',
  grade: '중3',
  gender: '남',
  school: '테스트중학교',
  classId: null,
  className: null,
  phone: '010-2222-3333',
  parentPhone: '010-4444-5555',
  status: '재원',
  enrolledAt: '2026-01-01',
}

function makeMockExam(overrides: Partial<GradeRecord>): GradeRecord {
  return {
    id: 'grade-1',
    studentId: STUDENT_1.id,
    subject: '수학',
    examName: '9월 모의고사',
    examType: '모의고사',
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
    <MemoryRouter initialEntries={['/mock-exams']}>
      <Routes>
        <Route path="/mock-exams" element={<MockExamsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupDefaultGetMock() {
  mockedApiClient.get.mockImplementation((path: string) => {
    if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
    if (path.startsWith('/grades')) return Promise.resolve([])
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

async function selectStudent(user: ReturnType<typeof userEvent.setup>, studentName: string) {
  const select = screen.getByRole('combobox')
  await user.selectOptions(select, studentName)
}

async function fillMockExamForm(
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

describe('모의고사 관리 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultGetMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('학생 목록이 로드된 후 학생을 선택하면 examType=모의고사 쿼리로 목록을 조회한다', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())

    await selectStudent(user, '홍길동')

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/grades?studentId=${STUDENT_1.id}&examType=모의고사`,
      ),
    )
  })

  it('시험명/점수/등급/석차/시험일을 입력해 저장하면 apiClient.post가 호출되고 목록에 새 항목이 표시된다', async () => {
    const user = userEvent.setup()
    const created = makeMockExam({
      id: 'new-exam',
      examName: '9월 모의고사',
      score: 92,
      gradeLevel: 2,
      rank: 3,
      rankInGrade: 10,
      examDate: '2026-09-15',
    })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))

    await fillMockExamForm(user, { examName: '9월 모의고사', score: '92', examDate: '2026-09-15' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/grades',
        expect.objectContaining({
          studentId: STUDENT_1.id,
          examType: '모의고사',
          examName: '9월 모의고사',
          score: 92,
          examDate: '2026-09-15',
        }),
      ),
    )

    await waitFor(() => expect(screen.getByText('92')).toBeInTheDocument())
  })

  it('등급/반석차/전교석차를 비워두고 저장하면 해당 필드는 null로 전송된다', async () => {
    const user = userEvent.setup()
    const created = makeMockExam({ id: 'no-rank-exam', examName: '무석차 시험', score: 70, examDate: '2026-09-01' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))

    await fillMockExamForm(user, { examName: '무석차 시험', score: '70', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/grades',
        expect.objectContaining({
          gradeLevel: null,
          rank: null,
          rankInGrade: null,
        }),
      ),
    )
  })

  it('시험명 또는 시험일이 비어 있으면 apiClient.post를 호출하지 않고 폼 에러 문구를 표시한다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))

    await user.type(screen.getByPlaceholderText(/점수/), '80')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/시험명.*시험일|필수/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
  })

  it('점수가 0~100 범위를 벗어나면 apiClient.post를 호출하지 않고 폼 에러 문구를 표시한다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))

    await fillMockExamForm(user, { examName: '범위 밖 점수', score: '101', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/점수는 0~100/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
  })

  it('apiClient.post가 실패하면 에러 문구를 표시하고 목록은 갱신되지 않는다', async () => {
    const user = userEvent.setup()
    mockedApiClient.post.mockRejectedValueOnce(new Error('서버 오류'))

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))

    await fillMockExamForm(user, { examName: '실패할 시험', score: '80', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalled())
    expect(await screen.findByText(/실패했습니다|저장에 실패/)).toBeInTheDocument()
    expect(screen.queryByText('실패할 시험')).not.toBeInTheDocument()
  })

  it('학생을 선택하지 않은 상태에서는 입력 폼이 비활성화되거나 저장 시 안내 문구를 표시한다', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    const saveButton = screen.queryByRole('button', { name: '저장' })
    if (saveButton) {
      expect(saveButton).toBeDisabled()
    } else {
      expect(screen.getByText(/학생을 선택/)).toBeInTheDocument()
    }
  })

  it('모의고사 목록이 2건 이상이면 LineChart에 examName 개수만큼 데이터 포인트가 렌더링된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([
          makeMockExam({ id: 'g1', examName: '6월 모의고사', score: 80, examDate: '2026-06-01' }),
          makeMockExam({ id: 'g2', examName: '9월 모의고사', score: 85, examDate: '2026-09-01' }),
        ])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')

    await waitFor(() => expect(screen.getAllByTestId('chart-point')).toHaveLength(2))
  })

  it('모의고사 목록이 정확히 1건이면 그래프 대신 안내 문구가 표시된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeMockExam({ id: 'g1', examName: '단일 시험', score: 80 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')

    await waitFor(() => expect(screen.getByText('성적 데이터가 없습니다.')).toBeInTheDocument())
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('모의고사 목록이 0건이면 그래프 대신 안내 문구가 표시된다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')

    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining('examType=모의고사')))
    expect(screen.getByText('성적 데이터가 없습니다.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('1건에서 2건이 되는 순간 그래프가 새로 나타난다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeMockExam({ id: 'g1', examName: '6월 모의고사', score: 80, examDate: '2026-06-01' })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    const created = makeMockExam({ id: 'g2', examName: '9월 모의고사', score: 85, examDate: '2026-09-01' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(screen.getByText('성적 데이터가 없습니다.')).toBeInTheDocument())

    await fillMockExamForm(user, { examName: '9월 모의고사', score: '85', examDate: '2026-09-01' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getAllByTestId('chart-point')).toHaveLength(2))
  })

  it('요청 URL이 항상 examType=모의고사로 고정되어 서버 측 필터가 적용된다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')

    await waitFor(() =>
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/examType=모의고사$/),
      ),
    )
  })

  it('삭제 버튼 클릭 후 확인하면 apiClient.delete가 호출되고 목록에서 사라진다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeMockExam({ id: 'g1', examName: '삭제 대상 시험', score: 70 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    mockedApiClient.delete.mockResolvedValueOnce(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(screen.getByText('삭제 대상 시험')).toBeInTheDocument())

    const row = screen.getByText('삭제 대상 시험').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockedApiClient.delete).toHaveBeenCalledWith('/grades/g1'))
    await waitFor(() => expect(screen.queryByText('삭제 대상 시험')).not.toBeInTheDocument())
  })

  it('삭제 확인 다이얼로그에서 취소하면 apiClient.delete가 호출되지 않고 목록이 유지된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeMockExam({ id: 'g1', examName: '유지될 시험', score: 70 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(screen.getByText('유지될 시험')).toBeInTheDocument())

    const row = screen.getByText('유지될 시험').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: '삭제' }))

    expect(mockedApiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByText('유지될 시험')).toBeInTheDocument()
  })

  it('apiClient.delete가 실패하면 목록에서 항목이 제거되지 않고 에러 문구를 표시한다', async () => {
    const user = userEvent.setup()
    mockedApiClient.get.mockImplementation((path: string) => {
      if (path === '/students') return Promise.resolve([STUDENT_1, STUDENT_2])
      if (path.startsWith('/grades')) {
        return Promise.resolve([makeMockExam({ id: 'g1', examName: '삭제 실패 시험', score: 70 })])
      }
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    mockedApiClient.delete.mockRejectedValueOnce(new Error('서버 오류'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    await selectStudent(user, '홍길동')
    await waitFor(() => expect(screen.getByText('삭제 실패 시험')).toBeInTheDocument())

    const row = screen.getByText('삭제 실패 시험').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockedApiClient.delete).toHaveBeenCalled())
    expect(screen.getByText('삭제 실패 시험')).toBeInTheDocument()
    expect(await screen.findByText(/삭제.*실패했습니다|실패/)).toBeInTheDocument()
  })
})
