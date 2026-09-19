# 이슈 9: 학교 성적 — 학생 상세 페이지에서 입력/조회/삭제 (시그니처 확정)

GitHub #9. PRD 결정 1·2, spec-fixed.md 3-1/4/5/9절 기준으로 백엔드/프론트 시그니처와 테스트
시나리오를 확정한다.

## 0. 확정 전제 (모호함 해소)

- **"학기" 입력 필드**: PRD 결정 2와 spec-fixed.md 3-1절은 `grades` 테이블에 `semester`(학기) 컬럼을
  추가한다고 명시하지 않는다. 기존 스키마의 `exam_date`(date)가 이미 존재하며, 이슈 AC의 "학기"는
  화면상 "시험명"에 학기 정보를 포함해 입력하는 것으로 해석한다(예: 시험명에 "2학기 중간고사"처럼
  강사가 자유 입력). 별도 `semester` 컬럼/필드는 추가하지 않는다 — Out of Scope("제3의 유형 확장")
  원칙과 스키마 최소 변경 원칙에 부합. 폼에는 학기 전용 입력을 두지 않고 `examName`(시험명) 텍스트에
  포함해 입력하도록 안내 문구만 둔다.
- **`subject`**: PRD/spec 확정대로 항상 `'수학'` 고정값. UI에 노출하지 않고 POST 시 백엔드가 상수로
  저장한다(프론트에서 전송하지 않음).
- **기존 `rank` 컬럼**: 컬럼명 변경 없이 "반 석차"로 의미만 재정의(SQL 주석 추가). 프론트/응답 JSON
  키는 `rank`(반석차)로 유지하고, 신설 `rank_in_grade` → `rankInGrade`(전교석차)로 매핑한다.
- **이 이슈 범위의 `exam_type` 고정값**: 학생 상세 페이지에서 생성하는 항목은 항상
  `exam_type = '학교시험'`. 프론트는 POST 시 `examType: '학교시험'`을 명시 전송한다(이슈 2에서
  모의고사 화면이 같은 엔드포인트에 `'모의고사'`로 재사용).

## 1. 백엔드

### 1-1. 마이그레이션 `backend/migrations/006_extend_grades.sql`

```sql
-- Phase 5: grades 테이블에 학교성적/모의고사 구분 및 등급·전교석차 컬럼 추가
-- 기존 rank 컬럼은 이제 "반 석차"를 의미한다 (컬럼명 변경 없음, 의미만 재정의).

ALTER TABLE grades
  ADD COLUMN exam_type text CHECK (exam_type IN ('학교시험', '모의고사')),
  ADD COLUMN grade_level integer CHECK (grade_level >= 1 AND grade_level <= 9),
  ADD COLUMN rank_in_grade integer;

COMMENT ON COLUMN grades.rank IS '반 석차 (같은 반 내 순위)';
COMMENT ON COLUMN grades.rank_in_grade IS '전교 석차 (학교 전체 순위)';

CREATE INDEX idx_grades_exam_type ON grades(exam_type);
```

비고:
- `exam_type`은 마이그레이션에서 `NOT NULL`로 강제하지 않는다(기존 행이 있을 수 있어 백필 없이
  안전 추가). 애플리케이션 레벨(POST 검증)에서 신규 행은 필수로 강제한다.
- `score`는 기존 `numeric NOT NULL` 그대로 유지, 0~100 범위 제약은 DB CHECK로 추가하지 않고
  (기존 프로젝트 패턴상 `students.ts`/`classes.ts` 모두 범위 검증을 애플리케이션 레벨에서만 수행)
  라우트 `validatePayload`에서 검증한다 — 기존 패턴과의 일관성 우선.
- `idx_grades_student_id`는 001_init.sql에 이미 존재하므로 재생성하지 않는다.

### 1-2. `backend/src/routes/grades.ts` 신설

`students.ts` 패턴(인터페이스 Row, `toXxx` 매핑, `SELECT_*` 상수, `validatePayload`)을 그대로 따른다.

```ts
import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface GradeRow {
  id: string
  student_id: string
  subject: string
  exam_name: string
  exam_type: '학교시험' | '모의고사'
  score: string          // numeric은 pg가 string으로 반환
  grade_level: number | null
  rank: number | null
  rank_in_grade: number | null
  exam_date: string
}

function toGrade(row: GradeRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    subject: row.subject,
    examName: row.exam_name,
    examType: row.exam_type,
    score: Number(row.score),
    gradeLevel: row.grade_level,
    rank: row.rank,
    rankInGrade: row.rank_in_grade,
    examDate: row.exam_date,
  }
}

const SELECT_GRADE = `
  SELECT id, student_id, subject, exam_name, exam_type, score, grade_level, rank, rank_in_grade, exam_date
  FROM grades
