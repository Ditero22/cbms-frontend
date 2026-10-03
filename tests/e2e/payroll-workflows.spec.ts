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

async function simulateKeyboardViewport(page: Page, height: number) {
  await page.evaluate((visibleHeight) => {
    const style = document.documentElement.style
    const bottom = Math.max(0, window.innerHeight - visibleHeight)
    style.setProperty('--cbms-visual-viewport-height', `${visibleHeight}px`)
    style.setProperty('--cbms-visual-viewport-top', '0px')
    style.setProperty('--cbms-visual-viewport-bottom', `${bottom}px`)
    style.setProperty('--cbms-visual-viewport-center', `${visibleHeight / 2}px`)
  }, height)
}

async function expectAboveKeyboard(locator: ReturnType<Page['locator']>, height: number) {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.y).toBeGreaterThanOrEqual(-1)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1)
}

test('payroll edits draft pay with multiple adjustments, then records payment and receipt across breakpoints', async ({
  page,
  request,
}, testInfo) => {
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
  await createDialog.getByRole('button', { name: 'Close dialog' }).click()
  await expect(createDialog).toBeHidden()
  await page.getByRole('button', { name: 'Create pay run', exact: true }).click()
  const reopenedCreateDialog = page.getByRole('dialog', { name: 'Create pay run' })
  await reopenedCreateDialog.getByLabel(/Period start/).fill('2026-09-01')
  await reopenedCreateDialog.getByRole('button', { name: 'Close dialog' }).click()
  const discardDialog = page.getByRole('alertdialog', { name: 'Discard changes?' })
  await expect(discardDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(discardDialog).toBeHidden()
  await expect(reopenedCreateDialog).toBeVisible()
  await reopenedCreateDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(discardDialog).toBeHidden()
  await expect(reopenedCreateDialog).toBeVisible()
  await reopenedCreateDialog.getByLabel(/Period end/).fill('2026-09-10')
  await page.mouse.click(2, 2)
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: 'Keep editing' }).click()
  await reopenedCreateDialog.getByRole('button', { name: 'Close dialog' }).click()
  await discardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(reopenedCreateDialog).toBeHidden()
  await page.getByRole('button', { name: 'Create pay run', exact: true }).click()
  const createPayRunDialog = page.getByRole('dialog', { name: 'Create pay run' })
  await createPayRunDialog.getByLabel(/Branch/).selectOption({ label: 'Acceptance branch' })
  await createPayRunDialog.getByLabel(/Period start/).fill('2026-09-01')
  await createPayRunDialog.getByLabel(/Period end/).fill('2026-09-15')
  const employeeSelect = createPayRunDialog.getByRole('combobox').nth(1)
  await expect(employeeSelect).toContainText(employeeName)
  await employeeSelect.selectOption({ label: `${employeeName} · PAY-${unique}` })
  await createPayRunDialog.getByLabel(/Periods \/ units/).fill('10')
  await createPayRunDialog.getByLabel(/Rate/).fill('100')
  await createPayRunDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createPayRunDialog.getByLabel('Adjustment 1 kind').selectOption('earning')
  await createPayRunDialog.getByLabel('Adjustment 1 type').selectOption('Bonus')
  await createPayRunDialog.getByLabel('Adjustment 1 amount (PHP)').fill('50')
  await createPayRunDialog.getByLabel('Adjustment 1 notes').fill('Performance bonus')
  await createPayRunDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createPayRunDialog.getByLabel('Adjustment 2 kind').selectOption('deduction')
  await createPayRunDialog.getByLabel('Adjustment 2 type').selectOption('Cash advance recovery')
  await createPayRunDialog.getByLabel('Adjustment 2 amount (PHP)').fill('25')
  await createPayRunDialog.getByRole('button', { name: 'Add adjustment' }).click()
  await createPayRunDialog.getByLabel('Adjustment 3 type').selectOption('Overtime')
  await createPayRunDialog.getByLabel('Adjustment 3 amount (PHP)').fill('20')
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
  await createPayRunDialog.getByRole('button', { name: 'Save draft pay run' }).click()
  await expect(createPayRunDialog.getByRole('button', { name: 'Save draft pay run' })).toBeEnabled()
  await expect(createPayRunDialog).toBeVisible()
  expect(createAttempts).toBe(1)

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/payroll',
  )
  await createPayRunDialog.getByRole('button', { name: 'Save draft pay run' }).click()
  const response = await createResponse
  expect(response.status()).toBe(201)
  const created = (await response.json()) as { id: string; reference: string }
  expect(created.id).toBe(firstCommitted?.id)
  expect(firstRequestKey).toMatch(/^[0-9a-f-]{36}$/i)
  expect(createAttempts).toBe(2)
  await page.unroute('**/api/v1/payroll')
  await expect(createPayRunDialog).toBeHidden()
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
  const keyboardHeight = 320
  const paymentDialogBody = paymentDialog.locator('.dialog-body')
  await simulateKeyboardViewport(page, keyboardHeight)
  await expect(paymentDialog).toHaveCSS('bottom', `${844 - keyboardHeight}px`)
  const paymentBodyMetrics = await paymentDialogBody.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(paymentBodyMetrics.scrollHeight).toBeGreaterThan(paymentBodyMetrics.clientHeight)
  const pageScrollBeforePaymentFields = await page.evaluate(() => window.scrollY)
  for (const field of [
    paymentDialog.getByLabel('Payment date'),
    paymentDialog.getByLabel('Reference number'),
    paymentDialog.getByLabel('Payment notes'),
  ]) {
    await field.focus()
    await field.scrollIntoViewIfNeeded()
    await expectAboveKeyboard(field, keyboardHeight)
    await expectAboveKeyboard(
      paymentDialog.getByRole('button', { name: 'Record payment' }),
      keyboardHeight,
    )
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforePaymentFields)
  await simulateKeyboardViewport(page, 844)
  await expect(paymentDialog).toHaveCSS('bottom', '0px')
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
  await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()

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

  await updatedDetail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Employee payroll', exact: true }).click()
  const employeeSearch = page.getByRole('searchbox', { name: 'Search employees' })
  await employeeSearch.fill(employeeName)
  const employeeCard = page.getByRole('button', {
    name: `View details for ${employeeName}`,
    exact: true,
  })
  await expect(employeeCard).toBeVisible()
  await expect(employeeCard).toContainText('Net pay')
  await expect(employeeCard).toContainText('₱1,055')
  await expect(employeeCard).toContainText('Deductions')
  await page.getByLabel('Filter payroll by branch').selectOption({ label: 'Acceptance branch' })
  await expect(employeeCard).toBeVisible()
  await page.getByLabel('Filter payroll by branch').selectOption('')
  await expect(employeeCard).toBeVisible()
  await page.getByLabel('Filter payroll by payment status').selectOption('Received')
  await expect(employeeCard).toBeVisible()
  await page.getByLabel('Filter payroll by payment status').selectOption('Paid')
  await expect(employeeCard).toHaveCount(0)
  await page.getByLabel('Filter payroll by payment status').selectOption('')
  await expect(employeeCard).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 844 })
  const filterSearch = page.getByRole('searchbox', { name: 'Search employees' })
  const branchFilter = page.getByLabel('Filter payroll by branch')
  const statusFilter = page.getByLabel('Filter payroll by payment status')
  const periodFrom = page.getByLabel('Period from')
  const periodThrough = page.getByLabel('Period through')
  const exportFilter = page.getByRole('button', { name: 'Export page', exact: true })
  await expect(page.locator('.payroll-ledger-table')).toHaveCSS('font-size', '12px')
  await expect(page.locator('.payroll-ledger-table th').first()).toHaveCSS('font-size', '11px')
  await expect(page.locator('.payroll-ledger-employee').first()).toHaveCSS('font-size', '12px')
  await expect(filterSearch).toHaveCSS('font-size', '13px')
  await expect(branchFilter).toHaveCSS('font-size', '12px')
  await expect(periodFrom).toHaveCSS('font-size', '12px')
  await expect(page.getByText('Sort by', { exact: true })).toHaveCount(0)
  await expect(page.locator('.payroll-ledger-sort-direction')).toHaveCount(0)
  const employeeHeader = page
    .getByRole('region', { name: 'Employee payroll table' })
    .getByRole('columnheader', { name: /Employee/ })
  await expect(employeeHeader).toHaveAttribute('aria-sort', 'ascending')
  await employeeHeader.getByRole('button').click()
  await expect(employeeHeader).toHaveAttribute('aria-sort', 'descending')
  const rowOne = await Promise.all(
    [filterSearch, branchFilter, statusFilter].map(async (locator) => {
      const bounds = await locator.boundingBox()
      expect(bounds).not.toBeNull()
      return bounds!.y + bounds!.height
    }),
  )
  expect(Math.max(...rowOne) - Math.min(...rowOne)).toBeLessThanOrEqual(2)
  const rowTwo = await Promise.all(
    [periodFrom, periodThrough, exportFilter].map(async (locator) => {
      const bounds = await locator.boundingBox()
      expect(bounds).not.toBeNull()
      return bounds!.y + bounds!.height
    }),
  )
  expect(Math.max(...rowTwo) - Math.min(...rowTwo)).toBeLessThanOrEqual(2)
  await expect
    .poll(() =>
      page
        .locator('.main-shell')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).marginLeft)),
    )
    .toBeGreaterThanOrEqual(257)
  const desktopLayout = await page.evaluate(() => ({
    sidebarRight: document.querySelector('.desktop-sidebar')?.getBoundingClientRect().right,
    mainLeft: document.querySelector('.main-shell')?.getBoundingClientRect().left,
  }))
  expect(desktopLayout.mainLeft).toBeGreaterThanOrEqual((desktopLayout.sidebarRight ?? 0) - 1)
  await page.screenshot({ path: testInfo.outputPath('payroll-filters-1440.png') })

  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(employeeSearch).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (width <= 1100) {
      await expect(employeeCard).toBeVisible()
      await expect(page.getByRole('region', { name: 'Employee payroll table' })).toBeHidden()
      if (width <= 620) {
        const searchFontSize = await employeeSearch.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        )
        expect(searchFontSize).toBeGreaterThanOrEqual(16)
        await expect(page.locator('.payroll-ledger-card-person strong')).toHaveCSS(
          'font-size',
          '14px',
        )
        await expect(page.locator('.payroll-ledger-card-details strong').first()).toHaveCSS(
          'font-size',
          '12px',
        )
      }
    } else {
      await expect(employeeCard).toBeHidden()
      await expect(
        page.getByRole('row', { name: `Open ${employeeName} payroll record`, exact: true }),
      ).toBeVisible()
    }
    const tapControls = [
      page.locator('.payroll-ledger-search'),
      page.getByLabel('Filter payroll by branch'),
      page.getByLabel('Filter payroll by payment status'),
      page.getByLabel('Period from'),
      page.getByLabel('Period through'),
      page.getByRole('button', { name: 'Export page', exact: true }),
      page.getByRole('button', { name: 'Clear filters', exact: true }),
    ]
    const minimumHeight = width <= 620 ? 48 : width <= 1100 ? 44 : 40
    for (const control of tapControls) {
      expect(Math.round((await control.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(
        minimumHeight,
      )
    }
    if (width === 390 || width === 768) {
      await page.screenshot({ path: testInfo.outputPath(`payroll-filters-${width}.png`) })
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const searchBounds = await employeeSearch.boundingBox()
  expect(searchBounds?.height).toBeGreaterThanOrEqual(44)
  await employeeCard.click()
  const employeeDetail = page.getByRole('dialog').filter({ hasText: employeeName })
  await expect(employeeDetail).toBeVisible()
  await employeeDetail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('row', { name: `Open ${employeeName} payroll record`, exact: true }).click()
  const desktopEmployeeDetail = page.getByRole('dialog').filter({ hasText: employeeName })
  await expect(desktopEmployeeDetail).toBeVisible()
  await desktopEmployeeDetail.getByRole('button', { name: 'Close dialog', exact: true }).click()
})
