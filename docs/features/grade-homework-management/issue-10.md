# 이슈 #10: 모의고사 관리 메뉴 신설 (/mock-exams)

## 0. 선행 확인: 이슈 #9 반영 여부

**중요: 현재 브랜치(`feat/mock-exam-management`)에는 이슈 #9의 구현이 반영되어 있지 않다.**

확인한 사실:

- `feat/mock-exam-management`는 `feature/grade-homework-management`에서 분기했다.
- 이슈 #9 구현은 커밋 `56a7c23`(`feat: 학교 성적 입력/조회/삭제 기능 추가 (#9)`)이며, 이 커밋은 `feat/school-grades-management` 브랜치에만 존재한다.
- 해당 브랜치는 PR #13(`base: feature/grade-homework-management`, `head: feat/school-grades-management`, 상태 `OPEN`, `mergeable: MERGEABLE`)로 아직 병합 대기 중이다.
- `git merge-base --is-ancestor 56a7c23 HEAD` → `NO`. 즉 `backend/src/routes/grades.ts`, 갱신된 `src/types/grade.ts`(`examType`/`gradeLevel`/`rank`/`rankInGrade` 포함), `vitest.config.ts`, `src/test/setup.ts` 등 이슈 #9 산출물이 이 브랜치의 실제 파일에는 존재하지 않는다.
- 현재 브랜치의 `src/types/grade.ts`는 옛 목업 타입(`studentName`, `subject`, `examName`, `score`, `examDate`)만 가지고 있고 `examType` 필드 자체가 없다. `backend/src/routes/grades.ts` 파일도 존재하지 않는다(`backend/src/routes/`에는 `auth.ts`, `classes.ts`, `dashboard.ts`, `students.ts`만 있음).

**결론: 이슈 #10 작업을 시작하기 전에 PR #13을 `feature/grade-homework-management`에 먼저 병합하고, 이 브랜치(`feat/mock-exam-management`)를 그 위로 리베이스(또는 재생성)해야 한다.** 이 문서의 시그니처는 PR #13(커밋 `56a7c23`)의 실제 구현 코드를 기준으로 작성했으며, 병합 후에는 아래 내용이 그대로 유효할 것으로 예상된다. 코드 작성(Red/Green) 단계로 넘어가기 전에 이 선행조건 충족 여부를 다시 확인해야 한다.

---

## 1. 백엔드: `GET /api/grades` examType 필터 지원 여부

**결론: 백엔드 변경 불필요.** PR #13의 `backend/src/routes/grades.ts`를 실제로 읽어 확인했다.

```ts
// GET /api/grades?studentId=xxx&examType=학교시험
router.get('/', async (req, res) => {
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined
  const examType = typeof req.query.examType === 'string' ? req.query.examType : undefined

  if (!studentId) {
    res.status(400).json({ error: 'studentId 쿼리 파라미터는 필수입니다.' })
    return
  }

  const conditions = ['student_id = $1']
  const params: unknown[] = [studentId]
  if (examType) {
    params.push(examType)
    conditions.push(`exam_type = $${params.length}`)
  }

  const result = await pool.query<GradeRow>(
    `${SELECT_GRADE} WHERE ${conditions.join(' AND ')} ORDER BY exam_date ASC, created_at ASC`,
    params,
  )
  res.json(result.rows.map(toGrade))
})
```

- `studentId`는 필수(없으면 400), `examType`은 선택 쿼리 파라미터로 이미 지원한다.
- `examType`은 `'학교시험' | '모의고사'` 중 하나를 값으로 받으며, DB의 `exam_type` 컬럼과 정확히 매칭한다. 모의고사 목록 조회는 `GET /api/grades?studentId=<id>&examType=모의고사`로 그대로 사용하면 된다.
- `POST /api/grades`도 `examType`이 `'학교시험' | '모의고사'`가 아니면 400을 반환하므로(`validatePayload`), 모의고사 등록도 `examType: '모의고사'`를 넘기기만 하면 기존 라우트로 처리된다.
- `DELETE /api/grades/:id`도 `examType`을 구분하지 않고 id 기준으로 삭제하므로 모의고사 삭제에 그대로 재사용 가능하다.
- 인증: 라우터 전체에 `requireAuth` 미들웨어가 적용되어 있으므로(`router.use(requireAuth)`) 프론트에서 `apiClient`(자동으로 `Authorization: Bearer <token>` 헤더 부착)를 사용하면 별도 처리가 필요 없다.

