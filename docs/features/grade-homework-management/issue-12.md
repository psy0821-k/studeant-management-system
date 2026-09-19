# 이슈 12: 과제 제출 상태 순환 변경 (배지 클릭 UX)

GitHub #12 | 선행: 이슈 11(`homework`/`homework_submissions` API, `homework-page.tsx`)

## 결정 사항

### 결정 A: 엔드포인트 경로

- `backend/src/app.ts`에 `app.use('/api/homework', homeworkRouter)`로 이미 마운트되어 있으므로,
  `homework.ts` 라우터 내부에 하위 경로를 추가하는 것이 기존 구조와 일치한다.
- issues.md에 적힌 `PUT /homework-submissions/:id`는 최상위 리소스 경로처럼 보이지만, 실제로는
  `homework_submissions`가 별도 라우터/파일로 분리되어 있지 않고 `homework.ts`에 종속된 하위
  리소스다. 따라서 **`PUT /api/homework/submissions/:id`**로 확정한다
  (`router.put('/submissions/:id', ...)`, `homework.ts` 내부에 추가).
- `router.delete('/:id', ...)`(과제 자체 삭제)와 경로가 겹치지 않도록 `/submissions/:id`를
  `/:id` 라우트보다 **먼저** 등록해 순서 문제를 피한다(Express는 등록 순서대로 매칭 — 현재
  `homework.ts`에는 `/:id` 패턴의 GET/PUT이 없으므로 실질적 충돌은 없지만, 라우트 선언 순서
  관례상 구체적 경로를 먼저 둔다).

### 결정 B: 상태 순환 로직 — 클라이언트 계산 vs 서버 계산

**클라이언트가 다음 상태를 계산해 body로 보내고, 서버는 유효성만 검증한다**로 결정한다.

근거:
- 기존 `grades.ts`/`homework.ts`의 라우트는 모두 "얇은 라우트" 패턴이다 — `validatePayload`가
  입력값이 허용된 집합(`EXAM_TYPES` 등)에 속하는지만 확인하고, 비즈니스 규칙(다음 상태가 무엇인지)
  계산은 하지 않는다. 순환 규칙(미제출→진행중→완료→미제출)을 서버에 넣으면 이 라우트만 유일하게
  "다음 상태 계산"이라는 별도 책임을 갖게 되어 기존 패턴과 어긋난다.
- 프론트가 이미 낙관적 업데이트를 위해 클릭 시점에 다음 상태를 알아야 한다(화면에 즉시
  반영해야 하므로). 즉 클라이언트가 어차피 순환 규칙을 알고 있어야 하는 상황이라, 서버에도
  같은 규칙을 중복 구현하면 두 곳에서 순환 순서를 관리해야 하는 DRY 위반이 된다.
- 서버는 `status`가 `HOMEWORK_STATUSES`(`완료`/`진행중`/`미제출`) 중 하나인지만 검증한다
  (`grades.ts`의 `EXAM_TYPES.includes(...)` 패턴과 동일).
- 리스크: 악의적/버그성 클라이언트가 순환 순서를 어기는 값(예: 미제출→완료 직행)을 보내도
  서버가 막지 않는다. 이 앱은 강사 1인 전용 내부 도구(비개발자 실사용자, 인증된 API)이므로
  순서 위반을 서버가 강제해야 할 보안/데이터 무결성 요구가 없다고 판단한다 — PRD/AC 어디에도
  "서버가 순서를 강제해야 한다"는 요구가 없으므로 YAGNI로 범위를 좁힌다.

### 결정 C: 프론트엔드 배지 클릭 가능 구조

