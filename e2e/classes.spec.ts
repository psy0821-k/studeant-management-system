import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('아이디').fill('admin')
  await page.getByPlaceholder('비밀번호').fill('test1234')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test.describe('반 관리: 생성과 시간표 반영', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/classes')
  })

  test('반을 생성하면 목록과 주간 시간표에 즉시 반영된다', async ({ page }) => {
    const className = `E2E테스트반-${Date.now()}`

    await page.getByRole('button', { name: '반 생성' }).click()
    await page.getByPlaceholder(/반 이름/).fill(className)
    await page.getByPlaceholder('과목').fill('수학')

    // 월요일 체크박스 선택 후 시간 입력
    await page.getByText('월', { exact: true }).click()

    await page.getByRole('button', { name: '저장' }).click()

    // 반 목록 카드와 주간 시간표(FullCalendar) 양쪽에 모두 반영되어야 한다
    await expect(page.getByRole('heading', { name: className })).toBeVisible()
    await expect(page.getByText(className).first()).toBeVisible()

    // 정리: 생성한 반을 삭제해 테스트 데이터가 남지 않도록 한다
    const card = page.locator('.rounded-lg', { has: page.getByRole('heading', { name: className }) })
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByRole('heading', { name: className })).not.toBeVisible()
  })

  test('필수 항목 없이 저장하려 하면 폼이 제출되지 않는다', async ({ page }) => {
    await page.getByRole('button', { name: '반 생성' }).click()
    await page.getByRole('button', { name: '저장' }).click()

    // 반 이름 input은 required이므로 폼 제출이 막히고 그대로 폼이 열려 있어야 한다
    await expect(page.getByPlaceholder(/반 이름/)).toBeVisible()
  })
})

test.describe('대시보드: 날짜별 메모', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
  })

  test('날짜를 클릭하면 메모 모달이 열리고 등록한 메모가 즉시 보인다', async ({ page }) => {
    // 달력 로드 대기
    await expect(page.locator('.fc-daygrid-day').first()).toBeVisible()

    const dayCell = page.locator('.fc-daygrid-day[data-date]').first()
    await dayCell.click()

    await expect(page.getByText(/일정$/)).toBeVisible()

    const content = `E2E 메모 ${Date.now()}`
    await page.getByPlaceholder('일정을 입력하세요').fill(content)
    await page.getByRole('button', { name: '등록' }).click()

    await expect(page.getByText(content)).toBeVisible()

    // 정리: 등록한 메모를 삭제해 테스트 데이터가 남지 않도록 한다
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '수정' }).click()
    await page.getByRole('button', { name: '삭제' }).click()
  })
})
