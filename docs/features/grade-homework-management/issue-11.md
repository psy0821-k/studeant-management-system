# 이슈 11: 과제 관리 — 반/개별 등록 및 삭제 (메뉴 개편 `/homework`)

GitHub #11 | PRD 결정 3, 결정 4 참고

## 결정 사항

### 결정 A: `homework`/`grades-page.tsx` 처리 범위

- `grades-page.tsx`는 **삭제**하고 `homework-page.tsx`를 신설한다 (PRD 결정 4에 따라 `/grades`
  라우트 자체가 제거되므로, 남겨둘 이유가 없다 — YAGNI).
- `src/mocks/grades.ts`의 `MOCK_HOMEWORK`와 그 타입 사용처(`grades-page.tsx`)를 함께 제거한다.
  `MOCK_GRADES`(학교 성적 요약 mock)는 이슈 1/2 범위이므로 이 이슈에서는 건드리지 않는다 —
  단, `grades-page.tsx` 삭제 시 `MOCK_GRADES`를 참조하는 곳이 이 페이지뿐이라면 함께 정리 대상이
  되나, 이슈 1/2 완료 여부에 따라 참조가 남아있을 수 있으므로 **`grades-page.tsx` 삭제 후
  `MOCK_GRADES` 참조가 남아있는지 grep으로 확인하고, 없으면 `MOCK_GRADES` export도 제거**한다.
- `src/types/grade.ts`의 `HomeworkStatus`/`HomeworkRecord`는 이 이슈에서 **재정의**한다(하위 호환
  불필요 — 아직 백엔드 연동 전이라 실사용 데이터 없음). 새 타입은 같은 파일(`grade.ts`)에 둔다 —
  `class.ts`/`student.ts`처럼 도메인별 파일 분리 관례를 따르면 `homework.ts` 신설도 타당하나,
  기존 `grade.ts`에 이미 `HomeworkStatus`/`HomeworkRecord`가 있었고 이슈 4(상태 순환)도 같은
  파일을 계속 확장할 것이므로 **`grade.ts` 유지 + 내용만 교체**로 결정한다(불필요한 파일 분리 방지).

### 결정 B: XOR 검증 위치

- DB CHECK 제약(마이그레이션)과 애플리케이션 레벨 검증(라우트 핸들러) 이중 방어 — PRD 결정 3
  Consequences에 명시된 대로다.
- 프론트 폼에서도 라디오 토글로 반/학생 양자택일을 강제해 애초에 잘못된 조합이 요청되지 않도록
  한다(3중 방어: UI 토글 → 프론트 검증 → 백엔드 검증 → DB 제약).

### 결정 C: 삭제 시 submissions 처리 — CASCADE vs 명시적 삭제

- 마이그레이션에서 `homework_submissions.homework_id` FK에 `ON DELETE CASCADE`를 **추가하지 않는다**
  (001_init.sql 원본 정의를 이 이슈에서 변경하지 않기 위함 — FK 옵션 변경은 별도 컬럼 드롭/재생성이
  필요해 범위가 커짐). 대신 `DELETE FROM homework WHERE id = $1` 이전에 애플리케이션 코드에서
  `DELETE FROM homework_submissions WHERE homework_id = $1`을 명시적으로 먼저 실행한다
  (`classes.ts`의 `DELETE /:id`가 연관 리소스를 애플리케이션에서 먼저 정리하는 것과 동일 패턴).

## 백엔드

### 마이그레이션 `backend/migrations/007_extend_homework.sql`

```sql
-- Phase 5: homework 테이블에 개별 학생 단위 등록 지원 추가
-- class_id를 nullable로 변경하고 student_id를 추가해 반 단위/개별 단위를 XOR로 강제한다.

ALTER TABLE homework
  ALTER COLUMN class_id DROP NOT NULL,
  ADD COLUMN student_id uuid REFERENCES students(id);

ALTER TABLE homework
  ADD CONSTRAINT homework_class_or_student_xor
    CHECK ((class_id IS NOT NULL) != (student_id IS NOT NULL));

CREATE INDEX idx_homework_student_id ON homework(student_id);
```

- 기존 `idx_homework_class_id` 인덱스는 유지(반 단위 조회 시 여전히 사용됨).
- 006_extend_grades.sql과 동일하게 `COMMENT ON`은 생략(간단한 컬럼 추가라 불필요 판단, 006도
  ALTER 자체엔 주석 없음).

