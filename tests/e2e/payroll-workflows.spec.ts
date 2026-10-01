import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'
import { paymentProof } from './helpers/payment-proof'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const password = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as { branchId: string }
const unique = crypto.randomUUID().slice(0, 8)
const employeeName = `Payroll acceptance ${unique}`

async function api<T>(request: APIRequestContext, path: string, method = 'GET', data?: unknown) {
  const response = await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  return (response.status() === 204 ? undefined : await response.json()) as T
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('payroll edits draft pay with multiple adjustments, then records payment and receipt across breakpoints', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  expect(password.length).toBeGreaterThanOrEqual(12)
  await api(request, '/auth/login', 'POST', {
    email: 'administrator@example.invalid',
    password,
  })
  await api(request, '/employees', 'POST', {
    name: employeeName,
    employeeNumber: `PAY-${unique}`,
    position: 'Payroll acceptance worker',
    branchId: fixtures.branchId,
  })
  await api(request, '/auth/logout', 'POST')

  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.goto('/payroll')
  await expect(page.getByRole('heading', { name: 'Payroll', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create pay run', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: 'Create pay run' })
  await expect(createDialog).toBeVisible()
  await expect(createDialog).toHaveCSS('max-height', /.+/)
  await createDialog.getByLabel(/Branch/).selectOption({ label: 'Acceptance branch' })
  await createDialog.getByLabel(/Period start/).fill('2026-09-01')
  await createDialog.getByLabel(/Period end/).fill('2026-09-15')
  const employeeSelect = createDialog.getByRole('combobox').nth(1)
  await expect(employeeSelect).toContainText(employeeName)
  await employeeSelect.selectOption({ label: `${employeeName} · PAY-${unique}` })
  await createDialog.getByLabel(/Periods \/ units/).fill('10')
  await createDialog.getByLabel(/Rate/).fill('100')
  await createDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createDialog.getByLabel('Adjustment 1 kind').selectOption('earning')
  await createDialog.getByLabel('Adjustment 1 type').selectOption('Bonus')
  await createDialog.getByLabel('Adjustment 1 amount (PHP)').fill('50')
  await createDialog.getByLabel('Adjustment 1 notes').fill('Performance bonus')
  await createDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createDialog.getByLabel('Adjustment 2 kind').selectOption('deduction')
  await createDialog.getByLabel('Adjustment 2 type').selectOption('Cash advance recovery')
  await createDialog.getByLabel('Adjustment 2 amount (PHP)').fill('25')
  await createDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createDialog.getByLabel('Adjustment 3 type').selectOption('Overtime')
  await createDialog.getByLabel('Adjustment 3 amount (PHP)').fill('20')
  let createAttempts = 0
  let firstCommitted: { id: string; reference: string } | undefined
  let firstRequestKey = ''
  await page.route('**/api/v1/payroll', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    createAttempts += 1
    const requestBody = route.request().postDataJSON() as { requestKey?: string }
    if (createAttempts === 1) {
      firstRequestKey = requestBody.requestKey ?? ''
      const committedResponse = await route.fetch()
      expect(committedResponse.status()).toBe(201)
      firstCommitted = (await committedResponse.json()) as { id: string; reference: string }
      await route.abort('failed')
      return
    }
    expect(requestBody.requestKey).toBe(firstRequestKey)
    await route.fulfill({ response: await route.fetch() })
  })
  await createDialog.getByRole('button', { name: 'Save draft pay run' }).click()
  await expect(createDialog.getByRole('button', { name: 'Save draft pay run' })).toBeEnabled()
  await expect(createDialog).toBeVisible()
  expect(createAttempts).toBe(1)

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/payroll',
  )
  await createDialog.getByRole('button', { name: 'Save draft pay run' }).click()
  const response = await createResponse
  expect(response.status()).toBe(201)
  const created = (await response.json()) as { id: string; reference: string }
  expect(created.id).toBe(firstCommitted?.id)
  expect(firstRequestKey).toMatch(/^[0-9a-f-]{36}$/i)
  expect(createAttempts).toBe(2)
  await page.unroute('**/api/v1/payroll')
  await expect(createDialog).toBeHidden()
  await page.getByLabel('Search Payroll', { exact: true }).fill(created.reference)
  await tableRecordControl(page, created.reference).click()

  const detailDialog = page.getByRole('dialog').filter({ hasText: created.reference })
  await expect(detailDialog.getByText('₱1,045.00')).toBeVisible()
  await detailDialog.getByRole('button', { name: 'Edit draft' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit draft pay run' })
  await expect(editDialog).toBeVisible()
  await expect(editDialog.getByLabel('Adjustment 1 notes')).toHaveValue('Performance bonus')
  await editDialog.getByLabel('Adjustment 3 amount (PHP)').fill('30')
  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/v1/payroll/${created.id}`,
  )
  await editDialog.getByRole('button', { name: 'Save draft changes' }).click()
  expect((await updateResponse).status()).toBe(200)
  await expect(editDialog).toBeHidden()
  await tableRecordControl(page, created.reference).click()
  const updatedDetail = page.getByRole('dialog').filter({ hasText: created.reference })
  await expect(updatedDetail.getByText('₱1,055.00')).toBeVisible()
  await updatedDetail.getByRole('button', { name: 'Process pay run' }).click()
  await page
    .getByRole('dialog', { name: 'Process and lock this pay run?' })
    .getByRole('button', { name: 'Process pay run' })
    .click()
  await expect(updatedDetail.locator('.payroll-run-summary .inline-status')).toHaveText('Processed')
  await expect(updatedDetail.getByRole('button', { name: 'Edit draft' })).toHaveCount(0)
  await updatedDetail.getByRole('button', { name: 'Record payment' }).click()
  const paymentDialog = page.getByRole('dialog', { name: 'Record payroll payment' })
  await paymentDialog.getByLabel(/^Receipt \/ payment proof/).setInputFiles(paymentProof)
  await expect(
    paymentDialog.getByRole('img', { name: `Selected payment proof: ${paymentProof.name}` }),
  ).toBeVisible()
  await paymentDialog.getByRole('button', { name: 'Record payment' }).click()
  await expect(paymentDialog).toBeHidden()
  await updatedDetail.getByRole('button', { name: 'Confirm receipt' }).click()
  const receiptDialog = page.getByRole('dialog', { name: 'Confirm employee receipt' })
  await receiptDialog
    .getByLabel(/Employee acknowledgement/)
    .fill('Worker confirmed receiving payroll in person.')
  await receiptDialog.getByRole('button', { name: 'Confirm receipt' }).click()
  await expect(receiptDialog).toBeHidden()
  await expect(updatedDetail.locator('.payroll-detail-card .inline-status')).toHaveText('Received')
  await updatedDetail
    .getByRole('button', { name: `Preview ${paymentProof.name}`, exact: true })
    .click()
  const preview = page.getByRole('dialog', { name: 'Payment proof', exact: true })
  await expect(
    preview.getByRole('img', { name: `Payment proof: ${paymentProof.name}` }),
  ).toBeVisible()
  await preview.getByRole('button', { name: 'Close', exact: true }).click()

  for (const width of [1440, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(updatedDetail).toBeVisible()
    await updatedDetail.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      )
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    const bounds = await updatedDetail.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(-1)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
  }
})