- `src/components/ui/badge.tsx`의 `BadgeProps`는 `HTMLAttributes<HTMLSpanElement>`를 extends하므로
  `onClick`은 이미 타입상 받을 수 있다(`<span onClick={...}>`으로 렌더링됨). 별도로 감싸는
  `<button>`을 만들 필요는 없다 — 다만 접근성을 위해 `role="button"`, `tabIndex={0}`,
  키보드(`Enter`/`Space`) 핸들러를 `homework-page.tsx` 쪽에서 배지에 직접 얹는다(Badge 컴포넌트
  자체의 범용성을 해치지 않기 위해 Badge를 수정하지 않고 사용처에서 속성을 추가하는 방식 — 다른
  화면(대시보드 등)의 Badge는 클릭 불가 상태를 유지해야 하므로 Badge 자체를 "클릭 가능한
  컴포넌트"로 바꾸지 않는다).
- 상태 변경 API 호출은 `homework-page.tsx`에 새 핸들러 `handleSubmissionStatusClick`을 추가해
  처리한다. 별도 컴포넌트 분리는 하지 않는다(현재 `submissions.map`이 이미 `homework-page.tsx`
  안에 있고, 로직이 짧아 분리 시 오히려 props 전달만 늘어남 — YAGNI).

## 백엔드

### `backend/src/routes/homework.ts` 수정 (신설 라우트 추가)

```ts
const HOMEWORK_STATUSES = ['완료', '진행중', '미제출'] as const
type HomeworkSubmissionStatus = (typeof HOMEWORK_STATUSES)[number]

interface UpdateSubmissionStatusPayload {
  status?: string
}

function isValidStatus(status: unknown): status is HomeworkSubmissionStatus {
  return typeof status === 'string' && HOMEWORK_STATUSES.includes(status as HomeworkSubmissionStatus)
}

// PUT /api/homework/submissions/:id
// body: { status: '완료' | '진행중' | '미제출' }
// - 클라이언트가 이미 계산한 다음 상태를 그대로 저장한다(순환 규칙은 프론트 책임 — 결정 B 참고).
// - status가 허용된 값이 아니면 400.
// - :id에 해당하는 submission이 없으면 404.
// - 응답: 갱신된 HomeworkSubmission 단건(camelCase) — { id, studentId, studentName, status }.
//   (프론트가 목록 갱신 시 studentName 등 추가 조회 없이 그대로 반영할 수 있도록 join된 형태로 반환)
router.put('/submissions/:id', async (req, res) => {
  const body = req.body as UpdateSubmissionStatusPayload

  if (!isValidStatus(body.status)) {
    res.status(400).json({ error: '상태는 완료, 진행중, 미제출 중 하나여야 합니다.' })
    return
  }

  const updated = await pool.query<SubmissionRow>(
    `UPDATE homework_submissions hs
     SET status = $1
     FROM students s
     WHERE hs.id = $2 AND s.id = hs.student_id
     RETURNING hs.id, hs.homework_id, hs.student_id, s.name AS student_name, hs.status`,
    [body.status, req.params.id],
  )

  if (updated.rows.length === 0) {
    res.status(404).json({ error: '제출 현황을 찾을 수 없습니다.' })
    return
  }

  const row = updated.rows[0]
  res.json({ id: row.id, studentId: row.student_id, studentName: row.student_name, status: row.status })
})
```

- 이 라우트를 `router.get('/', ...)`/`router.post('/', ...)` 다음, `router.delete('/:id', ...)`
  **이전**에 배치한다(구체적 경로 우선 관례).
- `UPDATE ... FROM students ...RETURNING`으로 학생 이름을 함께 가져오는 것은 `SELECT_HOMEWORK`가
  이미 쓰는 조인 관례와 일치시키기 위함이다(응답에 `studentName`이 필요하므로 별도 SELECT 없이
  단일 쿼리로 처리 — N+1 방지).
- `requireAuth`는 라우터 상단(`router.use(requireAuth)`)에 이미 적용되어 있으므로 이 라우트도
  자동으로 인증 가드를 받는다.

## 프론트엔드

### `src/pages/homework-page.tsx` 수정

```ts
// 결정 B: 순환 규칙은 프론트가 소유한다. status → 다음 status 매핑.
const NEXT_HOMEWORK_STATUS: Record<HomeworkStatus, HomeworkStatus> = {
  미제출: '진행중',
  진행중: '완료',
  완료: '미제출',
}

// 배지 클릭 시 낙관적 업데이트 → 실패 시 롤백.
// homeworkId: 배지가 속한 과제 id(목록에서 해당 과제의 submissions 배열을 찾기 위함)
// submission: 클릭된 제출 현황 항목(현재 status 포함)
async function handleSubmissionStatusClick(
  homeworkId: string,
  submission: HomeworkSubmission,
): Promise<void>
```

- 동작 순서:
  1. `nextStatus = NEXT_HOMEWORK_STATUS[submission.status]` 계산.
  2. `setHomeworkList`로 해당 `homeworkId`의 해당 `submission.id`만 `status: nextStatus`로 즉시
     교체(낙관적 업데이트) — 배지 색상(`HOMEWORK_BADGE_TONE`)은 `status`에서 파생되므로 별도
     처리 없이 자동으로 톤이 바뀐다.
  3. `apiClient.put('/homework/submissions/' + submission.id, { status: nextStatus })` 호출.
  4. 실패(reject) 시: 1단계 이전 상태로 롤백(교체 전 원래 `submission.status`로 되돌림) +
     기존 `deleteError`/`formError`와 같은 패턴으로 에러 상태(`statusUpdateError` 신설)에
     메시지 설정.
  5. 성공 시 별도 처리 없음(이미 2단계에서 반영됨). 서버 응답(`studentName` 등)으로 재동기화할
     필요는 없다 — 요청 시점에 이미 알고 있는 값이라 신뢰 가능(다른 곳(POST 등)도 서버 응답을
     그대로 신뢰하는 관례와 일관되나, 이 케이스는 요청 body와 응답이 사실상 동일하므로 최소한의
     처리만 한다).
- 상태 관리: 기존 `deleteError`처럼 `const [statusUpdateError, setStatusUpdateError] =
  useState<string | null>(null)` 추가, 배지 목록 위/아래에 `{statusUpdateError && <p
  className="text-body-small text-error-500">{statusUpdateError}</p>}` 렌더링.
- 배지 렌더링부 변경:

```tsx
<Badge
  role="button"
  tabIndex={0}
  tone={HOMEWORK_BADGE_TONE[submission.status]}
  className="cursor-pointer select-none"
  onClick={() => handleSubmissionStatusClick(homework.id, submission)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSubmissionStatusClick(homework.id, submission)
    }
  }}
>
  {submission.status}
</Badge>
```

- `Badge` 컴포넌트(`src/components/ui/badge.tsx`) 자체는 수정하지 않는다 — `HTMLAttributes`를
  이미 extends하므로 `onClick`/`onKeyDown`/`role`/`tabIndex`를 그대로 전달받을 수 있다.

### `src/types/grade.ts`

- 타입 변경 없음. `HomeworkStatus`/`HomeworkSubmission`은 이슈 11에서 이미 정의되어 있고 이슈
  12는 그대로 재사용한다(주석에도 "이슈 4(상태 순환)도 계속 사용할 상태 값 — 유지"라고 명시됨).

## 테스트 시나리오

### 백엔드 (Vitest + supertest, `backend/test/homework.test.ts`에 describe 추가)

새 헬퍼 불필요 — 기존 `createTestTeacher`/`createTestStudent`/`createTestClass`와 POST
`/api/homework`로 submission을 만든 뒤 그 `submissions[0].id`를 대상으로 테스트한다.

**정상**
1. `진행중` 상태인 submission에 `PUT /api/homework/submissions/:id`로 `{ status: '완료' }`를
   보내면 200과 함께 `status: '완료'`가 반환된다.
2. 상태 변경 후 `GET /api/homework`로 다시 조회하면 해당 submission의 `status`가 갱신되어
   있다(영속성 확인).
3. 응답 바디에 `studentName`이 포함된다(프론트가 재조회 없이 쓸 수 있는지 확인).

**경계**
4. 순환 규칙을 어기는 값(예: 현재 `미제출`인데 `{ status: '완료' }`를 직접 보냄)도 서버는
   막지 않고 200으로 그대로 저장한다(결정 B: 서버는 순서를 강제하지 않음 — 이 동작 자체를
   명시적으로 검증하는 테스트).

**예외**
5. `{ status: '보류' }`처럼 허용되지 않은 문자열을 보내면 400과 에러 메시지를 반환한다.
6. `status` 필드를 생략하고 PUT하면 400을 반환한다.
7. 존재하지 않는 submission id로 PUT하면 404와 에러 메시지를 반환한다.

**인증 가드**
8. 토큰 없이 `PUT /api/homework/submissions/:id` → 401.

### 프론트 (Vitest + RTL, `src/pages/homework-page.test.tsx`에 테스트 추가)

`apiClient.put`은 이미 mock 설정(`vi.fn()`)이 되어 있으므로 재사용한다.

**정상 (AC 1~3 커버)**
1. `상태: 미제출`인 배지를 클릭하면 화면에 즉시 "진행중"으로 바뀌고(낙관적 업데이트),
   `apiClient.put`이 `/homework/submissions/{submissionId}`, `{ status: '진행중' }`으로
   호출된다.
2. `상태: 진행중`인 배지를 클릭하면 "완료"로 바뀌고 `apiClient.put`이
   `{ status: '완료' }`로 호출된다.
3. `상태: 완료`인 배지를 클릭하면 "미제출"로 바뀌고 `apiClient.put`이
   `{ status: '미제출' }`로 호출된다(순환 완성 확인).
4. 배지 클릭 시 `Badge`가 실제로 `role="button"`을 가지며 `userEvent.click`으로 클릭 가능함을
   확인한다(접근성 속성 검증).

**경계**
5. 클릭 직후(응답이 오기 전) 화면에는 이미 다음 상태가 표시되어야 한다 — `apiClient.put`을
   `mockImplementation`으로 지연시켜(`new Promise(resolve => setTimeout(resolve, 50))`) 응답
   전에 배지 텍스트가 이미 바뀌어 있는지 확인(낙관적 업데이트가 응답을 기다리지 않음을 증명).

**예외 (AC 4 커버)**
6. `apiClient.put`이 reject되면, 배지가 클릭 이전 상태(예: "미제출")로 되돌아가고 에러 메시지가
   화면에 표시된다 — `mockedApiClient.put.mockRejectedValueOnce(new Error('네트워크 오류'))`로
   시뮬레이션.
7. 실패 후에도 다른 과제/다른 학생의 배지 상태는 영향받지 않는다(롤백이 해당 submission에만
   국한됨을 확인).

## 확인한 기존 파일 (일관성 근거)

- `backend/src/routes/homework.ts` — 기존 GET/POST/DELETE 라우트 패턴, `SELECT_HOMEWORK`/
  `fetchSubmissionsByHomeworkIds` 조인 방식.
- `backend/src/routes/grades.ts` — "얇은 라우트" 검증 패턴(`EXAM_TYPES.includes(...)`) 근거.
- `backend/src/app.ts` — `/api/homework` 마운트 지점 확인.
- `backend/test/homework.test.ts`, `backend/test/helpers.ts` — 기존 테스트 구조·헬퍼 재사용.
- `src/pages/homework-page.tsx` — 현재 배지 렌더링 위치(`HOMEWORK_BADGE_TONE`,
  `submissions.map`), `deleteError` 등 기존 에러 상태 관리 패턴.
- `src/pages/homework-page.test.tsx` — `apiClient` mock 패턴(`vi.mock('../lib/api-client')`),
  `mockedApiClient.put`이 이미 mock 함수로 선언되어 있음(현재는 미사용).
- `src/types/grade.ts` — `HomeworkStatus`/`HomeworkSubmission` 기존 정의, "이슈 4도 계속 사용"
  주석 확인.
- `src/components/ui/badge.tsx` — `BadgeProps extends HTMLAttributes<HTMLSpanElement>` 구조
  확인(onClick 전달 가능, 컴포넌트 자체 수정 불필요).
- `src/lib/api-client.ts` — `apiClient.put` 시그니처(`put: <T>(path: string, body?: unknown)`)
  확인.

## 향후 개선 필요

- 배지를 연타(더블 클릭)하면 이전 요청이 끝나기 전에 다음 요청이 겹쳐 순환 순서가 꼬일 수 있다
  (요청 진행 중 배지 클릭 중복 방지 미구현) — 이번 이슈 범위 밖이라 손대지 않음.