### `backend/src/routes/homework.ts` (신설)

`classes.ts`/`grades.ts` 패턴(상단에 `requireAuth` 적용, `SELECT_*` 상수, `toXxx(row)` 매핑 함수,
`validatePayload` 함수) 그대로 따른다.

```ts
import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface HomeworkRow {
  id: string
  class_id: string | null
  student_id: string | null
  title: string
  created_by: string
  created_at: string
}

interface SubmissionRow {
  id: string
  homework_id: string
  student_id: string
  student_name: string
  status: '완료' | '진행중' | '미제출'
  updated_at: string
}

interface HomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  status: '완료' | '진행중' | '미제출'
}

interface HomeworkWithSubmissions {
  id: string
  classId: string | null
  className: string | null
  studentId: string | null
  studentName: string | null
  title: string
  createdAt: string
  submissions: HomeworkSubmission[]
}

// SELECT_HOMEWORK: homework + (classId 등록이면) 반 이름, (studentId 등록이면) 학생 이름을 함께 조회
// classes.ts의 SELECT_CLASS(LEFT JOIN + GROUP BY)와 달리 homework는 1:1 스칼라 조인이라 GROUP BY 불필요
const SELECT_HOMEWORK = `
  SELECT h.id, h.class_id, h.student_id, h.title, h.created_by, h.created_at,
         c.name AS class_name, s.name AS student_name
  FROM homework h
  LEFT JOIN classes c ON c.id = h.class_id
  LEFT JOIN students s ON s.id = h.student_id
`

async function fetchSubmissionsByHomeworkIds(homeworkIds: string[]): Promise<Map<string, HomeworkSubmission[]>>

interface HomeworkPayload {
  classId?: string | null
  studentId?: string | null
  title?: string
}

function validatePayload(body: HomeworkPayload): string | null

// GET /api/homework
// 등록된 모든 과제 + 각 과제의 학생별 제출 현황(submissions)을 함께 반환한다.
// (40명 규모 목록 전체 조회이므로 페이지네이션 없음 — PRD Out of Scope와 일치)
router.get('/', async (_req, res) => { ... })

// POST /api/homework
// body: { classId?: string, studentId?: string, title: string }
// - classId만 있으면: homework 1건 생성 + 해당 class_id 소속 학생 전원의 homework_submissions
//   생성(status 기본값 '미제출' — PRD 용어 정의상 신규 등록 시 기본 상태. 단, 001_init.sql의
//   homework_submissions.status DEFAULT는 '진행중'이므로 명시적으로 INSERT 시 status를
//   지정할지, DB 기본값('진행중')을 그대로 쓸지는 프론트 표시 요구사항에 달려 있다 —
//   이 문서에서는 DB 컬럼 기본값을 그대로 사용(명시적 INSERT 컬럼 목록에서 status 생략)하기로
//   결정한다. 신규 과제는 "아직 아무도 제출 안 함"이 자연스러우나, 기존 컬럼 DEFAULT를
//   변경하는 것은 이슈 범위 밖(001_init.sql 수정 없음 원칙)이므로 현재 DEFAULT('진행중')를
//   그대로 따른다.
// - studentId만 있으면: homework 1건 생성 + 그 학생 1명분 homework_submissions 생성.
// - 트랜잭션으로 homework INSERT + submissions INSERT(다건은 벌크 INSERT ... SELECT 또는
//   UNNEST 사용)를 원자적으로 처리한다 — classes.ts의 replaceSchedules처럼 client를 pool에서
//   꺼내 BEGIN/COMMIT/ROLLBACK으로 감싼다(기존 라우트들은 단일 쿼리라 트랜잭션이 없었으나,
//   이 라우트는 다중 INSERT라 실패 시 부분 생성을 막기 위해 트랜잭션이 필요하다는 것이
//   기존 패턴과의 차이점 — PR에 근거 명시 필요).
router.post('/', async (req, res) => { ... })

// DELETE /api/homework/:id
// homework_submissions WHERE homework_id = $1 삭제 → homework WHERE id = $1 삭제(RETURNING id로
// 존재 확인) 순서로 실행한다. 존재하지 않는 id면 404.
router.delete('/:id', async (req, res) => { ... })

export default router
```

