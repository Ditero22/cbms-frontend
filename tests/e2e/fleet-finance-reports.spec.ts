import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { recordPaymentWithProof } from './helpers/payment-proof'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  customerId: string
  productId: string
}

async function login(page: Page, email = 'administrator@example.invalid') {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(process.env.CBMS_E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible()
  const dark = page.getByRole('button', { name: 'Switch to dark mode', exact: true })
  if (await dark.isVisible()) await dark.click()
  await expect(
    page.getByRole('button', { name: 'Switch to light mode', exact: true }),
  ).toBeVisible()
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`fleet and finance dashboard, reports, filters and CSV fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const response = await page.request.post(`${apiUrl}/orders`, {
      data: {
        customerId: fixtures.customerId,
        branchId: fixtures.branchId,
        items: [{ productId: fixtures.productId, quantity: 3 }],
      },
    })
    expect(response.status()).toBe(201)
    const order = (await response.json()) as { id: string; orderNumber: string }
    const payment = await recordPaymentWithProof(page.request, apiUrl, {
      orderId: order.id,
      amount: '10',
      method: 'GCash',
      externalReference: 'QA report receipt',
    })
    expect(payment.status()).toBe(201)
    await page.reload()
    const snapshot = page.getByRole('region', { name: 'Fleet and finance overview', exact: true })
    await expect(snapshot).toContainText('Outstanding customer balances')
    await expect(snapshot).toContainText('Fleet availability')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({ path: testInfo.outputPath(`operations-${width}.png`), fullPage: true })
    await page.goto('/reports')
    const report = page.getByLabel('Report', { exact: true })
    for (const value of [
      'fleet-status',
      'fleet-assignments',
      'fleet-maintenance',
      'driver-allowances',
      'customer-balances',
      'customer-payment-history',
    ]) {
      const ready = page.waitForResponse(
        (res) =>
          res.url().includes('/reports/data?') &&
          res.url().includes(`report=${value}`) &&
          res.request().method() === 'GET',
      )
      await report.selectOption(value)
      expect((await ready).status()).toBe(200)
      await expect(page.getByText('Generating report…', { exact: true })).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      if (['fleet-status', 'customer-balances'].includes(value))
        await expect(page.getByLabel('From', { exact: true })).toBeDisabled()
    }
    await report.selectOption('customer-balances')
    await page
      .getByRole('region', { name: 'Report options' })
      .getByLabel('Customers', { exact: true })
      .selectOption(fixtures.customerId)
    await page
      .getByRole('region', { name: 'Report options' })
      .getByLabel('Status', { exact: true })
      .selectOption('Partially Paid')
    const record =
      width <= 800
        ? page.locator('.report-record-card').filter({ hasText: order.orderNumber })
        : page.getByRole('row').filter({ hasText: order.orderNumber })
    await expect(record).toContainText('₱20.00')
    await expect(record).toContainText('Partially Paid')
    if (width <= 800) await expect(page.locator('.report-results-table')).toBeHidden()
    await page.screenshot({
      path: testInfo.outputPath(`balance-report-${width}.png`),
      fullPage: true,
    })
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download CSV', exact: true }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toContain('customer-balances')
    const destination = testInfo.outputPath('customer-balances.csv')
    await download.saveAs(destination)
    const csv = await readFile(destination, 'utf8')
    expect(csv).toContain(order.orderNumber)
    expect(csv).toContain('20.00')
    expect(csv).toContain('Partially Paid')
  })
}

test('report errors can retry and dashboard respects the viewer’s actual read grants', async ({
  page,
}) => {
  await login(page)
  let fail = true
  await page.route('**/reports/data?**', (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Reporting temporarily unavailable.' } }),
        })
      : route.continue(),
  )
  await page.goto('/reports')
  await expect(page.getByText('Could not generate this report.', { exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('Could not generate this report.', { exact: true })).toHaveCount(0)
  await page.unrouteAll({ behavior: 'wait' })
  await page.request.post(`${apiUrl}/auth/logout`)
  await login(page, 'viewer@example.invalid')
  const snapshot = page.getByRole('region', { name: 'Fleet and finance overview', exact: true })
  await expect(snapshot).toContainText('Outstanding customer balances')
  await expect(snapshot.getByText('Fleet availability', { exact: true })).toHaveCount(0)
  await expect(snapshot.getByText('Maintenance this month', { exact: true })).toHaveCount(0)
  await expect(snapshot.getByText('Allowances awaiting release', { exact: true })).toHaveCount(0)
  const denied = await page.request.get(
    `${apiUrl}/reports/data?report=driver-allowances&dateFrom=2026-01-01&dateTo=2026-12-31`,
  )
  expect(denied.status()).toBe(403)
})
