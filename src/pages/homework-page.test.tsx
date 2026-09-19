import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HomeworkPage from './homework-page'
import { apiClient } from '../lib/api-client'
import type { SchoolClass } from '../types/class'
import type { Student } from '../types/student'
import type { HomeworkRecord } from '../types/grade'

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

const CLASS: SchoolClass = {
  id: 'class-1',
  name: '수학 심화반',
  subject: '수학',
  teacher: '김선생',
  studentCount: 2,
  schedules: [],
}

const STUDENT: Student = {
  id: 'student-1',
  name: '홍길동',
  grade: '중2',
  gender: '남',
  school: '테스트중학교',
  classId: CLASS.id,
  className: CLASS.name,
  phone: '010-1234-5678',
  parentPhone: '010-1111-2222',
  status: '재원',
  enrolledAt: '2026-01-01',
}

function makeHomework(overrides: Partial<HomeworkRecord>): HomeworkRecord {
  return {
    id: 'homework-1',
    classId: null,
    className: null,
    studentId: null,
    studentName: null,
    title: '숙제',
    createdAt: '2026-09-01T00:00:00.000Z',
    submissions: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/homework']}>
      <Routes>
        <Route path="/homework" element={<HomeworkPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupApiMock(homeworkList: HomeworkRecord[] = []) {
  mockedApiClient.get.mockImplementation((path: string) => {
    if (path === '/classes') return Promise.resolve([CLASS])
    if (path === '/students') return Promise.resolve([STUDENT])
    if (path === '/homework') return Promise.resolve(homeworkList)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

describe('과제 관리 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupApiMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('반을 선택하고 과제명을 입력해 저장하면 apiClient.post가 {classId, title} 형태로 호출되고 목록에 새 과제가 표시된다', async () => {
    const user = userEvent.setup()
    const created = makeHomework({ id: 'new-homework', classId: CLASS.id, className: CLASS.name, title: '수학 익힘책' })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/classes'))

    const classRadio = screen.getByRole('radio', { name: /반 전체/ })
    await user.click(classRadio)
    const classSelect = screen.getByLabelText(/반 선택|반$/i)
    await user.selectOptions(classSelect, CLASS.id)
    await user.type(screen.getByPlaceholderText(/과제명/), '수학 익힘책')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(mockedApiClient.post).toHaveBeenCalledWith('/homework', {
        classId: CLASS.id,
        title: '수학 익힘책',
      }),
    )
    await waitFor(() => expect(screen.getByText('수학 익힘책')).toBeInTheDocument())
  })

  it('"개별 학생" 토글로 전환해 학생을 선택하고 저장하면 apiClient.post가 {studentId, title} 형태로 호출된다', async () => {
    const user = userEvent.setup()
    const created = makeHomework({
      id: 'new-homework-2',
      studentId: STUDENT.id,
      studentName: STUDENT.name,
      title: '개별 숙제',
    })
    mockedApiClient.post.mockResolvedValueOnce(created)

    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/students'))

    await user.click(screen.getByRole('radio', { name: /개별 학생/ }))
    const studentSelect = screen.getByLabelText(/학생 선택|학생$/i)
    await user.selectOptions(studentSelect, STUDENT.id)
    await user.type(screen.getByPlaceholderText(/과제명/), '개별 숙제')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(mockedApiClient.post).toHaveBeenCalledWith('/homework', {
        studentId: STUDENT.id,
        title: '개별 숙제',
      }),
    )
  })

  it('삭제 버튼 클릭 후 확인하면 apiClient.delete가 호출되고 목록에서 해당 과제가 사라진다', async () => {
    const user = userEvent.setup()
    setupApiMock([makeHomework({ id: 'homework-to-delete', title: '삭제될 숙제', classId: CLASS.id, className: CLASS.name })])
    mockedApiClient.delete.mockResolvedValueOnce(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => expect(screen.getByText('삭제될 숙제')).toBeInTheDocument())

    const card = screen.getByText('삭제될 숙제').closest('[data-testid="homework-item"]') ?? document.body
    await user.click(within(card as HTMLElement).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockedApiClient.delete).toHaveBeenCalledWith('/homework/homework-to-delete'))
    await waitFor(() => expect(screen.queryByText('삭제될 숙제')).not.toBeInTheDocument())
  })

  it('과제 목록에 학생별 제출 현황(이름 + 상태 배지)이 렌더링된다', async () => {
    setupApiMock([
      makeHomework({
        id: 'homework-with-submissions',
        title: '제출 현황 확인용 숙제',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [
          { id: 'sub-1', studentId: 'student-a', studentName: '김학생', status: '완료' },
          { id: 'sub-2', studentId: 'student-b', studentName: '이학생', status: '미제출' },
        ],
      }),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('제출 현황 확인용 숙제')).toBeInTheDocument())
    expect(screen.getByText('김학생')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.getByText('이학생')).toBeInTheDocument()
    expect(screen.getByText('미제출')).toBeInTheDocument()
  })

  it('targetType을 "반 전체"에서 "개별 학생"으로 전환하면 이전에 선택했던 classId 값이 초기화된다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/classes'))

    await user.click(screen.getByRole('radio', { name: /반 전체/ }))
    const classSelect = screen.getByLabelText(/반 선택|반$/i)
    await user.selectOptions(classSelect, CLASS.id)

    await user.click(screen.getByRole('radio', { name: /개별 학생/ }))
    await user.type(screen.getByPlaceholderText(/과제명/), '전환 테스트')
    await user.click(screen.getByRole('button', { name: '저장' }))

    // 학생을 선택하지 않았으므로 저장이 호출되지 않아야 하고,
    // classId가 남아있었다면 studentId 없이 classId가 섞여 전송되었을 것이다.
    expect(mockedApiClient.post).not.toHaveBeenCalledWith(
      '/homework',
      expect.objectContaining({ classId: CLASS.id }),
    )
  })

  it('아무것도 선택하지 않고 저장을 시도하면 인라인 에러 메시지가 표시되고 apiClient.post가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/classes'))

    await user.type(screen.getByPlaceholderText(/과제명/), '검증 테스트')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/선택해주세요/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
  })

  it('과제명을 비운 채 저장을 시도하면 인라인 에러가 표시되고 저장되지 않는다', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/classes'))

    await user.click(screen.getByRole('radio', { name: /반 전체/ }))
    const classSelect = screen.getByLabelText(/반 선택|반$/i)
    await user.selectOptions(classSelect, CLASS.id)
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/과제명을 입력해주세요/)).toBeInTheDocument()
    expect(mockedApiClient.post).not.toHaveBeenCalled()
  })

  it('apiClient.post가 실패(reject)하면 에러 메시지가 표시되고 폼 데이터가 유지된다', async () => {
    const user = userEvent.setup()
    mockedApiClient.post.mockRejectedValueOnce(new Error('서버 오류'))

    renderPage()
    await waitFor(() => expect(mockedApiClient.get).toHaveBeenCalledWith('/classes'))

    await user.click(screen.getByRole('radio', { name: /반 전체/ }))
    const classSelect = screen.getByLabelText(/반 선택|반$/i)
    await user.selectOptions(classSelect, CLASS.id)
    await user.type(screen.getByPlaceholderText(/과제명/), '실패할 과제')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedApiClient.post).toHaveBeenCalled())
    expect(await screen.findByText(/실패했습니다|저장에 실패/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/과제명/)).toHaveValue('실패할 과제')
  })

  it('apiClient.delete가 실패하면 에러가 표시되고 목록에서 항목이 사라지지 않는다', async () => {
    const user = userEvent.setup()
    setupApiMock([makeHomework({ id: 'homework-delete-fail', title: '삭제 실패 숙제', classId: CLASS.id, className: CLASS.name })])
    mockedApiClient.delete.mockRejectedValueOnce(new Error('삭제 실패'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => expect(screen.getByText('삭제 실패 숙제')).toBeInTheDocument())

    const card = screen.getByText('삭제 실패 숙제').closest('[data-testid="homework-item"]') ?? document.body
    await user.click(within(card as HTMLElement).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockedApiClient.delete).toHaveBeenCalled())
    expect(await screen.findByText(/실패했습니다|삭제에 실패/)).toBeInTheDocument()
    expect(screen.getByText('삭제 실패 숙제')).toBeInTheDocument()
  })
})
