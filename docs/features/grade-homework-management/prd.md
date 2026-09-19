# 성적/과제 관리 (Phase 5) PRD

## 개요

수학 학원 강사가 (1) 학생 상세 페이지에서 학교 성적(내신)을, (2) 신규 모의고사 관리 메뉴에서
모의고사 성적을, (3) 개편된 과제 관리 메뉴에서 반/개별 과제와 제출 현황을 관리할 수 있게 한다.
이번 기획을 계기로 mock 데이터 대신 실제 백엔드(Express + PostgreSQL) 연동까지 구현한다.

## 사용자 스토리

1. 강사로서, 학생 상세 페이지에서 이번 학기 중간고사 성적(점수/등급/반석차/전교석차)을 입력하고,
   지난 시험 대비 점수 추이를 그래프로 보고 싶다.
2. 강사로서, 모의고사 관리 메뉴에서 9월 모의고사 성적을 학생별로 한 번에 입력하고, 학생별 점수
   추이를 확인하고 싶다.
3. 강사로서, 과제 관리 메뉴에서 "3반 전체"에게 숙제를 한 번에 등록하거나, 특정 학생 1명에게만
   보충 과제를 등록하고 싶다.
4. 강사로서, 과제별 학생 목록에서 제출 상태 배지를 클릭해서 미제출→진행중→완료로 빠르게 바꾸고
   싶다 (40명분을 매일 확인해야 하므로 클릭 한 번으로 끝나야 한다).
5. 강사로서, 잘못 입력한 성적/과제를 삭제하고 싶다 (확인 절차를 거쳐서).

## 기술 결정

### 결정 1: 데이터 계층 — 백엔드 연동 범위

**Context** — mock 데이터로 유지할지, 백엔드까지 구현할지 인터뷰에서 "백엔드 연동까지"로 확정됨.
기존 `students`/`classes`/`auth`는 이미 Express+PostgreSQL로 연동되어 있고 동일 패턴
(`requireAuth` 미들웨어, `SELECT_*` 상수, `to*(row)` 매핑 함수, 프론트 `apiClient`)이 확립되어 있음.

**Decision** — 기존 `students.ts`/`classes.ts` 라우트와 동일한 구조로 `grades.ts`, `homework.ts`
라우트를 신설한다. 프론트는 mock(`MOCK_GRADES`, `MOCK_HOMEWORK`, `MOCK_GRADE_HISTORY`)을 제거하고
`apiClient`로 전환한다.

**Alternatives**
- mock 유지: 인터뷰에서 이미 기각됨 (2주 데모 이후 실사용을 고려해 이번에 API까지 만드는 게 효율적).
- GraphQL 등 신규 레이어 도입: 기존 REST 패턴과 불일치, YAGNI 위반으로 기각.

**Consequences** — 장점: Phase 8(AI 분석)·Phase 9(PDF)가 이 데이터를 그대로 재사용할 수 있음,
백엔드 회귀 테스트 패턴(Vitest+supertest)도 그대로 확장 가능. 단점: 프론트/백엔드 양쪽 작업이
필요해 mock 전용보다 작업량이 늘어남.

### 결정 2: `grades` 테이블 — 학교성적/모의고사 구분

**Context** — 기존 단일 `grades` 테이블에 유형 구분이 없음. 학교성적은 점수+등급+반석차+전교석차,
모의고사는 점수(+선택적으로 등급/석차)를 기록해야 함.

**Decision** — `grades` 테이블에 `exam_type text CHECK (exam_type IN ('학교시험','모의고사'))`,
`grade_level integer`(1~9, nullable), `rank_in_grade integer`(nullable) 컬럼을 추가하는 마이그레이션
(`006_extend_grades.sql`)을 작성한다. 기존 `rank` 컬럼은 "반 석차"로 의미를 재정의(컬럼명 변경 없음,
주석으로만 명시)한다. 조회 시 `exam_type`으로 필터링해 화면별로 다르게 노출한다.

**Alternatives**
- `school_grades`/`mock_exam_grades` 테이블 분리: 인터뷰에서 기각(향후 항목 확장 시 스키마 복잡도
  증가, 조회 쿼리 이원화 부담이 이번 규모에 비해 과함).

