import { test, expect } from '@playwright/test'

test.describe('인증 가드', () => {
  test('로그인하지 않은 상태로 보호된 페이지 접근 시 로그인 페이지로 리다이렉트된다', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('반 관리 페이지도 로그인 없이는 접근할 수 없다', async ({ page }) => {
    await page.goto('/classes')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('잘못된 비밀번호로 로그인하면 에러 메시지를 보여준다', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('아이디').fill('admin')
    await page.getByPlaceholder('비밀번호').fill('wrong-password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()

    await expect(page.getByText(/아이디 또는 비밀번호가 올바르지 않습니다/)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('올바른 자격증명으로 로그인하면 대시보드로 이동한다', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('아이디').fill('admin')
    await page.getByPlaceholder('비밀번호').fill('test1234')
    await page.getByRole('button', { name: '로그인', exact: true }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