- `backend/src/app.ts`에 `import homeworkRouter from './routes/homework.js'` 및
  `app.use('/api/homework', homeworkRouter)` 등록, `gradesRouter`는 그대로 유지(이슈 1/2가 사용 중).
- `classId`로 반 소속 학생 전원을 조회할 때는 `classes.ts`의 `SELECT COUNT(s.id) ... FROM students s
  WHERE s.class_id = $1` 대신 `SELECT id FROM students WHERE class_id = $1`로 전체 id 목록을 가져와
  `INSERT INTO homework_submissions (homework_id, student_id) SELECT $1, id FROM students WHERE
  class_id = $2` 형태의 단일 INSERT...SELECT로 처리한다(반복 쿼리 대신 세트 기반 처리, 40명
  규모에서도 N+1 방지).
- 반에 소속 학생이 0명인 경우도 유효한 등록으로 처리한다(에러 아님) — AC에 "학생 전원"이 0명일 때를
  막는 조건이 없고, 빈 반에 과제를 미리 등록해두는 것도 자연스러운 사용 시나리오이므로 차단하지 않는다.

## 프론트엔드

### `src/types/grade.ts` 수정 (재정의)

```ts
// 기존 HomeworkStatus는 유지(이슈 4의 상태 순환 대상)
export type HomeworkStatus = '완료' | '진행중' | '미제출'

export interface HomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  status: HomeworkStatus
}

export interface HomeworkRecord {
  id: string
  classId: string | null
  className: string | null
  studentId: string | null
  studentName: string | null
  title: string
  createdAt: string
  submissions: HomeworkSubmission[]
}

// 등록 폼 입력 — 반/학생 중 정확히 하나만 채워야 함(XOR)을 zod superRefine으로 검증.
// class.ts(classInputSchema)/student.ts(studentInputSchema) 패턴을 따라 이 파일에 함께 정의한다.
export const homeworkInputSchema = z
  .object({
    targetType: z.enum(['class', 'student']),
    classId: z.string().nullable(),
    studentId: z.string().nullable(),
    title: z.string().trim().min(1, '과제명을 입력해주세요.'),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'class' && !value.classId) {
      ctx.addIssue({ code: 'custom', message: '반을 선택해주세요.', path: ['classId'] })
    }
    if (value.targetType === 'student' && !value.studentId) {
      ctx.addIssue({ code: 'custom', message: '학생을 선택해주세요.', path: ['studentId'] })
    }
  })

export type HomeworkInput = z.infer<typeof homeworkInputSchema>
```

- 기존 `HomeworkRecord`(studentName/title/dueDate/status 평면 구조)는 완전히 대체된다 — `dueDate`
  필드는 AC/PRD 어디에도 마감일 요구사항이 없으므로(용어 정의에도 없음) **제거**한다(YAGNE: 요청되지
  않은 필드 추가 금지). 과제 등록 폼에도 마감일 입력은 없다.
- `apiClient` 요청/응답 바디는 `classId`/`studentId`를 그대로 사용(camelCase는 프론트 전용, 백엔드
  라우트가 request body의 camelCase를 그대로 받는 기존 관례 — `grades.ts`의 `GradePayload`와 동일).

### `src/pages/homework-page.tsx` (신설, `grades-page.tsx` 대체)

```ts
function HomeworkPage() {
  // 1. 반 목록(GET /api/classes), 학생 목록(GET /api/students) 조회 — 폼의 select 옵션용.
  //    classes-page.tsx/students-page.tsx가 이미 각각 apiClient.get('/classes'),
  //    apiClient.get('/students')를 쓰므로 동일 엔드포인트 재사용(신규 API 없음).
  // 2. 과제 목록(GET /api/homework) 조회 — 각 과제 카드/행 아래 학생별 제출 현황 표시.
  // 3. 등록 폼: targetType 라디오("반 전체" | "개별 학생") 토글에 따라 반 select 또는 학생
  //    select 중 하나만 활성화, 나머지는 disabled + 값 초기화.
  //    제출 시 homeworkInputSchema로 검증 → 실패 시 인라인 에러(필드 아래 메시지, classInputSchema
  //    검증 실패 시 classes-page.tsx가 하는 방식과 동일하게 error 상태에 매핑).
  // 4. 삭제: 확인 다이얼로그(window.confirm 또는 기존 컴포넌트 관례 확인 필요) → DELETE 성공 시
  //    목록에서 제거.
}
```