`

interface GradePayload {
  studentId?: string
  examName?: string
  examType?: string
  score?: number
  gradeLevel?: number | null
  rank?: number | null
  rankInGrade?: number | null
  examDate?: string
}

const EXAM_TYPES = ['학교시험', '모의고사'] as const

function validatePayload(body: GradePayload) {
  const { studentId, examName, examType, score, gradeLevel, examDate } = body
  if (!studentId || !examName || !examType || !examDate) {
    return '학생, 시험명, 성적 유형, 시험일은 필수입니다.'
  }
  if (!EXAM_TYPES.includes(examType as (typeof EXAM_TYPES)[number])) {
    return '성적 유형은 학교시험 또는 모의고사만 입력할 수 있습니다.'
  }
  if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100) {
    return '점수는 0~100 사이여야 합니다.'
  }
  if (gradeLevel != null && (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 9)) {
    return '등급은 1~9 사이 정수여야 합니다.'
  }
  return null
}

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

// POST /api/grades
router.post('/', async (req, res) => {
  const body = req.body as GradePayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { studentId, examName, examType, score, gradeLevel, rank, rankInGrade, examDate } = body

  const created = await pool.query<{ id: string }>(
    `INSERT INTO grades (student_id, subject, exam_name, exam_type, score, grade_level, rank, rank_in_grade, exam_date)
     VALUES ($1, '수학', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [studentId, examName, examType, score, gradeLevel ?? null, rank ?? null, rankInGrade ?? null, examDate],
  )

  const result = await pool.query<GradeRow>(`${SELECT_GRADE} WHERE id = $1`, [created.rows[0].id])
  res.status(201).json(toGrade(result.rows[0]))
})

