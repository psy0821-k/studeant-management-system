# 성적/과제 관리(Phase 5) 작업 방식 — 사용 안내

Phase 5(학교 성적/모의고사/과제 관리) 기능을 만들 때 사용한 작업 흐름 기록. 다음 라운드 이후
비슷한 규모의 기능(예: Phase 4 출결 관리, Phase 6 수강료 관리)을 진행할 때 이 문서를 참고해
같은 방식을 재사용할 수 있다.

## 사용한 파이프라인

```
feature-planner (요구사항 인터뷰 → PRD → 이슈 분해 → GitHub 등록)
    ↓
이슈별 tdd-loop-auto (Red → Green → AC검증 → Refactor → Security → PR)
    ↓ (Green 단계는 역할별 서브에이전트에 위임)
math-academy-teacher-reviewer (실사용성 검증, 매 이슈 완료 후)
```

## 서브에이전트 구성 (`.claude/agents/`)

이번 라운드에서 프로젝트 스코프로 3개를 새로 만들어 사용했다.

- **frontend-developer** — React/TS 화면 구현 전담. `src/` 아래만 건드리고 백엔드는 손대지 않는다.
- **backend-developer** — Express/PostgreSQL 라우트·마이그레이션 전담. `backend/` 아래만 건드린다.
- **math-academy-teacher-reviewer** — 비개발자 강사 관점의 실사용성 검증 전담. 코드는 읽기만 하고
  수정하지 않는다. "이 화면이 학원 강사에게 직관적인가"만 본다.

새로 만든 프로젝트 스코프 에이전트는 **같은 세션 안에서 바로 `Agent` 도구의 `subagent_type`으로
호출되지 않을 수 있다**(이번에 실제로 그랬다 — `.claude/agents/*.md` 파일을 만든 직후 같은 세션에서
`subagent_type: "backend-developer"`를 호출하니 "Agent type not found" 에러가 났다). 이때는
`.claude/agents/<name>.md`의 역할 정의 본문을 그대로 `general-purpose` 에이전트의 프롬프트 맨
앞에 붙여넣는 방식으로 우회했다. 다음 세션부터는 정상적으로 이름으로 호출될 가능성이 높다.

## 이슈별 tdd-loop-auto 진행 순서

1. **0단계 사전점검**: 이슈 AC 확인, 워킹트리 clean 확인, `feature/<spec>` 브랜치에서
   `feat/<issue-slug>` 브랜치로 분기.
2. **1단계 시나리오**: 시그니처와 테스트 시나리오를 `docs/features/{feature}/issue-{N}.md`로
   확정 (subagent 위임).
3. **2단계 Red**: 시나리오를 실패하는 테스트로 옮김 (subagent 위임).
4. **3단계 Green**: 백엔드 변경이 필요하면 backend-developer 역할 → 완료 후 실제 API 응답 형태를
   메인 세션이 직접 코드로 확인 → frontend-developer 역할에 그 형태를 전달하며 순차 위임
   (프론트가 API 형태를 추측하지 않도록 하기 위함).
5. **4단계 AC검증**: `ac-verifier` 에이전트로 독립 검증. **테스트 커버리지 갭이나 프로덕션 코드
   왜곡(예: 테스트 타이밍에 맞춘 인위적 setTimeout)을 여기서 걸러냈다** — 실제로 이번 라운드에서
   이슈 #10(사이드바/필터링 검증 갭 2건), #11(사이드바 검증 갭 1건), #12(setTimeout 편법)를 각각
   잡아내 STOP → 보강/재작업 → 재검증 순으로 처리했다.
6. **5단계 Refactor**: 이번 이슈에서 변경된 파일만 대상으로 정리(시간 제약 15분, 없으면 "정리할
   항목 없음"으로 끝내도록 지시).
7. **6단계 Security**: 타입체크(`tsc`), `npm audit`, `.env` 노출, SQL 파라미터 바인딩, 인증 가드
   확인. 이 프로젝트는 security-review 스킬의 전제(`env.ts` 패턴)와 다르므로 프로젝트 실제 구조에
   맞춰 수동으로 점검 항목을 재구성해서 썼다.
8. **7단계 PR**: E2E(`npm run test:e2e`) 통과 확인 후 push + `gh pr create --draft`로 생성.
   **`base`는 항상 `feature/grade-homework-management`(main이 아님)** — 이 브랜치 자체를 main에
   합칠지는 사용자가 나중에 결정.

## 이슈 간 의존성 처리

이슈 #10이 이슈 #9의 코드(확장된 `grades` 타입/라우트)에 의존했는데, 이슈 #9의 PR이 아직 draft
상태라 `feature/grade-homework-management`에 반영되어 있지 않은 문제가 있었다. 이때:

- **draft PR은 `gh pr merge`로 바로 병합되지 않는다** (`GraphQL: Pull Request is still a draft`
  에러). draft 상태를 유지한 채 그 브랜치 커밋을 상위 feature 브랜치에 반영하려면, PR을 "ready for
  review" 상태로 잠깐 바꾸거나(이번엔 안 함), **로컬에서 `git checkout feature/... && git merge
  feat/<이슈브랜치> && git push`로 직접 병합**하는 방식을 썼다. 이러면 GitHub PR 자체는 자동으로
  머지 표시가 되지 않고 별개로 남는다 — 필요하면 나중에 `gh pr close` 등으로 별도 정리.
- 독립적인 이슈끼리(#11은 #9/#10과 무관, homework 테이블만 다룸)는 base 브랜치에서 바로 분기해
  병렬 진행 가능. `issues.md`에 이 의존성 관계를 미리 명시해두면 이런 판단이 쉬워진다.

## 실사용성 검증에서 나온 대응 패턴

`math-academy-teacher-reviewer`가 지적한 개선사항은 크게 두 종류로 나뉘었다.

- **이번 이슈 범위 내 결함** → 그 자리에서 바로 frontend-developer 역할에 재위임해 수정
  (예: 이슈 #11의 삭제 경고 문구, 라디오 라벨 클릭 불가 등 5건을 한 번에 고침).
- **PRD상 의도된 범위 밖** (예: 모의고사 40명 일괄 입력 UI 부재) → 치명적이지 않으므로 "향후 개선
  여지"로만 기록하고 넘어감. PRD의 Out of Scope와 대조해서 판단 근거를 남겼다.

## 다음에 비슷한 기능을 진행할 때 참고할 점

- AC 검증(`ac-verifier`)을 매번 진짜로 독립 세션에서 돌리는 것이 갭을 잡는 데 실제로 효과가 있었다
  — 구현 세션 스스로는 발견하기 어려운 문제(테스트 커버리지 누락, 테스트를 위한 구현 왜곡)를 세
  이슈 모두에서 걸러냈다.
- 서브에이전트가 "테스트를 통과시키기 위해 프로덕션 코드에 편법(임의 지연 등)을 넣었다"고 스스로
  보고하면, 그 즉시 의심하고 AC 검증 단계에서 반드시 짚고 넘어가야 한다 — 실제로 이번에 그렇게
  잡아냈다.
- draft PR을 유지하면서 여러 이슈를 순차로 쌓아가려면, 매 이슈 시작 전 "이 이슈가 의존하는 앞
  이슈의 PR이 상위 feature 브랜치에 실제로 반영되어 있는지" 코드 레벨로 직접 확인하는 습관이
  필요하다(`git branch --contains <커밋>` 또는 해당 파일이 실제로 존재하는지 확인).