- `App.tsx`: `import GradesPage from './pages/grades-page'` → `import HomeworkPage from
  './pages/homework-page'`로 교체, `<Route path="grades" ...>` → `<Route path="homework"
  element={<HomeworkPage />} />`로 교체.
- `sidebar.tsx`: `MENU_ITEMS`의 `{ path: '/grades', label: '성적/과제 관리' }` →
  `{ path: '/homework', label: '과제 관리' }`로 교체(위치는 기존 순서 유지 — "출결 관리" 다음,
  "수강료 관리" 이전).
- `src/mocks/grades.ts`: `MOCK_HOMEWORK` export 제거(사용처가 `grades-page.tsx` 삭제로 없어짐).

## 애매함 — 결정 필요 없음(스스로 채움)

- **제출 현황 목록 UI 위치**: AC는 "제출 현황 행이 생성된다"까지만 요구하고 화면 표시 방식은
  명시하지 않음 → 과제 목록에서 각 과제를 펼치면(또는 항상 펼친 상태로) 학생별 제출 현황 테이블을
  보여주는 것으로 결정(이슈 4가 이 목록의 배지를 클릭 가능하게 만들 것이므로, 이슈 11에서 이미
  목록 형태로 렌더링해두어야 함).
- **삭제 확인 UI**: PRD Out of Scope에 "실행취소 없음, 확인 다이얼로그로만 방지"라고 명시되어 있음
  → `window.confirm` 또는 프로젝트에 이미 확인 모달 컴포넌트가 있다면 그것을 사용(현재 `src/components/ui/`에
  전용 confirm 컴포넌트 없음을 확인했으므로 `window.confirm` 사용, 기존 패턴에 없는 새 UI 컴포넌트를
  만들지 않음).

## 테스트 시나리오

### 백엔드 (Vitest + supertest, `backend/test/homework.test.ts` 신설, `helpers.ts` 재사용)

새 헬퍼 필요: `createTestClass(labelPrefix, teacherId)`(classes 테이블 INSERT),
`assignStudentToClass(studentId, classId)` 또는 `createTestStudent`에 `classId` 옵션 추가 —
`helpers.ts`의 `createTestStudent`는 현재 `class_id`를 받지 않으므로 확장 필요(시그니처:
`createTestStudent(labelPrefix: string, createdByUserId: string, classId?: string | null)`).

**정상**
1. classId만으로 POST하면 201과 함께 homework가 생성되고, 그 반 소속 학생 전원 수만큼
   submissions가 생성된다 (반에 학생 2명을 미리 만들어두고 GET으로 submissions.length === 2 검증).
2. studentId만으로 POST하면 201과 함께 submissions.length === 1, 해당 studentId와 일치.
3. GET /api/homework는 등록된 과제 목록과 각 과제의 submissions를 함께 반환한다.
4. DELETE /api/homework/:id는 204를 반환하고, 이후 GET에서 그 과제와 연결된
   homework_submissions 행도 조회되지 않는다(직접 `SELECT COUNT(*) FROM homework_submissions
   WHERE homework_id = $1`로 0건 확인).

**경계**
5. 학생이 0명인 빈 반으로 classId POST하면 201과 함께 submissions: []가 반환된다(에러 아님).
6. title이 공백만 있는 문자열이면 400을 반환한다(trim 후 빈 문자열 검증).

**예외**
7. classId와 studentId를 둘 다 보내면 400과 에러 메시지를 반환한다.
8. classId와 studentId를 둘 다 생략하면 400을 반환한다.
9. 존재하지 않는 classId로 POST하면 400 또는 404를 반환한다(FK 위반을 애플리케이션에서 사전
   검증 — 존재하지 않는 classId 조회 결과가 0건이면 400 "존재하지 않는 반입니다." 반환, DB
   FK 제약 위반 에러를 그대로 노출하지 않음).
10. 존재하지 않는 studentId로 POST하면 400을 반환한다(위와 동일 사전 검증).
11. DELETE로 존재하지 않는 id를 삭제하면 404와 에러 메시지를 반환한다.
12. title을 생략하고 POST하면 400을 반환한다.
13. title에 SQL 인젝션 문자열을 넣어도 안전하게 저장/조회된다(classes.test.ts/grades.test.ts와
    동일한 방어 테스트 패턴).