**Consequences** — 장점: 테이블 하나로 유지해 쿼리·마이그레이션이 단순함, `subject` 컬럼이 이미
있어 향후 다과목 확장도 스키마 변경 없이 가능. 단점: 학교성적 전용 필드(등급/전교석차)가 모의고사
행에도 컬럼으로 존재해 항상 nullable 처리가 필요함(허용 가능한 수준).

### 결정 3: `homework` 테이블 — 반 단위 + 개별 단위 등록

**Context** — 기존 `homework.class_id`가 `NOT NULL`이라 개별 학생 단위 등록이 불가능함.

**Decision** — 마이그레이션으로 `class_id`를 nullable로 변경하고 `student_id uuid REFERENCES
students(id)`(nullable)를 추가한다. DB 레벨 `CHECK` 제약으로 `(class_id IS NOT NULL) != (student_id
IS NOT NULL)`을 강제해 정확히 하나만 채워지도록 한다. 반 단위 등록 시 백엔드가 해당 반 소속 학생
전원에 대해 `homework_submissions`를 생성하고, 개별 단위는 그 학생 1명분만 생성한다.

**Alternatives**
- "학생 1명짜리 가짜 반"으로 우회: 인터뷰에서 기각(데이터 오염, 반 목록에 노출될 위험).

**Consequences** — 장점: DB 제약으로 잘못된 상태(둘 다 채움/둘 다 비움)를 원천 차단, 애플리케이션
검증과 이중 방어. 단점: 기존 `classes.ts`처럼 `class_id` 기준으로만 짜여 있던 조회 쿼리를
`student_id` 기준 조회와 함께 처리하도록 `homework.ts` 라우트를 새로 설계해야 함.

### 결정 4: 프론트 라우트 재구성

**Context** — 기존 `/grades`(성적/과제 관리)를 학교성적(학생상세 이동)·모의고사(신규 메뉴)·
과제(개편)로 3분할해야 함.

**Decision**
- `/grades` 라우트 및 사이드바 메뉴를 제거.
- `/mock-exams` 라우트 신설 (모의고사 관리), 사이드바에 메뉴 추가.
- `/homework` 라우트 신설 (과제 관리, 기존 `/grades` 자리 대체), 사이드바 라벨을 "과제 관리"로 변경.
- `student-detail-page.tsx`에 "학교 성적" 섹션 추가(입력 폼 + 추이 그래프 + 목록/삭제). 기존
  "성적 추이" 카드(현재 mock `MOCK_GRADE_HISTORY` 사용)를 이 섹션으로 대체하고 실제 API 데이터로
  전환한다.

**Alternatives**
- `/grades` 경로를 유지한 채 내부 탭으로 성적/과제 분리: 인터뷰의 "메뉴 개편" 요구와 어긋나고,
  강사 입장에서 모의고사 메뉴가 눈에 띄지 않아 math-academy-teacher-reviewer 관점에서 발견 가능성이
  낮아질 우려로 기각.

**Consequences** — 장점: ROADMAP.md 명시 요구사항과 정확히 일치, 메뉴 구조가 목적별로 명확해짐.
단점: 기존 `/grades`를 북마크/링크한 곳이 있다면(현재 없음, `grep` 확인 완료) 깨짐 — 이번 프로젝트는
아직 배포 전이라 영향 없음.

## Out of Scope

- 성적 유형을 학교시험/모의고사 외 제3의 유형으로 확장.
- 다과목 지원 UI(과목 선택 드롭다운) — `subject`는 항상 `'수학'` 고정값으로 저장, UI에 노출 안 함.
- 성적/과제 데이터의 AI 분석 코멘트 생성 (Phase 8에서 별도 진행).
- 성적표 PDF 출력 (Phase 9에서 별도 진행).
- 학부모 공유/알림 기능.
- 페이지네이션/가상 스크롤 등 대량 데이터 성능 최적화 (40명 규모에서는 불필요).
- `role`(원장/강사) 기반 권한 제약 도입 — 기존 `requireAuth`만 재사용, 신규 권한 로직 없음.
- 반/과제 삭제 시 학생별 실행취소(undo) 기능 — 확인 다이얼로그로만 방지.

## 용어 정의

`docs/features/grade-homework-management/spec-fixed.md` 10절과 동일 (학교 성적/모의고사/점수/등급/
반 석차/전교 석차/과제/제출 상태).