// DELETE /api/grades/:id
router.delete('/:id', async (req, res) => {
  const deleted = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '성적을 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
```

`backend/src/app.ts`에 등록 추가 필요 (다른 이슈 파일이 아닌 구현 단계에서 처리):
```ts
import gradesRouter from './routes/grades.js'
// ...
app.use('/api/grades', gradesRouter)
```

### 1-3. 엔드포인트 요약

| 메서드 | 경로 | 인증 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/api/grades?studentId=&examType=` | 필요 | 쿼리: `studentId`(필수), `examType`(선택) | 200, `GradeRecord[]` |
| POST | `/api/grades` | 필요 | body: `{ studentId, examName, examType, score, gradeLevel?, rank?, rankInGrade?, examDate }` | 201, `GradeRecord` |
| DELETE | `/api/grades/:id` | 필요 | - | 204 |

`studentId` 없이 GET 호출 시 400(신규 검증, 기존 패턴에 없던 케이스지만 grades는 student 종속
리소스이므로 필수화). 인증 실패 시 전부 401 (`requireAuth` 공통 미들웨어).

## 2. 프론트엔드

### 2-1. `src/types/grade.ts` 변경

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

export type HomeworkStatus = '완료' | '진행중' | '미제출'

export interface HomeworkRecord {
  id: string
  studentName: string
  title: string
  dueDate: string
  status: HomeworkStatus
}
```

`GradeHistoryPoint`(`src/mocks/student-grade-history.ts`)는 더 이상 사용하지 않는다 — 차트 데이터는
`GradeRecord[]`를 `{ examName, score }` 형태로 파생시켜 사용(아래 2-3 참고). 이 이슈 완료 시
`src/mocks/student-grade-history.ts` 파일 및 `MOCK_GRADE_HISTORY` 참조를 삭제한다.

### 2-2. `src/lib/api-client.ts` 재사용 (신규 함수 불필요)

기존 `apiClient.get/post/delete` 제네릭을 그대로 사용한다. 전용 래퍼 함수를 신설하지 않고
`student-detail-page.tsx` 내부에서 직접 호출한다(기존 프로젝트에 `students`/`classes` 전용
API 모듈이 별도로 없고 페이지 컴포넌트에서 `apiClient`를 직접 호출하는 패턴 — 확인 필요 시
`students-page.tsx` 참고. 동일 패턴 유지).

호출 시그니처:
```ts
apiClient.get<GradeRecord[]>(`/grades?studentId=${id}&examType=학교시험`)
apiClient.post<GradeRecord>('/grades', {
  studentId: id,
  examName,
  examType: '학교시험',
  score,
  gradeLevel,
  rank,
  rankInGrade,
  examDate,
})
apiClient.delete<void>(`/grades/${gradeId}`)
```

### 2-3. `src/pages/student-detail-page.tsx` 변경

- **제거**: `import { MOCK_GRADE_HISTORY } from '../mocks/student-grade-history'` 및
  `const gradeHistory = MOCK_GRADE_HISTORY[student.id] ?? []` (기존 152~153행 부근).
- **추가 상태**:
  ```ts
  const [schoolGrades, setSchoolGrades] = useState<GradeRecord[]>([])
  const [gradeFormState, setGradeFormState] = useState({
    examName: '',
    score: '',
    gradeLevel: '',
    rank: '',
    rankInGrade: '',
    examDate: '',
  })
  const [gradeFormError, setGradeFormError] = useState<string | null>(null)
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)
  ```
- **파생 데이터** (차트용, 기존 `gradeHistory` 변수명 유지해 JSX 변경 최소화):
  ```ts
  const gradeHistory = schoolGrades.map((g) => ({ examName: g.examName, score: g.score }))
  ```
- **조회 함수** (학생 로딩 `useEffect`와 병렬로 또는 그 안에서 호출):
  ```ts
  async function fetchSchoolGrades(studentId: string): Promise<void> {
    const data = await apiClient.get<GradeRecord[]>(`/grades?studentId=${studentId}&examType=학교시험`)
    setSchoolGrades(data)
  }
  ```
- **입력 핸들러**:
  ```ts
  function handleGradeFormChange(field: keyof typeof gradeFormState, value: string): void
  ```
- **제출 핸들러** (인라인 검증 후 실패 시 `setGradeFormError`, 성공 시 폼 초기화 + 목록 갱신):
  ```ts
  async function handleAddGrade(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const score = Number(gradeFormState.score)
    if (gradeFormState.examName.trim() === '' || gradeFormState.examDate === '') {
      setGradeFormError('시험명과 시험일은 필수입니다.')
      return
    }
    if (Number.isNaN(score) || score < 0 || score > 100) {
      setGradeFormError('점수는 0~100 사이로 입력해주세요.')
      return
    }
    setGradeFormError(null)
    setIsSubmittingGrade(true)
    try {
      const created = await apiClient.post<GradeRecord>('/grades', {
        studentId: student.id,
        examName: gradeFormState.examName,
        examType: '학교시험',
        score,
        gradeLevel: gradeFormState.gradeLevel ? Number(gradeFormState.gradeLevel) : null,
        rank: gradeFormState.rank ? Number(gradeFormState.rank) : null,
        rankInGrade: gradeFormState.rankInGrade ? Number(gradeFormState.rankInGrade) : null,
        examDate: gradeFormState.examDate,
      })
      setSchoolGrades((prev) => [...prev, created])
      setGradeFormState({ examName: '', score: '', gradeLevel: '', rank: '', rankInGrade: '', examDate: '' })
    } catch {
      setGradeFormError('성적 저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmittingGrade(false)
    }
  }
  ```
- **삭제 핸들러** (기존 `confirm()` 패턴 재사용):
  ```ts
  async function handleDeleteGrade(gradeId: string): Promise<void> {
    if (!confirm('이 성적을 삭제하시겠습니까?')) return
    await apiClient.delete<void>(`/grades/${gradeId}`)
    setSchoolGrades((prev) => prev.filter((g) => g.id !== gradeId))
  }
  ```
- **UI 배치**: 기존 "성적 추이" `Card`(311~329행 부근) 내부 상단에 입력 폼(Input × 5 +
  저장 Button, `gradeFormError` 있을 시 `text-error-*` 인라인 문구 — `error` 시맨틱 토큰 재사용)과
  하단에 목록(`Table` 재사용, 각 행에 삭제 `Button variant="ghost"` 또는 기존 삭제 버튼 스타일)을
  추가한다. 기존 `<LineChart data={gradeHistory}>` JSX 블록은 데이터 소스만 mock에서 파생값으로
  바뀔 뿐 구조 변경 없음.
- **필수 학기 입력 관련**: 0절 결정에 따라 별도 학기 `<select>`/`<input>`은 만들지 않는다.
  `examName` placeholder를 `"예: 2학기 중간고사"`로 안내한다.

## 3. 테스트 시나리오

### 3-1. 백엔드 (Vitest + supertest, `backend/test/grades.test.ts` 신설 가정)

**정상**
1. `POST /api/grades`에 필수값(studentId/examName/examType='학교시험'/score/examDate) 정상 입력 →
   201, 응답 body의 `examType`이 `'학교시험'`, `score`가 숫자로 반환.
2. `gradeLevel`/`rank`/`rankInGrade`를 생략하고 POST → 201, 응답에서 해당 필드들이 `null`.
3. `GET /api/grades?studentId=xxx&examType=학교시험` → 방금 생성한 항목이 배열에 포함, `examDate` 오름차순 정렬 확인(2건 이상 등록 후).
4. `DELETE /api/grades/:id` (존재하는 id) → 204, 이후 같은 studentId GET 결과에서 해당 id 제거 확인.

**경계**
5. `score = 0` POST → 201 (경계값 허용).
6. `score = 100` POST → 201 (경계값 허용).
7. `gradeLevel = 1`, `gradeLevel = 9` POST 각각 → 201 (경계값 허용).

**예외**
8. `score = -1` POST → 400, 에러 메시지 포함.
9. `score = 100.1` POST → 400.
10. `gradeLevel = 0` 또는 `gradeLevel = 10` POST → 400.
11. `examType = '기타'`(허용값 외) POST → 400.
12. `studentId`/`examName`/`examType`/`examDate` 중 하나 누락 POST → 400.
13. `GET /api/grades` (studentId 쿼리 없이 호출) → 400.
14. `DELETE /api/grades/:id` (존재하지 않는 id, 예: `00000000-0000-0000-0000-000000000000`) → 404.
15. (`auth-guards.test.ts`에 추가) 토큰 없이 `GET /api/grades?studentId=x` → 401.
16. 토큰 없이 `POST /api/grades` → 401.
17. 토큰 없이 `DELETE /api/grades/:id` → 401.
18. SQL 인젝션 문자열을 `examName`에 넣어 POST → 201이면서 문자열이 그대로 안전하게 저장(파라미터
    바인딩 검증, `classes.test.ts`의 기존 패턴과 동일).

### 3-2. 프론트엔드 (Vitest + React Testing Library, `student-detail-page.test.tsx` 확장 가정)

**정상**
1. 학기/시험명/점수/등급/반석차/전교석차를 입력하고 저장 버튼 클릭 → `apiClient.post` 호출 확인,
   성공 응답 후 학교 성적 목록에 새 행이 렌더링됨.
2. 학교 성적이 2건 이상인 학생 상세 페이지 진입 → `LineChart`에 `examName` 개수만큼의 데이터
   포인트(라인 X축 항목)가 렌더링됨(예: `recharts` mock 또는 DOM에 렌더된 텍스트로 검증).
3. 삭제 버튼 클릭 후 확인 다이얼로그에서 확인(`window.confirm` mock → `true`) → `apiClient.delete`
   호출 확인, 목록/그래프에서 해당 항목이 사라짐.

**경계**
4. 점수 입력값 `0` 저장 → 정상 저장(에러 없음).
5. 점수 입력값 `100` 저장 → 정상 저장(에러 없음).

**예외**
6. 점수 입력값 `-1` 또는 `101` 입력 후 저장 시도 → 인라인 에러 메시지 표시, `apiClient.post`가
   호출되지 않음(폼 값도 그대로 유지).
7. 시험명 또는 시험일을 비운 채 저장 시도 → 인라인 에러 메시지 표시, API 호출 없음.
8. 삭제 버튼 클릭 후 확인 다이얼로그에서 취소(`window.confirm` mock → `false`) → `apiClient.delete`
   미호출, 목록 변화 없음.
9. `apiClient.post`가 실패(reject)하는 경우 → 인라인 에러 메시지 표시, 목록에 낙관적으로 추가되지
   않음(현재 설계는 성공 응답 후에만 상태 갱신이므로 별도 롤백 불필요 — 실패 시 목록 변화 없음을
   검증).
10. 학교 성적이 0건인 학생 상세 페이지 진입 → 그래프 영역에 빈 상태 처리(기존 `gradeHistory.length > 0` 조건부 렌더링 유지) 확인, 에러 없이 정상 렌더링.

## 4. AC ↔ 시나리오 커버리지 매핑

| AC | 커버 시나리오 |
|---|---|
| 입력→저장→목록 표시 | 백엔드 1, 프론트 1 |
| 2건 이상 시 추이 그래프 | 백엔드 3, 프론트 2 |
| 점수 범위 밖 → 인라인 에러, 미저장 | 백엔드 8·9, 프론트 6 |
| 삭제 확인 다이얼로그 → 목록/그래프에서 제거 | 백엔드 4, 프론트 3·8 |
| 미인증 → 401 | 백엔드 15·16·17 |
