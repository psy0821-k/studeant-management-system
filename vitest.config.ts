import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 프론트엔드 컴포넌트 테스트 설정 (Vitest + React Testing Library)
// 백엔드(backend/vitest.config.ts)와 별개 설정: jsdom 환경 + RTL 셋업 파일 필요
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    // e2e(Playwright)와 backend(Vitest 별도 설정)는 이 설정에서 제외한다.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
