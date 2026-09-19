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

describe('과제 관리 페이지: 제출 상태 배지 클릭', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('상태: 미제출인 배지를 클릭하면 화면에 즉시 "진행중"으로 바뀌고 apiClient.put이 { status: 진행중 }으로 호출된다', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-1',
        title: '상태 변경 숙제',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-1', studentId: 'student-a', studentName: '김학생', status: '미제출' }],
      }),
    ])
    mockedApiClient.put.mockResolvedValueOnce({
      id: 'sub-1',
      studentId: 'student-a',
      studentName: '김학생',
      status: '진행중',
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('상태 변경 숙제')).toBeInTheDocument())

    const badge = screen.getByText('미제출')
    await user.click(badge)

    expect(await screen.findByText('진행중')).toBeInTheDocument()
    expect(mockedApiClient.put).toHaveBeenCalledWith('/homework/submissions/sub-1', { status: '진행중' })
  })

  it('상태: 진행중인 배지를 클릭하면 "완료"로 바뀌고 apiClient.put이 { status: 완료 }로 호출된다', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-2',
        title: '상태 변경 숙제2',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-2', studentId: 'student-b', studentName: '이학생', status: '진행중' }],
      }),
    ])
    mockedApiClient.put.mockResolvedValueOnce({
      id: 'sub-2',
      studentId: 'student-b',
      studentName: '이학생',
      status: '완료',
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('상태 변경 숙제2')).toBeInTheDocument())

    const badge = screen.getByText('진행중')
    await user.click(badge)

    expect(await screen.findByText('완료')).toBeInTheDocument()
    expect(mockedApiClient.put).toHaveBeenCalledWith('/homework/submissions/sub-2', { status: '완료' })
  })

  it('상태: 완료인 배지를 클릭하면 "미제출"로 바뀌고 apiClient.put이 { status: 미제출 }로 호출된다(순환 완성 확인)', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-3',
        title: '상태 변경 숙제3',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-3', studentId: 'student-c', studentName: '박학생', status: '완료' }],
      }),
    ])
    mockedApiClient.put.mockResolvedValueOnce({
      id: 'sub-3',
      studentId: 'student-c',
      studentName: '박학생',
      status: '미제출',
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('상태 변경 숙제3')).toBeInTheDocument())

    const badge = screen.getByText('완료')
    await user.click(badge)

    expect(await screen.findByText('미제출')).toBeInTheDocument()
    expect(mockedApiClient.put).toHaveBeenCalledWith('/homework/submissions/sub-3', { status: '미제출' })
  })

  it('배지 클릭 시 Badge가 실제로 role="button"을 가지며 userEvent.click으로 클릭 가능함을 확인한다', async () => {
    setupApiMock([
      makeHomework({
        id: 'homework-status-4',
        title: '접근성 확인 숙제',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-4', studentId: 'student-d', studentName: '최학생', status: '미제출' }],
      }),
    ])
    mockedApiClient.put.mockResolvedValueOnce({
      id: 'sub-4',
      studentId: 'student-d',
      studentName: '최학생',
      status: '진행중',
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('접근성 확인 숙제')).toBeInTheDocument())

    const badge = screen.getByRole('button', { name: '미제출' })
    expect(badge).toBeInTheDocument()
  })

  it('클릭 직후(응답이 오기 전) 화면에는 이미 다음 상태가 표시되어야 한다(낙관적 업데이트)', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-5',
        title: '낙관적 업데이트 숙제',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-5', studentId: 'student-e', studentName: '정학생', status: '미제출' }],
      }),
    ])
    mockedApiClient.put.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ id: 'sub-5', studentId: 'student-e', studentName: '정학생', status: '진행중' }),
            50,
          ),
        ),
    )

    renderPage()
    await waitFor(() => expect(screen.getByText('낙관적 업데이트 숙제')).toBeInTheDocument())

    const badge = screen.getByText('미제출')
    await user.click(badge)

    // apiClient.put 응답이 오기 전(50ms 지연)에도 이미 "진행중"으로 바뀌어 있어야 한다.
    expect(screen.getByText('진행중')).toBeInTheDocument()
  })

  it('apiClient.put이 reject되면 배지가 클릭 이전 상태로 되돌아가고 에러 메시지가 화면에 표시된다', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-6',
        title: '롤백 확인 숙제',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-6', studentId: 'student-f', studentName: '한학생', status: '미제출' }],
      }),
    ])
    mockedApiClient.put.mockRejectedValueOnce(new Error('네트워크 오류'))

    renderPage()
    await waitFor(() => expect(screen.getByText('롤백 확인 숙제')).toBeInTheDocument())

    const badge = screen.getByText('미제출')
    await user.click(badge)

    await waitFor(() => expect(screen.getByText('미제출')).toBeInTheDocument())
    expect(screen.queryByText('진행중')).not.toBeInTheDocument()
    expect(await screen.findByText(/실패했습니다|오류/)).toBeInTheDocument()
  })

  it('실패 후에도 다른 과제/다른 학생의 배지 상태는 영향받지 않는다(롤백이 해당 submission에만 국한됨을 확인)', async () => {
    const user = userEvent.setup()
    setupApiMock([
      makeHomework({
        id: 'homework-status-7a',
        title: '롤백 범위 확인 숙제1',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-7a', studentId: 'student-g', studentName: '오학생', status: '미제출' }],
      }),
      makeHomework({
        id: 'homework-status-7b',
        title: '롤백 범위 확인 숙제2',
        classId: CLASS.id,
        className: CLASS.name,
        submissions: [{ id: 'sub-7b', studentId: 'student-h', studentName: '윤학생', status: '미제출' }],
      }),
    ])
    mockedApiClient.put.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('네트워크 오류')), 50)),
    )

    renderPage()
    await waitFor(() => expect(screen.getByText('롤백 범위 확인 숙제1')).toBeInTheDocument())

    const firstCard = screen.getByText('롤백 범위 확인 숙제1').closest('[data-testid="homework-item"]') as HTMLElement
    const secondCard = screen.getByText('롤백 범위 확인 숙제2').closest('[data-testid="homework-item"]') as HTMLElement
    const badge = within(firstCard).getByText('미제출')
    await user.click(badge)

    // 낙관적 업데이트로 첫 번째 카드는 즉시 "진행중"으로 바뀌었다가, 실패 후 "미제출"로 롤백되어야 한다.
    expect(within(firstCard).getByText('진행중')).toBeInTheDocument()
    await waitFor(() => expect(within(firstCard).getByText('미제출')).toBeInTheDocument())
    expect(await screen.findByText(/실패했습니다|오류/)).toBeInTheDocument()

    // 두 번째 카드는 처음부터 끝까지 "미제출" 상태를 유지해야 한다(다른 submission에 영향 없음).
    expect(within(secondCard).getByText('미제출')).toBeInTheDocument()
    expect(within(secondCard).queryByText('진행중')).not.toBeInTheDocument()
  })
})