즉, 이슈 #10은 **순수 프론트엔드 이슈**다. 백엔드 라우트/타입/마이그레이션 변경 사항 없음.

### 참고: 응답/요청 형태 (이슈 #9 기준, 변경 없음)

```ts
// GET  /api/grades?studentId=<uuid>&examType=모의고사 → GradeRecord[]
// POST /api/grades  body: GradePayload                 → 201 GradeRecord
// DELETE /api/grades/:id                                → 204 (no body) | 404 { error: string }

interface GradePayload {
  studentId?: string
  examName?: string
  examType?: string          // '학교시험' | '모의고사' 만 허용, 그 외 값은 400
  score?: number              // 0~100, 그 외 400
  gradeLevel?: number | null  // 1~9 정수 또는 null, 위반 시 400
  rank?: number | null
  rankInGrade?: number | null
  examDate?: string
}
```

---

## 2. 프론트엔드

### 2.1 `src/types/grade.ts` — 추가 타입 불필요

이슈 #9에서 이미 다음이 정의되어 있다(병합 후 기준):

```ts
export type ExamType = '학교시험' | '모의고사'

export interface GradeRecord {
  id: string
  studentId: string
  subject: string
  examName: string
  examType: ExamType
  score: number
  gradeLevel: number | null
  rank: number | null
  rankInGrade: number | null
  examDate: string
}
```

모의고사 관리 페이지는 이 `GradeRecord`/`ExamType`을 그대로 재사용한다. 추가 타입 정의가 필요 없다(YAGNI — 학교성적/모의고사 모두 동일한 필드 구조를 쓰고 `examType`으로만 구분되므로 별도 `MockExamRecord` 타입을 만들 이유가 없다).

### 2.2 `src/pages/mock-exams-page.tsx` (신규)

**학생 선택 UI 패턴 확인**: `src/pages/students-page.tsx`는 `apiClient.get<Student[]>('/students')`로 학생 목록을 불러온다. `student-detail-page.tsx`는 `apiClient.get<SchoolClass[]>('/classes')`처럼 부가 목록도 동일 패턴(`useEffect` + `apiClient.get` + `catch(() => {})`)으로 불러온다. 모의고사 페이지는 학생 드롭다운이 필요하므로 `students-page.tsx`와 동일하게 `apiClient.get<Student[]>('/students')`로 전체 학생 목록을 가져와 `<select>`로 구성한다(검색 인풋까지는 불필요 — 40명 규모 드롭다운이면 스크롤로 충분하고, 검색 UI 추가는 YAGNI).

컴포넌트 구조 시그니처:

```ts
// src/pages/mock-exams-page.tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table'
import { apiClient, ApiError } from '../lib/api-client'
import type { Student } from '../types/student'
import type { GradeRecord } from '../types/grade'

// 모의고사 입력 폼 상태 (student-detail-page.tsx의 gradeFormState 패턴 재사용, gradeLevel/rank/rankInGrade 중
// AC가 요구하는 "등급/석차"만 사용 — rank(반석차)/rankInGrade(전교석차) 중 어느 쪽을 "석차"로 쓸지는 2.5절 참고)
interface MockExamFormState {
  examName: string
  score: string
  gradeLevel: string   // 등급
  rank: string         // 석차
  examDate: string
}

const EMPTY_FORM: MockExamFormState = { examName: '', score: '', gradeLevel: '', rank: '', examDate: '' }

function MockExamsPage(): JSX.Element {
  // 1) 학생 목록 로드 — students-page.tsx와 동일 패턴
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  // 2) 선택된 학생의 모의고사 목록
  const [mockExams, setMockExams] = useState<GradeRecord[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 3) 입력 폼 상태
  const [form, setForm] = useState<MockExamFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiClient.get<Student[]>('/students').then(setStudents).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedStudentId) {
      setMockExams([])
      return
    }
    setIsLoadingExams(true)
    setLoadError(null)
    apiClient
      .get<GradeRecord[]>(`/grades?studentId=${selectedStudentId}&examType=모의고사`)
      .then(setMockExams)
      .catch(() => setLoadError('모의고사 목록을 불러오지 못했습니다.'))
      .finally(() => setIsLoadingExams(false))
  }, [selectedStudentId])

  function handleFormChange(field: keyof MockExamFormState, value: string): void { /* ... */ }

  async function handleAddMockExam(e: FormEvent<HTMLFormElement>): Promise<void> {
    // student-detail-page.tsx의 handleAddGrade와 동일한 검증(필수값, 점수 0~100) 후
    // apiClient.post<GradeRecord>('/grades', { studentId: selectedStudentId, examType: '모의고사', ... })
  }

  async function handleDeleteMockExam(gradeId: string): Promise<void> {
    // confirm() 후 apiClient.delete<void>(`/grades/${gradeId}`), 성공 시 로컬 state에서 제거
  }

  // 추이 그래프: mockExams.length > 1 일 때만 렌더 (student-detail-page.tsx 패턴과 동일)
  const examHistory = mockExams.map((exam) => ({ examName: exam.examName, score: exam.score }))

  return (
    <div>
      {/* 학생 선택 드롭다운 */}
      {/* 선택된 학생이 없으면 안내 문구만 표시 */}
      {/* 입력 폼: 시험명 / 점수 / 등급 / 석차 / 시험일 / 저장 버튼 */}
      {/* 추이 그래프: examHistory.length > 1 ? <LineChart> : '성적 데이터가 없습니다.' */}
      {/* 목록 테이블: 시험명/점수/등급/석차/시험일/삭제 */}
    </div>
  )
}

export default MockExamsPage
```

핵심 설계 결정:

- **학생 선택 방식**: `student-detail-page.tsx`처럼 라우트 파라미터(`/students/:id`)로 학생을 특정하지 않고, `/mock-exams` 단일 라우트 안에서 `<select>` 드롭다운으로 학생을 바꿔가며 조회한다(AC의 "강사가 학생을 선택하고" 문구와 일치). 학생 상세 페이지의 "학교 성적" 섹션과 달리, 모의고사 관리는 전체 학생을 넘나들며 입력하는 별도 메뉴이므로 독립 페이지가 맞다(사이드바 메뉴 신설 요구사항과도 일치).
- **UI 컴포넌트 재사용**: `Card`, `Input`, `Button`, `Table` 계열은 기존 `src/components/ui/*` 그대로 사용. select 엘리먼트는 `students-page.tsx`/`student-detail-page.tsx`와 동일한 인라인 Tailwind 클래스(`rounded-md border border-gray-300 px-3 py-2 text-sm ...`)를 재사용한다(별도 `Select` 공용 컴포넌트가 없으므로 새로 만들지 않고 기존 인라인 패턴을 따른다 — YAGNI).
- **그래프 재사용**: `student-detail-page.tsx`의 `LineChart`/`ResponsiveContainer`/`CartesianGrid`/`XAxis`/`YAxis`/`Tooltip` 조합, 2건 이상일 때만 그래프 표시, 색상(`#343875`, primary) 그대로 재사용.
- **API 재사용**: `apiClient`, `ApiError`를 `student-detail-page.tsx`/`students-page.tsx`와 동일하게 사용. 학생 목록 조회 실패는 조용히 무시(`catch(() => {})`, 기존 패턴과 동일), 모의고사 목록/입력/삭제 실패는 사용자에게 에러 문구를 노출(기존 `gradeFormError`/`loadError` 패턴과 동일).

