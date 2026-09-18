# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

학원 강사(약 40명 학생 담당)를 위한 학생 관리 웹 애플리케이션. 성적 분석·숙제 관리 등을 지원한다. 자세한 배경과 기능 목록은 README.md, 단계별 계획은 ROADMAP.md 참고.

현재는 프론트엔드(Vite + React + TypeScript)에 목업 데이터 기반 UI만 구현되어 있고, 백엔드/DB 연동은 아직 시작 전이다. 대시보드·학생·반·출결·성적·수강료·상담·AI 분석 페이지가 모두 목업 데이터로 구현되어 있다(구현 상세 계획은 ROADMAP.md 참고).

## 기술 스택

- **프론트엔드**: React 19 + TypeScript + Vite (React Compiler 활성화, Babel 플러그인으로 적용) + React Router + Tailwind CSS v4
- **차트/캘린더**: recharts, @fullcalendar/react, temporal-polyfill — 모두 `student-detail-page.tsx`(학생 상세의 성적 추이 차트·상담 일정 등)에서만 사용
- **백엔드**: Node.js + Express (예정, 아직 미구현)
- **데이터베이스**: PostgreSQL (예정, 아직 미구현)
- **배포**: 클라우드 배포 예정 — 프론트 Vercel, 백엔드/DB Railway 또는 Render

## 명령어

```bash
npm install       # 의존성 설치
npm run dev        # 개발 서버 실행 (Vite)
npm run build      # 타입 체크(tsc -b) 후 프로덕션 빌드
npm run lint        # ESLint 실행
npm run preview     # 빌드 결과 미리보기
```

## 아키텍처 참고사항

- `tsconfig.json`은 참조만 하며 실제 컴파일 설정은 `tsconfig.app.json`(앱 코드)과 `tsconfig.node.json`(Vite 설정 등 Node 환경 코드)로 분리되어 있다.
- Vite 설정(`vite.config.ts`)은 `@vitejs/plugin-react`와 함께 `@rolldown/plugin-babel`을 통해 React Compiler를 활성화한다 — 새 빌드 관련 플러그인을 추가할 때 이 조합을 유지해야 한다.
- ESLint는 flat config(`eslint.config.js`) 방식이며 `dist` 디렉터리를 전역 무시 처리한다.
- 라우팅은 `src/App.tsx`에서 `react-router-dom`의 `<Routes>`로 정의하며, 모든 페이지는 `src/components/layout.tsx`(사이드바 + `<Outlet>`) 아래에 중첩된다. 새 페이지 추가 시 `App.tsx`에 라우트를 등록하고 `src/components/sidebar.tsx`에 메뉴 항목을 추가한다. 현재 라우트: `/dashboard`, `/students`, `/students/:id`, `/classes`, `/attendance`, `/grades`, `/payments`, `/counseling`, `/ai-analysis` (`src/pages/*-page.tsx` 1:1 대응).
- 학생 상세 화면은 모달이 아니라 `students/:id` 별도 라우트(`student-detail-page.tsx`)로 구현한다 — 상담 등 민감 정보를 목록/다른 학생에게 노출하지 않기 위한 구조적 분리다.
- 데이터 계층은 현재 `src/mocks/*.ts`의 정적 배열(`MOCK_*`)뿐이며, 대응하는 타입은 `src/types/*.ts`에 1:1로 정의되어 있다(예: `mocks/students.ts` ↔ `types/student.ts`). 백엔드 연동 전까지 새 기능은 이 패턴(타입 정의 + mock 데이터)을 따른다.
- 공용 UI 컴포넌트는 `src/components/ui/`(button, card, table, input, badge)에 있으며, `variant`/`size` 등 옵션은 `Record<Variant, string>` 형태의 스타일 매핑 상수로 관리한다(`button.tsx` 참고). 새 UI 컴포넌트도 이 패턴을 따른다.
- 스타일은 Tailwind CSS v4를 `@theme` 방식(`src/index.css`)으로 커스터마이징한다. 색상은 `primary`(브랜드 인디고) + `gray` + 시맨틱 컬러(`success`/`warning`/`error`/`info`), 타이포그래피는 `display`~`caption` 텍스트 토큰(`text-*` 클래스)을 사용한다 — 임의의 색상/폰트 크기 값 대신 이 토큰을 우선 사용한다.

## 개발 규칙

전역 규칙(`~/.claude/CLAUDE.md`)에 명시된 네이밍 규칙(변수/함수는 camelCase, 컴포넌트/클래스는 PascalCase, 상수는 UPPER_SNAKE_CASE, 파일명은 kebab-case)과 코드 품질 원칙(any 사용 금지, DRY/YAGNI/SOLID)을 따른다.

## 알아둘 제약사항

- 실사용자는 비개발자(학원 강사)이므로 UI/기능은 최대한 단순하고 직관적으로 설계해야 한다.
