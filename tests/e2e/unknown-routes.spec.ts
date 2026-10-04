import { expect, test } from '@playwright/test'

const password = process.env.CBMS_E2E_PASSWORD ?? ''

test('anonymous users are sent to sign-in when opening an unknown route', async ({ page }) => {
  await page.goto('/route-that-does-not-exist/nested')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Work email')).toBeVisible()
})

test('authenticated unknown routes show a helpful 404 and keep overview navigation available', async ({
  page,
}) => {
  expect(password.length, 'Use the disposable browser-test runner.').toBeGreaterThanOrEqual(12)

  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/route-that-does-not-exist/nested')

  await expect(page).toHaveURL(/\/route-that-does-not-exist\/nested$/)
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(
    page.getByText('We couldn’t find a CBMS page at this address.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Back to overview', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})