### 2.3 `src/App.tsx` 라우트 추가 위치

`grades`(성적/과제 관리) 라우트 다음, `payments` 이전에 추가한다(사이드바 메뉴 순서와 1:1 대응시키기 위함, 2.4절 참고).

**범위 참고**: `issues.md`에 따르면 `/grades` 라우트/메뉴 제거 및 `/homework`로의 대체는 이슈 3(#11)의 책임이다. 이슈 #10에서는 `/grades`를 그대로 두고 `/mock-exams`만 신설한다(기존 라우트를 건드리지 않음 — 요청하지 않은 리팩토링 금지 원칙).

```tsx
import MockExamsPage from './pages/mock-exams-page'
// ...
<Route path="grades" element={<GradesPage />} />
<Route path="mock-exams" element={<MockExamsPage />} />
<Route path="payments" element={<PaymentsPage />} />
```

### 2.4 `src/components/sidebar.tsx` 메뉴 추가 위치

`MENU_ITEMS` 배열에서 "성적/과제 관리" 다음에 추가한다.

```ts
const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard', label: '메인보드' },
  { path: '/students', label: '학생 관리' },
  { path: '/classes', label: '반 관리' },
  { path: '/attendance', label: '출결 관리' },
  { path: '/grades', label: '성적/과제 관리' },
  { path: '/mock-exams', label: '모의고사 관리' },
  { path: '/payments', label: '수강료 관리' },
  { path: '/counseling', label: '상담 관리' },
  { path: '/ai-analysis', label: 'AI 분석' },
]
```

### 2.5 "석차" 필드 매핑 (PRD 근거로 확정)

`GradeRecord`는 `rank`(반석차)와 `rankInGrade`(전교석차) 두 개의 석차 필드를 갖는다. PRD "결정 2"는 "모의고사는 점수(+선택적으로 등급/석차)를 기록해야 함"이라고 명시하며, 이슈 #10 AC도 "등급/석차"를 함께 요구한다. `subject`가 항상 `'수학'` 고정값이듯, 별도의 모의고사 전용 스키마를 만들지 않고 학교 성적과 동일한 `GradeRecord` 필드를 그대로 재사용하는 것이 PRD의 전제다.

**결정: 모의고사 입력 폼은 학교 성적과 동일한 필드(등급/반석차/전교석차)를 모두 제공하되, 전부 선택 입력으로 둔다.**
- `GradeRecord` 스키마 자체가 이미 두 석차 필드를 가지고 있어 백엔드/타입 변경 없이 그대로 재사용 가능하다(YAGNI: 별도 스키마 분기 불필요).
- PRD가 "선택적으로 등급/석차"라고 명시했으므로 세 필드(등급/반석차/전교석차) 모두 미입력 시 `null`로 저장 가능해야 한다(학교 성적 폼과 동일 정책, 이미 `validatePayload`가 이를 허용).
- AC의 "석차"(단수 표현)는 UI 문구상 축약이며, 실제 폼 라벨은 학교 성적 섹션과 동일하게 "반석차"/"전교석차" 두 항목을 유지해 일관성을 지킨다(`student-detail-page.tsx` 폼과 동일 라벨).

---

## 3. 테스트 시나리오

이슈 #9와 동일하게 백엔드는 Vitest+supertest(`backend/test/*.test.ts`), 프론트는 Vitest+RTL(`src/**/*.test.tsx`)을 사용한다. `vitest.config.ts`(jsdom, `src/test/setup.ts`)와 `backend/vitest.config.ts`, `backend/test/helpers.ts`(`createTestTeacher`, `createTestStudent`, `deleteStudent`, `deleteTestUser`)를 그대로 재사용한다.

### 3.1 백엔드 — 신규 테스트 불필요, 회귀 확인만 권장

1절 결론대로 `backend/src/routes/grades.ts`는 변경하지 않으므로 신규 백엔드 테스트는 작성하지 않는다. 다만 PR #13 병합 후 기존 `backend/test/grades.test.ts`의 `examType=학교시험`/`examType=모의고사` 필터 테스트가 그대로 통과하는지 회귀 확인만 수행한다(이슈 #9의 테스트 스위트가 이미 이 필터를 검증하고 있음 — "GET /api/grades?studentId=&examType=학교시험 은 생성한 항목을 examDate 오름차순으로 반환한다" 케이스와 대칭되는 `모의고사` 케이스가 이미 포함되어 있는지 이슈 #9 테스트 파일에서 재확인 필요. 없다면 이슈 #10 Red 단계에서 "모의고사 필터" 케이스를 `grades.test.ts`에 추가하는 것은 허용 범위로 본다 — 단, 이는 기존 라우트의 동작 확인용이며 구현 변경을 요구하지 않는다).

### 3.2 프론트 — `src/pages/mock-exams-page.test.tsx` (신규)

AC 매핑 및 시나리오:

**AC1: 사이드바에 "모의고사 관리" 항목이 표시되고 클릭 시 `/mock-exams`로 이동한다.**

- [정상] `sidebar.tsx` 렌더 시 "모의고사 관리" 텍스트가 존재한다.
- [정상] "모의고사 관리" `NavLink`의 `to` prop(또는 클릭 후 URL)이 `/mock-exams`이다.
- (이 AC는 `sidebar.test.tsx`가 이미 존재한다면 그 파일에 케이스 추가, 없다면 라우팅 통합 테스트로 `App.tsx` 레벨에서 `/mock-exams` 진입 시 `MockExamsPage`가 렌더되는지 확인하는 케이스로 대체 가능.)

**AC2: 학생을 선택하고 시험명/점수/등급/석차를 입력해 저장하면 해당 학생의 모의고사 목록에 새 항목이 표시된다.**

- [정상] 학생 목록이 로드된 후 드롭다운에서 학생을 선택하면 `apiClient.get('/grades?studentId=<id>&examType=모의고사')`가 호출된다.
- [정상] 시험명/점수/등급/반석차/전교석차/시험일을 입력하고 저장 버튼을 클릭하면 `apiClient.post('/grades', { studentId, examType: '모의고사', examName, score, gradeLevel, rank, rankInGrade, examDate })`가 호출되고, 응답으로 받은 항목이 목록 테이블에 표시된다.
- [경계] 등급/반석차/전교석차를 비워두고 저장하면 해당 필드는 `null`로 전송된다(학교 성적 폼과 동일 정책).
- [예외] 시험명 또는 시험일이 비어 있으면 `apiClient.post`를 호출하지 않고 폼 에러 문구를 표시한다.
- [예외] 점수가 0~100 범위를 벗어나면(음수, 101 이상, 숫자가 아닌 값) `apiClient.post`를 호출하지 않고 폼 에러 문구를 표시한다.
- [예외] `apiClient.post`가 실패(reject)하면 에러 문구를 표시하고 목록은 갱신되지 않는다.
- [경계] 학생을 선택하지 않은 상태에서는 입력 폼이 비활성화되거나 저장 시 안내 문구를 표시한다(학생 미선택 상태 처리).

**AC3: 같은 학생의 모의고사 성적이 2건 이상이면 점수 추이 그래프가 표시된다.**

- [정상] 모의고사 목록이 2건 이상일 때 `LineChart`(추이 그래프 컨테이너)가 렌더된다. `student-detail-page.test.tsx`의 recharts mock 패턴(`ResponsiveContainer`/`LineChart`를 단순 div로 치환하고 `data` prop의 포인트 개수로 검증)을 그대로 재사용한다.
- [경계] 모의고사 목록이 정확히 1건일 때 그래프 대신 "성적 데이터가 없습니다." 문구가 표시된다(1건은 추이를 그릴 수 없으므로 `student-detail-page.tsx`와 동일하게 `length > 1` 조건 사용).
- [경계] 모의고사 목록이 0건일 때도 그래프 대신 동일 안내 문구가 표시된다.
- [정상] 새 항목을 저장해 2건째가 되는 순간(1건 → 2건) 그래프가 새로 나타난다(상태 갱신 검증).

**AC4: 학교 성적으로 등록된 항목은 모의고사 관리 페이지의 목록에 나타나지 않는다.**

- [정상] `apiClient.get`이 `examType=모의고사` 쿼리로 호출되는지 검증(요청 시점에 이미 서버 필터에 위임하므로, 프론트 목업 응답에 `examType: '학교시험'` 항목을 섞어 반환하더라도 — 실제로는 서버가 필터링해 내려주지만, 방어적으로 — 화면에는 요청한 필터 그대로 신뢰해 표시함을 확인).
- [예외] 만약 목업 응답에 실수로 `examType: '학교시험'` 레코드가 섞여 온 경우, 최소한 요청 URL이 항상 `examType=모의고사`로 고정되어 서버 측 필터가 적용됨을 검증하는 것으로 충분하다(프론트에서 이중 필터링까지 할지는 YAGNI — 서버가 이미 필터링하므로 클라이언트 재필터링 로직은 추가하지 않는다. 단, 이 판단으로 인해 "서버 필터가 깨지면 화면에도 학교시험이 노출된다"는 리스크는 문서화만 하고 별도 방어 코드는 작성하지 않는다).

**AC5: 이미 등록된 모의고사 항목을 삭제 확인하면 목록에서 사라진다.**

- [정상] 목록의 삭제 버튼 클릭 → `confirm()` 호출 → 사용자가 확인(`window.confirm` mock이 `true` 반환) → `apiClient.delete('/grades/<id>')` 호출 → 목록에서 해당 항목 제거.
- [경계] `confirm()`에서 취소(`false` 반환)하면 `apiClient.delete`를 호출하지 않고 목록이 그대로 유지된다.
- [예외] `apiClient.delete`가 실패(reject)하면 목록에서 항목이 제거되지 않고 에러 문구를 표시한다(`student-detail-page.tsx`의 `handleDeleteGrade`는 현재 실패 처리가 없으므로, 이슈 #10에서는 실패 시 목록을 그대로 두는 최소한의 방어만 추가할지 여부를 Green 단계에서 결정 — 기존 패턴을 그대로 따를지, 에러 처리를 보강할지는 구현자 판단에 맡기되 최소 "목록에서 사라지지 않는다"는 테스트는 작성한다).

### 3.3 라우팅/사이드바 통합 테스트 (선택)

- [정상] `App.tsx` 라우트 테스트가 이미 존재한다면 `/mock-exams` 경로 추가 케이스를 덧붙인다. 없다면 이 이슈 범위에서 새로 만들지 않고 `mock-exams-page.test.tsx` 내부에서 `MemoryRouter`로 페이지 단위 렌더 검증만 수행한다(기존 `student-detail-page.test.tsx`가 라우트 통합 테스트를 별도로 두지 않고 페이지 자체를 `MemoryRouter`로 감싸 테스트하는 것과 동일한 수준).

---

## 4. 요약

- 백엔드 변경: 없음(이슈 #9의 `GET/POST/DELETE /api/grades`가 `examType` 필터를 이미 지원).
- 선행조건: PR #13(이슈 #9)을 `feature/grade-homework-management`에 먼저 병합하고 이 브랜치를 그 위로 갱신해야 함 — 미충족 시 이슈 #10 코드 작업 착수 불가.
- 프론트 신규: `src/pages/mock-exams-page.tsx`, `src/pages/mock-exams-page.test.tsx`.
- 프론트 수정: `src/App.tsx`(라우트 1줄), `src/components/sidebar.tsx`(메뉴 1줄).
- 타입 변경: 없음(`src/types/grade.ts`의 기존 `GradeRecord`/`ExamType` 재사용).
