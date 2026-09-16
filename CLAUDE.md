# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

학원 강사(약 40명 학생 담당)를 위한 학생 관리 웹 애플리케이션. 학원은 기존에 엑셀로 학생 정보를 관리하고 있어, 이 시스템은 엑셀 워크플로우를 대체하지 않고 병행하면서 성적 분석·숙제 관리 등을 보완하는 것을 목표로 한다. 자세한 배경과 기능 목록은 README.md 참고.

현재 프론트엔드(Vite + React + TypeScript)만 스캐폴딩되어 있고, 백엔드/DB/기능 구현은 아직 시작 전 기획 단계다.

## 기술 스택

- **프론트엔드**: React 19 + TypeScript + Vite (React Compiler 활성화, Babel 플러그인으로 적용)
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

## 개발 규칙

전역 규칙(`~/.claude/CLAUDE.md`)에 명시된 네이밍 규칙(변수/함수는 camelCase, 컴포넌트/클래스는 PascalCase, 상수는 UPPER_SNAKE_CASE, 파일명은 kebab-case)과 코드 품질 원칙(any 사용 금지, DRY/YAGNI/SOLID)을 따른다.

## 알아둘 제약사항

- 실사용자는 비개발자(학원 강사)이므로 UI/기능은 최대한 단순하고 직관적으로 설계해야 한다.
- 학원이 엑셀로 데이터를 관리하므로, 학생/성적 데이터의 엑셀 가져오기·내보내기는 부가기능이 아니라 핵심 요구사항으로 취급한다.
