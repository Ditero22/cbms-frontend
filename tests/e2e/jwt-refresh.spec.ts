import { expect, test } from '@playwright/test'

test.skip(process.env.AUTH_MODE !== 'jwt', 'Run this acceptance suite explicitly in JWT mode.')

test('refreshes a missing short-lived access cookie on reload and revokes logout', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(process.env.CBMS_E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === 'cbms_access')?.httpOnly).toBe(true)
  expect(cookies.find((cookie) => cookie.name === 'cbms_session')?.httpOnly).toBe(true)
  await context.clearCookies({ name: 'cbms_access' })
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'cbms_access'))
    .toBe(true)
  const base = process.env.CBMS_E2E_API_URL!
  const response = await context.request.post(`${base}/auth/logout`, {
    headers: { Origin: process.env.CBMS_E2E_BASE_URL! },
  })
  expect(response.status()).toBe(204)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
})
