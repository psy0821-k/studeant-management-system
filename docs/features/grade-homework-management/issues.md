# 성적/과제 관리 (Phase 5) — 이슈 분해

수직 슬라이싱 원칙(각 이슈만으로 사용자에게 보여줄 동작이 있어야 함)에 따라 4개 이슈로 분해.
의존성 순서대로 배치.

| 이슈 | GitHub |
|---|---|
| 이슈 1: 학교 성적 | [#9](https://github.com/psy0821-k/studeant-management-system/issues/9) |
| 이슈 2: 모의고사 관리 메뉴 | [#10](https://github.com/psy0821-k/studeant-management-system/issues/10) |
| 이슈 3: 과제 관리(반/개별) | [#11](https://github.com/psy0821-k/studeant-management-system/issues/11) |
| 이슈 4: 과제 상태 순환 | [#12](https://github.com/psy0821-k/studeant-management-system/issues/12) |

## 이슈 1: 학교 성적 — 학생 상세 페이지에서 입력/조회/삭제 (백엔드+프론트 포함)

강사가 학생 상세 페이지에서 학교 성적(점수/등급/반석차/전교석차)을 입력·조회·삭제하고, 추이
그래프를 볼 수 있다. `grades` 테이블 확장 마이그레이션과 `grades` API 라우트 신설을 포함한다
(이후 이슈 2의 모의고사 기능이 같은 테이블/라우트를 재사용하는 기반이 됨).

### Acceptance Criteria
- [ ] Given 학생 상세 페이지, When 강사가 학기/시험명/점수/등급/반석차/전교석차를 입력해 저장하면,
      Then 학교 성적 목록에 새 항목이 표시된다.
- [ ] Given 학교 성적이 2건 이상 등록된 학생, When 상세 페이지를 열면, Then 점수 추이 그래프에
      시험명(X축)-점수(Y축) 라인이 그려진다.
- [ ] Given 점수 입력값이 0~100 범위를 벗어나면, When 저장을 시도하면, Then 인라인 에러 메시지가
      표시되고 저장되지 않는다.
- [ ] Given 이미 등록된 학교 성적 항목, When 강사가 삭제를 클릭하고 확인 다이얼로그에서 확인하면,
      Then 해당 항목이 목록과 그래프에서 사라진다.
- [ ] Given 로그인하지 않은 상태, When 성적 API를 직접 호출하면, Then 401이 반환된다.

### 담당
- backend-developer: `006_extend_grades.sql` 마이그레이션, `backend/src/routes/grades.ts` 신설
  (GET/POST/DELETE, `exam_type='학교시험'` 필터 지원).
- frontend-developer: `student-detail-page.tsx`에 학교 성적 섹션 추가, mock(`MOCK_GRADE_HISTORY`) 제거
  후 API 연동.

---

## 이슈 2: 모의고사 관리 메뉴 신설 (신규 라우트 `/mock-exams`)

강사가 새 메뉴에서 모의고사 성적을 학생별로 입력·조회·삭제하고 추이 그래프를 본다. 이슈 1에서 만든
`grades` API를 `exam_type='모의고사'`로 재사용한다.

### Acceptance Criteria
- [ ] Given 사이드바, When 강사가 메뉴를 보면, Then "모의고사 관리" 항목이 표시되고 클릭 시
      `/mock-exams`로 이동한다.
- [ ] Given 모의고사 관리 페이지, When 강사가 학생을 선택하고 시험명/점수/등급/석차를 입력해
      저장하면, Then 해당 학생의 모의고사 목록에 새 항목이 표시된다.
- [ ] Given 같은 학생의 모의고사 성적이 2건 이상, When 그 학생을 선택하면, Then 점수 추이 그래프가
      표시된다.
- [ ] Given 학교 성적으로 등록된 항목, When 모의고사 관리 페이지를 조회하면, Then 그 항목은
      목록에 나타나지 않는다 (`exam_type` 필터링 검증).
- [ ] Given 이미 등록된 모의고사 항목, When 강사가 삭제를 확인하면, Then 목록에서 사라진다.

### 담당
- backend-developer: 이슈 1의 `grades.ts` 라우트에 `exam_type` 쿼리 파라미터 필터링 추가(신규
  테이블/마이그레이션 없음).
- frontend-developer: `mock-exams-page.tsx` 신설, `App.tsx` 라우트 등록, `sidebar.tsx` 메뉴 추가.

### 의존성
이슈 1의 `grades` API·마이그레이션이 선행되어야 한다.

---

## 이슈 3: 과제 관리 — 반/개별 등록 및 삭제 (백엔드+프론트, 메뉴 개편)

강사가 개편된 "과제 관리" 메뉴(`/homework`, 기존 `/grades` 대체)에서 반 전체 또는 개별 학생에게
과제를 등록하고 삭제할 수 있다.

### Acceptance Criteria
- [ ] Given 과제 관리 페이지, When 강사가 반을 선택해 과제를 등록하면, Then 해당 반 소속 학생
      전원에 대해 제출 현황 행이 생성된다.
- [ ] Given 과제 관리 페이지, When 강사가 반 대신 특정 학생 1명을 선택해 과제를 등록하면, Then
      그 학생 1명분의 제출 현황 행만 생성된다.
- [ ] Given 과제 등록 폼, When 강사가 반과 학생을 동시에 선택하거나 둘 다 선택하지 않고 저장을
      시도하면, Then 인라인 에러가 표시되고 저장되지 않는다.
- [ ] Given 기존에 등록된 과제, When 강사가 삭제를 확인하면, Then 그 과제와 연결된 모든 학생의
      제출 현황 행도 함께 삭제된다.
- [ ] Given 사이드바, When 강사가 메뉴를 보면, Then 기존 "성적/과제 관리" 대신 "과제 관리" 항목만
      표시되고 `/grades`가 아닌 `/homework`로 연결된다.

### 담당
- backend-developer: `007_extend_homework.sql` 마이그레이션(`class_id` nullable화, `student_id` 추가,
  XOR CHECK 제약), `backend/src/routes/homework.ts` 신설(GET/POST/DELETE).
- frontend-developer: `homework-page.tsx`로 개편(기존 `grades-page.tsx` 대체), `App.tsx`/`sidebar.tsx`
  라우트·메뉴 갱신, mock(`MOCK_HOMEWORK`) 제거 후 API 연동.

### 의존성
이슈 1·2와 독립적으로 병렬 진행 가능 (다른 테이블/라우트를 다룸).

---

## 이슈 4: 과제 제출 상태 순환 변경 (배지 클릭 UX)

강사가 과제별 학생 목록에서 제출 상태 배지를 클릭해 미제출→진행중→완료 순서로 빠르게 바꿀 수 있다.

### Acceptance Criteria
- [ ] Given 과제 상세(학생별 제출 현황 목록), When 강사가 "미제출" 배지를 클릭하면, Then 상태가
      "진행중"으로 바뀌고 배지 색상(톤)도 함께 바뀐다.
- [ ] Given "진행중" 상태의 배지, When 강사가 클릭하면, Then "완료"로 바뀐다.
- [ ] Given "완료" 상태의 배지, When 강사가 클릭하면, Then 다시 "미제출"로 순환한다.
- [ ] Given 상태 변경 중 네트워크 오류가 발생하면, When 클릭 직후 실패 응답을 받으면, Then 배지가
      원래 상태로 되돌아가고 에러가 표시된다.

### 담당
- backend-developer: `homework.ts`에 `PUT /homework-submissions/:id` (상태 변경) 엔드포인트 추가.
- frontend-developer: `Badge` 컴포넌트를 클릭 가능하게 감싸는 형태로 상태 순환 UI 구현, 낙관적
  업데이트 + 실패 시 롤백.

### 의존성
이슈 3(`homework`/`homework_submissions` API)이 선행되어야 한다.

---

## 검증 단계 (모든 이슈 공통)

각 이슈의 tdd-loop-auto 완료 후, `math-academy-teacher-reviewer` 서브에이전트가 다음을 확인한다:
- 화면 라벨/흐름이 비개발자 강사 입장에서 직관적인가.
- 40명 규모 반복 입력/확인 동선이 번거롭지 않은가.
- 수학 단일 과목 가정에 맞지 않는 불필요한 UI(과목 선택 등)가 없는가.