**인증 가드**
14. 토큰 없이 GET /api/homework → 401.
15. 토큰 없이 POST /api/homework → 401.
16. 토큰 없이 DELETE /api/homework/:id → 401.

### 프론트 (Vitest + RTL, `src/pages/homework-page.test.tsx` 신설)

`apiClient`를 `vi.mock`하는 패턴은 `student-detail-page.test.tsx`와 동일하게 따른다.

**정상**
1. 반을 선택하고 과제명을 입력해 저장하면 `apiClient.post`가 `{ classId, title }`(studentId 없음)
   형태로 호출되고, 성공 후 목록에 새 과제가 표시된다.
2. "개별 학생" 토글로 전환해 학생을 선택하고 저장하면 `apiClient.post`가
   `{ studentId, title }`(classId 없음) 형태로 호출된다.
3. 삭제 버튼 클릭 후 확인하면 `apiClient.delete`가 호출되고 목록에서 해당 과제가 사라진다.
4. 과제 목록에 학생별 제출 현황(이름 + 상태 배지)이 렌더링된다.

**경계**
5. targetType을 "반 전체"에서 "개별 학생"으로 전환하면 이전에 선택했던 classId 값이 초기화된다
   (반대 방향도 동일) — 전환 후 즉시 저장을 시도해도 이전 선택값이 남아 잘못된 payload가 전송되지
   않음을 검증.

**예외**
6. 반과 학생을 동시에 선택한 상태로 저장을 시도하면(토글 UI상 불가능하지만 방어적으로 스키마
   레벨에서도 막는지 확인하는 것이 목적이라면 이 케이스는 UI 토글이 이미 막으므로 실제로는
   "반/학생 모두 선택 안 하고 저장" 케이스로 대체) — 아무것도 선택하지 않고 저장을 시도하면
   인라인 에러 메시지가 표시되고 `apiClient.post`가 호출되지 않는다.
7. 과제명을 비운 채 저장을 시도하면 인라인 에러가 표시되고 저장되지 않는다.
8. `apiClient.post`가 실패(reject)하면 에러 메시지가 표시되고 폼 데이터가 유지된다(재시도 가능).
9. `apiClient.delete`가 실패하면 에러가 표시되고 목록에서 항목이 사라지지 않는다.

### 사이드바/라우팅 (AC 5 커버)

- `src/components/sidebar.tsx` 테스트(신설 또는 기존 있으면 확장): `MENU_ITEMS`에 "성적/과제 관리"
  라벨/`/grades` 경로가 없고, "과제 관리" 라벨과 `/homework` 경로가 존재함을 검증.
- `src/App.tsx`는 라우트 선언이라 별도 단위 테스트보다는 `homework-page.test.tsx`에서
  `MemoryRouter initialEntries={['/homework']}`로 렌더링해 페이지가 정상 마운트되는지로 간접 검증
  (기존 프로젝트에 App.tsx 자체 라우팅 테스트 파일이 없음을 확인했으므로 새 패턴을 만들지 않음).

## 확인한 기존 파일 (일관성 근거)

- `backend/migrations/001_init.sql` — homework/homework_submissions 원본 스키마.
- `backend/migrations/006_extend_grades.sql` — 직전 마이그레이션 스타일(ALTER TABLE, 인덱스,
  COMMENT ON) 참고.
- `backend/src/routes/classes.ts` — 연관 리소스 트랜잭션 처리(`replaceSchedules`), 삭제 전 참조
  검증, `SELECT_*`/`to*` 패턴.
- `backend/src/routes/grades.ts` — 간단한 CRUD 라우트 패턴, `validatePayload` 함수형 검증.
- `backend/test/grades.test.ts`, `backend/test/classes.test.ts`, `backend/test/helpers.ts` — 테스트
  구조(정상/경계/예외/인증 가드 describe 분리), 헬퍼 재사용 방식.
- `src/pages/grades-page.tsx`, `src/pages/classes-page.tsx` — 폼 상태 관리, `apiClient` 사용 패턴.
- `src/types/grade.ts`, `src/types/class.ts`, `src/types/student.ts` — zod 스키마 동반 타입 정의 관례.
- `src/mocks/grades.ts` — 제거 대상 mock 위치.
- `src/App.tsx`, `src/components/sidebar.tsx` — 라우트/메뉴 등록 위치.
- `src/pages/student-detail-page.test.tsx` — 프론트 테스트에서 `apiClient` mock 패턴.
