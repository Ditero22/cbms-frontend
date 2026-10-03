import { readFile } from 'node:fs/promises'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const temporaryPassword = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
  legacyAllowanceReleasedId: string
}
type Expense = {
  id: string
  description: string
  category: string
  branchId: string
  amount: string
  status: 'Pending' | 'Approved' | 'Rejected'
  submittedBy: string
  submittedByName: string
}
type ExpenseDetail = {
  expense: Expense
  review: null | {
    decision: string
    note: string | null
    reviewerId: string
    reviewerName: string
    reviewedAt: string
  }
  source: null | {
    entityType: 'vehicle-maintenance' | 'driver-allowance'
    id: string
    reference: string
    status: string
  }
  history: { action: string }[]
}
type ExpenseList = {
  data: { id: string; Expense: string; Amount: string; branchId?: string }[]
  total: number
}
const proof = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8n8AAAAASUVORK5CYII=',
  'base64',
)

test.beforeAll(() => {
  for (const key of ['branchId', 'otherBranchId'] as const) {
    expect(fixtures[key], `Disposable browser fixture ${key} is required.`).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,
    )
  }
  expect(temporaryPassword.length, 'Use the isolated browser-test runner.').toBeGreaterThanOrEqual(
    12,
  )
})

async function api<T>(
  request: APIRequestContext,
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  if (response.status() === 204) return undefined as T
  return response.json() as Promise<T>
}
async function login(page: Page, email = 'administrator@example.invalid') {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(temporaryPassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible()
  const dark = page.getByRole('button', { name: 'Switch to dark mode', exact: true })
  if (await dark.isVisible()) await dark.click()
  await expect(
    page.getByRole('button', { name: 'Switch to light mode', exact: true }),
  ).toBeVisible()
}
async function prepareExpense(
  page: Page,
  description = `Expense fixture ${crypto.randomUUID().slice(0, 8)}`,
  amount = '1234.56',
  branchId = fixtures.branchId,
) {
  const created = await api<{ id: string }>(page.request, '/expenses', 'POST', {
    description,
    category: 'Supplies',
    amount,
    branchId,
  })
  return (await api<ExpenseDetail>(page.request, `/expenses/${created.id}`)).expense
}
async function openExpense(page: Page, expense: Expense) {
  await page.goto('/expenses')
  await page.getByLabel('Search Expenses', { exact: true }).fill(expense.description)
  await tableRecordControl(page, expense.description).click()
  const detail = page.getByRole('dialog', { name: expense.description, exact: true })
  await expect(detail.getByText('Submitted by', { exact: true })).toBeVisible()
  return detail
}
async function bounds(page: Page, dialog: Locator) {
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const box = await dialog.boundingBox(),
    viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
}
async function fillCategory(form: Locator, value = 'Supplies') {
  await form.getByLabel('Category', { exact: true }).fill(value)
}
async function newExpense(page: Page, description: string, amount: string) {
  await page.getByRole('button', { name: 'New expense', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(form.getByLabel('Branch', { exact: true })).toBeEnabled()
  await form.getByLabel('Description', { exact: true }).fill(description)
  await fillCategory(form)
  await form.getByLabel('Amount', { exact: true }).fill(amount)
  await form.getByLabel('Branch', { exact: true }).selectOption(fixtures.branchId)
  const response = page.waitForResponse(
    (res) => res.url() === `${apiUrl}/expenses` && res.request().method() === 'POST',
  )
  await form.getByRole('button', { name: 'Save expense', exact: true }).click()
  const saved = await response
  expect(saved.status()).toBe(201)
  const created = (await saved.json()) as { id: string }
  await expect(form).toBeHidden()
  return (await api<ExpenseDetail>(page.request, `/expenses/${created.id}`)).expense
}
async function openReview(page: Page, detail: Locator, decision: 'Approved' | 'Rejected') {
  const approve = decision === 'Approved'
  await detail
    .getByRole('button', { name: approve ? 'Approve expense' : 'Reject expense', exact: true })
    .click()
  return page.getByRole('dialog', {
    name: approve ? 'Approve expense?' : 'Reject expense?',
    exact: true,
  })
}
async function confirmReview(
  page: Page,
  form: Locator,
  id: string,
  decision: 'Approved' | 'Rejected',
) {
  const response = page.waitForResponse(
    (res) => res.url() === `${apiUrl}/expenses/${id}/review` && res.request().method() === 'PATCH',
  )
  await form
    .getByRole('button', {
      name: decision === 'Approved' ? 'Confirm approval' : 'Confirm rejection',
      exact: true,
    })
    .click()
  return response
}
async function createAccount(page: Page, label: string, permissions: string[]) {
  const suffix = crypto.randomUUID().slice(0, 8),
    email = `expense-${label}-${suffix}@example.invalid`
  const role = await api<{ id: string }>(page.request, '/roles', 'POST', {
    name: `Expense ${label} ${suffix}`,
    permissions,
  })
  const user = await api<{ id: string }>(page.request, '/users', 'POST', {
    name: `Expense ${label} ${suffix}`,
    email,
    password: temporaryPassword,
    roleId: role.id,
    branchId: fixtures.branchId,
    isCrossBranch: false,
  })
  return { id: user.id, email }
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`expense list, create, detail and review forms fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const expense = await prepareExpense(page)
    await page.goto('/expenses')
    await page.getByLabel('Search Expenses', { exact: true }).fill(expense.description)
    const create = page.getByRole('button', { name: 'New expense', exact: true })
    await expect(create).toHaveCount(1)
    const row = tableRecordControl(page, expense.description)
    await expect(row).toBeVisible()
    if (width <= 800) {
      await expect(page.getByRole('table', { name: 'Expenses records', exact: true })).toBeHidden()
      await expect(row).toContainText('₱1,234.56')
      await expect(row).toContainText('Pending')
      await expect(row).toContainText('Acceptance branch')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({
      path: testInfo.outputPath(`expenses-list-${width}.png`),
      fullPage: true,
    })
    await create.click()
    let form = page.getByRole('dialog', { name: 'New expense', exact: true })
    await expect(form.getByLabel('Branch', { exact: true })).toBeEnabled()
    await expect(form.getByLabel('Description', { exact: true })).toBeFocused()
    await expect(form.getByLabel('Amount', { exact: true })).toHaveAttribute('step', '0.01')
    await expect(form.getByLabel('Category', { exact: true })).toHaveAttribute('list', /.+/)
    await form.getByLabel('Amount', { exact: true }).fill('0.001')
    expect(
      await form
        .getByLabel('Amount', { exact: true })
        .evaluate((element) => (element as HTMLInputElement).validity.stepMismatch),
    ).toBe(true)
    await bounds(page, form)
    await page.screenshot({ path: testInfo.outputPath(`expense-create-${width}.png`) })
    await page.keyboard.press('Escape')
    const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await expect(discard).toBeVisible()
    await expect(discard.getByRole('button', { name: 'Keep editing' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(discard).toBeHidden()
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(form).toBeHidden()
    await expect(create).toBeFocused()
    const detail = await openExpense(page, expense)
    await bounds(page, detail)
    await expect(detail.getByText('₱1,234.56', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`expense-detail-${width}.png`) })
    form = await openReview(page, detail, 'Approved')
    await expect(form.getByLabel('Review note', { exact: true })).toBeVisible()
    await bounds(page, form)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    form = await openReview(page, detail, 'Rejected')
    await expect(form.getByLabel('Rejection reason', { exact: true })).toHaveAttribute(
      'required',
      '',
    )
    await bounds(page, form)
    await page.screenshot({ path: testInfo.outputPath(`expense-review-${width}.png`) })
  })
}

for (const width of [390, 1280]) {
  test(`manual expenses preserve exact cents, review notes and actors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await prepareExpense(page, `Category suggestion ${crypto.randomUUID().slice(0, 8)}`, '0.01')
    await page.goto('/expenses')
    const suffix = crypto.randomUUID().slice(0, 8)
    const approved = await newExpense(page, `Approved office supplies ${suffix}`, '0.30')
    expect(approved).toMatchObject({
      amount: '0.30',
      status: 'Pending',
      branchId: fixtures.branchId,
      submittedByName: 'Acceptance administrator',
    })
    let detail = await openExpense(page, approved)
    let form = await openReview(page, detail, 'Approved')
    await form.getByLabel('Review note', { exact: true }).fill('Receipt and exact amount verified')
    expect((await confirmReview(page, form, approved.id, 'Approved')).status()).toBe(200)
    await expect(form).toBeHidden()
    detail = page.getByRole('dialog', { name: approved.description, exact: true })
    await expect(detail.locator('.status-badge')).toHaveText('Approved')
    await expect(
      detail.getByText('Receipt and exact amount verified', { exact: true }),
    ).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Reject expense', exact: true })).toHaveCount(0)
    const reviewed = await api<ExpenseDetail>(page.request, `/expenses/${approved.id}`)
    expect(reviewed.review).toMatchObject({
      decision: 'Approved',
      note: 'Receipt and exact amount verified',
      reviewerId: approved.submittedBy,
      reviewerName: 'Acceptance administrator',
    })
    expect(reviewed.review?.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(
      (
        await page.request.patch(`${apiUrl}/expenses/${approved.id}/review`, {
          data: { decision: 'Rejected', note: 'Attempt to reverse approval' },
        })
      ).status(),
    ).toBe(409)
    await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
    const rejected = await newExpense(page, `Rejected duplicate expense ${suffix}`, '10.01')
    detail = await openExpense(page, rejected)
    form = await openReview(page, detail, 'Rejected')
    await expect(form.getByLabel('Rejection reason', { exact: true })).toHaveAttribute(
      'required',
      '',
    )
    expect(
      (
        await page.request.patch(`${apiUrl}/expenses/${rejected.id}/review`, {
          data: { decision: 'Rejected' },
        })
      ).status(),
    ).toBe(400)
    await form
      .getByLabel('Rejection reason', { exact: true })
      .fill('Duplicate receipt was already reimbursed')
    expect((await confirmReview(page, form, rejected.id, 'Rejected')).status()).toBe(200)
    await expect(form).toBeHidden()
    detail = page.getByRole('dialog', { name: rejected.description, exact: true })
    await expect(detail.locator('.status-badge')).toHaveText('Rejected')
    const final = await api<ExpenseDetail>(page.request, `/expenses/${rejected.id}`)
    expect(final.expense.amount).toBe('10.01')
    expect(final.review).toMatchObject({
      decision: 'Rejected',
      note: 'Duplicate receipt was already reimbursed',
      reviewerId: rejected.submittedBy,
      reviewerName: 'Acceptance administrator',
    })
    expect(
      (
        await page.request.patch(`${apiUrl}/expenses/${rejected.id}/review`, {
          data: { decision: 'Approved' },
        })
      ).status(),
    ).toBe(409)
    await expect(detail.getByRole('button', { name: 'Approve expense', exact: true })).toHaveCount(
      0,
    )
  })
}

test('concurrent rendered reviews commit one decision and retain the losing draft', async ({
  page,
}) => {
  await login(page)
  const expense = await prepareExpense(page)
  const peer = await page.context().newPage()
  try {
    const primaryDetail = await openExpense(page, expense)
    const peerDetail = await openExpense(peer, expense)
    const approve = await openReview(page, primaryDetail, 'Approved')
    const reject = await openReview(peer, peerDetail, 'Rejected')
    await approve.getByLabel('Review note', { exact: true }).fill('Approval from first reviewer')
    await reject
      .getByLabel('Rejection reason', { exact: true })
      .fill('Rejection from second reviewer')
    const [approvalResponse, rejectionResponse] = await Promise.all([
      confirmReview(page, approve, expense.id, 'Approved'),
      confirmReview(peer, reject, expense.id, 'Rejected'),
    ])
    expect([approvalResponse.status(), rejectionResponse.status()].sort()).toEqual([200, 409])
    const lost = approvalResponse.status() === 409 ? approve : reject
    await expect(lost.getByRole('alert')).toContainText(/pending|reviewed/i)
    await expect(
      lost.getByLabel(approvalResponse.status() === 409 ? 'Review note' : 'Rejection reason', {
        exact: true,
      }),
    ).toHaveValue(
      approvalResponse.status() === 409
        ? 'Approval from first reviewer'
        : 'Rejection from second reviewer',
    )
    const final = await api<ExpenseDetail>(page.request, `/expenses/${expense.id}`)
    expect(final.expense.status).toBe(approvalResponse.status() === 200 ? 'Approved' : 'Rejected')
    expect(final.review?.note).toBe(
      approvalResponse.status() === 200
        ? 'Approval from first reviewer'
        : 'Rejection from second reviewer',
    )
    expect(
      final.history.filter((entry) => /^expense (approved|rejected)$/.test(entry.action)),
    ).toHaveLength(1)
    await expect(
      lost.getByRole('button', {
        name: approvalResponse.status() === 409 ? 'Confirm approval' : 'Confirm rejection',
        exact: true,
      }),
    ).toBeDisabled()
    await lost.getByRole('button', { name: 'Discard draft and view latest', exact: true }).click()
    const losingPage = approvalResponse.status() === 409 ? page : peer
    const latest = losingPage.getByRole('dialog', { name: expense.description, exact: true })
    await expect(latest.locator('.status-badge')).toHaveText(final.expense.status)
    await expect(latest.getByText(final.review!.note!, { exact: true })).toBeVisible()
  } finally {
    await peer.close()
  }
})

test('expense readers and branch reviewers receive only authorized records and actions', async ({
  page,
}) => {
  await login(page)
  const own = await prepareExpense(page)
  const other = await prepareExpense(
    page,
    `Other branch expense ${crypto.randomUUID().slice(0, 8)}`,
    '5.25',
    fixtures.otherBranchId,
  )
  const reader = await createAccount(page, 'reader', ['expenses.read'])
  const reviewer = await createAccount(page, 'reviewer', [
    'expenses.read',
    'expenses.create',
    'expenses.approve',
  ])
  await api(page.request, '/auth/logout', 'POST')
  await login(page, reader.email)
  let detail = await openExpense(page, own)
  await expect(page.getByRole('button', { name: 'New expense', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Approve expense', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Reject expense', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('heading', { name: 'Record history', exact: true })).toHaveCount(0)
  expect(
    (
      await page.request.post(`${apiUrl}/expenses`, {
        data: {
          description: 'Forbidden financial entry',
          category: 'Supplies',
          amount: '1.00',
          branchId: fixtures.branchId,
        },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await page.request.patch(`${apiUrl}/expenses/${own.id}/review`, {
        data: { decision: 'Approved' },
      })
    ).status(),
  ).toBe(403)
  expect((await page.request.get(`${apiUrl}/expenses/${other.id}`)).status()).toBe(404)
  expect(
    (
      await api<ExpenseList>(
        page.request,
        `/expenses?search=${encodeURIComponent(other.description)}`,
      )
    ).total,
  ).toBe(0)
  await api(page.request, '/auth/logout', 'POST')
  await login(page, reviewer.email)
  await page.goto('/expenses')
  await page.getByRole('button', { name: 'New expense', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(create.getByLabel('Branch', { exact: true })).toHaveValue(fixtures.branchId)
  await expect(
    create
      .getByLabel('Branch', { exact: true })
      .getByRole('option', { name: 'Acceptance other branch', exact: true }),
  ).toHaveCount(0)
  await create.getByRole('button', { name: 'Cancel', exact: true }).click()
  const defaulted = await api<{ id: string }>(page.request, '/expenses', 'POST', {
    description: `Default branch expense ${crypto.randomUUID().slice(0, 8)}`,
    category: 'Supplies',
    amount: '0.10',
  })
  expect(
    (await api<ExpenseDetail>(page.request, `/expenses/${defaulted.id}`)).expense.branchId,
  ).toBe(fixtures.branchId)
  expect(
    (
      await page.request.post(`${apiUrl}/expenses`, {
        data: {
          description: 'Wrong branch submission',
          category: 'Supplies',
          amount: '1.00',
          branchId: fixtures.otherBranchId,
        },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await page.request.patch(`${apiUrl}/expenses/${other.id}/review`, {
        data: { decision: 'Approved' },
      })
    ).status(),
  ).toBe(404)
  detail = await openExpense(page, own)
  const review = await openReview(page, detail, 'Approved')
  await review.getByLabel('Review note', { exact: true }).fill('Branch reviewer approval')
  expect((await confirmReview(page, review, own.id, 'Approved')).status()).toBe(200)
  const final = await api<ExpenseDetail>(page.request, `/expenses/${own.id}`)
  expect(final.review?.reviewerId).toBe(reviewer.id)
})

async function uploadSourceProof(page: Page, entityType: string, entityId: string, name: string) {
  const response = await page.request.post(
    `${apiUrl}/attachments?entityType=${entityType}&entityId=${entityId}`,
    {
      data: proof,
      headers: { 'content-type': 'image/png', 'x-file-name': encodeURIComponent(name) },
    },
  )
  expect(response.status()).toBe(201)
  return (await response.json()) as { id: string }
}
async function prepareSources(page: Page) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const vehicle = await api<{ id: string }>(page.request, '/vehicles', 'POST', {
    branchId: fixtures.branchId,
    name: `Expense truck ${suffix}`,
    plateNumber: `EXP-${suffix}`,
    vehicleType: 'Truck',
  })
  const maintenance = await api<{ id: string }>(
    page.request,
    `/vehicles/${vehicle.id}/maintenance`,
    'POST',
    {
      branchId: fixtures.branchId,
      maintenanceType: 'Repair',
      description: `Brake repair ${suffix}`,
      laborCost: '0.10',
      partsCost: '0.20',
      otherCost: '0.05',
    },
  )
  await api(page.request, `/vehicle-maintenance/${maintenance.id}/start`, 'POST', {})
  await api(page.request, `/vehicle-maintenance/${maintenance.id}/complete`, 'POST', {})
  const maintenanceRecord = await api<{ maintenance: { expenseId: string } }>(
    page.request,
    `/vehicle-maintenance/${maintenance.id}`,
  )
  const maintenanceExpense = await api<ExpenseDetail>(
    page.request,
    `/expenses/${maintenanceRecord.maintenance.expenseId}`,
  )
  const maintenanceProof = await uploadSourceProof(
    page,
    'vehicle-maintenance',
    maintenance.id,
    'repair-receipt.png',
  )
  const allowance = { id: fixtures.legacyAllowanceReleasedId }
  const allowanceRecord = await api<{ allowance: { expenseId: string } }>(
    page.request,
    `/driver-allowances/${allowance.id}`,
  )
  const allowanceExpense = await api<ExpenseDetail>(
    page.request,
    `/expenses/${allowanceRecord.allowance.expenseId}`,
  )
  const allowanceProof = await uploadSourceProof(
    page,
    'driver-allowance',
    allowance.id,
    'allowance-receipt.png',
  )
  return [
    {
      detail: maintenanceExpense,
      parentId: maintenance.id,
      proofId: maintenanceProof.id,
      fileName: 'repair-receipt.png',
      entityType: 'vehicle-maintenance',
    },
    {
      detail: allowanceExpense,
      parentId: allowance.id,
      proofId: allowanceProof.id,
      fileName: 'allowance-receipt.png',
      entityType: 'driver-allowance',
    },
  ]
}

test('linked expense proofs retain real parent permissions and readonly receipt controls', async ({
  page,
}) => {
  await login(page)
  const sources = await prepareSources(page)
  expect(sources[0].detail.expense).toMatchObject({ amount: '0.35', status: 'Pending' })
  expect(sources[1].detail.expense).toMatchObject({ amount: '0.10', status: 'Approved' })
  expect(sources[1].detail.review?.reviewerName).toBe('Acceptance administrator')
  const financialReader = await createAccount(page, 'financial-reader', ['expenses.read'])
  const sourceReader = await createAccount(page, 'source-reader', [
    'expenses.read',
    'vehicles.maintenance',
    'driver-allowances.read',
  ])
  await api(page.request, '/auth/logout', 'POST')
  await login(page, financialReader.email)
  for (const source of sources) {
    const restricted = await api<ExpenseDetail>(
      page.request,
      `/expenses/${source.detail.expense.id}`,
    )
    expect(restricted.source).toBeNull()
    const detail = await openExpense(page, source.detail.expense)
    await expect(detail.getByRole('heading', { name: 'Expense source', exact: true })).toHaveCount(
      0,
    )
    await expect(
      detail.getByRole('heading', { name: 'Proof & attachments', exact: true }),
    ).toHaveCount(0)
    expect(
      (await page.request.get(`${apiUrl}/attachments/${source.proofId}/content`)).status(),
    ).toBe(403)
    await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
  await api(page.request, '/auth/logout', 'POST')
  await login(page, sourceReader.email)
  for (const source of sources) {
    const authorized = await api<ExpenseDetail>(
      page.request,
      `/expenses/${source.detail.expense.id}`,
    )
    expect(authorized.source).toMatchObject({ entityType: source.entityType, id: source.parentId })
    const detail = await openExpense(page, source.detail.expense)
    await expect(detail.getByRole('heading', { name: 'Expense source', exact: true })).toBeVisible()
    await expect(detail.getByText(source.fileName, { exact: true })).toBeVisible()
    await expect(detail.getByLabel('Attach proof', { exact: true })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Approve expense', exact: true })).toHaveCount(
      0,
    )
    const downloading = page.waitForEvent('download')
    await detail.getByRole('button', { name: `Download ${source.fileName}`, exact: true }).click()
    expect((await downloading).suggestedFilename()).toBe(source.fileName)
    const privateContent = await page.request.get(`${apiUrl}/attachments/${source.proofId}/content`)
    expect(privateContent.status()).toBe(200)
    expect(privateContent.headers()['cache-control']).toBe('private, no-store')
    expect(await privateContent.body()).toEqual(proof)
    await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
})

test('expense loading, option retries and list/detail failures preserve draft focus and recover', async ({
  page,
}) => {
  await login(page)
  const expense = await prepareExpense(page)
  let failOptions = true,
    releaseOptions: () => void = () => undefined
  const optionsGate = new Promise<void>((resolve) => {
    releaseOptions = resolve
  })
  await page.route('**/api/v1/expenses/options', async (route) => {
    if (failOptions)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Expense options temporarily unavailable.' } }),
      })
    else {
      await optionsGate
      await route.continue()
    }
  })
  await page.goto('/expenses')
  await page.getByRole('button', { name: 'New expense', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'New expense', exact: true })
  await form.getByLabel('Description', { exact: true }).fill('Keep this expense draft')
  await form.getByLabel('Amount', { exact: true }).fill('0.30')
  await expect(form.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failOptions = false
  await form.getByRole('button', { name: 'Try again', exact: true }).click()
  await form.getByLabel('Description', { exact: true }).focus()
  releaseOptions()
  await expect(form.getByLabel('Branch', { exact: true })).toBeEnabled()
  await expect(form.getByLabel('Description', { exact: true })).toHaveValue(
    'Keep this expense draft',
  )
  await expect(form.getByLabel('Description', { exact: true })).toBeFocused()
  await expect(form.getByLabel('Amount', { exact: true })).toHaveValue('0.30')
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.getByLabel('Search Expenses', { exact: true }).fill('no-matching-expense-fixture')
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible()
  let failDetail = true,
    releaseDetail: () => void = () => undefined
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve
  })
  await page.route(`**/api/v1/expenses/${expense.id}**`, async (route) => {
    if (failDetail) {
      await detailGate
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Expense detail temporarily unavailable.' } }),
      })
    } else await route.continue()
  })
  await page.goto('/expenses')
  await page.getByLabel('Search Expenses', { exact: true }).fill(expense.description)
  await tableRecordControl(page, expense.description).click()
  const detail = page.getByRole('dialog')
  try {
    await expect(detail.getByRole('status')).toContainText(/Loading/)
  } finally {
    releaseDetail()
  }
  await expect(detail.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failDetail = false
  await detail.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(detail.getByText('Submitted by', { exact: true })).toBeVisible()
  await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  let failList = true
  await page.route('**/api/v1/expenses?*', (route) =>
    failList
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Expenses temporarily unavailable.' } }),
        })
      : route.continue(),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failList = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Expenses records', exact: true })).toBeVisible()
})

test('expense amounts sort numerically and filtered page CSV is safe and paginated', async ({
  page,
}, testInfo) => {
  await login(page)
  const prefix = `=SUM(1,2) Expense sort ${crypto.randomUUID().slice(0, 8)}`
  for (const [index, amount] of [
    '2.00',
    '10.00',
    '100.00',
    '0.10',
    '0.20',
    '1.00',
    '11.00',
    '3.00',
    '4.00',
    '5.00',
    '6.00',
    '7.00',
  ].entries())
    await prepareExpense(page, `${prefix} ${index}`, amount)
  await page.goto('/expenses')
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname.endsWith('/expenses') && url.searchParams.get('search') === prefix
  })
  await page.getByLabel('Search Expenses', { exact: true }).fill(prefix)
  await expect(page.getByRole('button', { name: 'Export page', exact: true })).toBeDisabled()
  expect((await filtered).status()).toBe(200)
  await page.getByLabel('Rows per page', { exact: true }).selectOption('10')
  await page.getByRole('columnheader', { name: 'Amount', exact: true }).getByRole('button').click()
  const table = page.getByRole('table', { name: 'Expenses records', exact: true })
  const amountColumn = (await table.getByRole('columnheader').allTextContents()).findIndex(
    (text) => text.trim() === 'Amount',
  )
  await expect(table.locator('tbody tr')).toHaveCount(10)
  await expect(table.getByRole('columnheader', { name: 'Amount', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await expect
    .poll(async () =>
      Promise.all(
        (await table.locator('tbody tr').all()).map((row) =>
          row.getByRole('cell').nth(amountColumn).innerText(),
        ),
      ),
    )
    .toEqual([
      '₱0.10',
      '₱0.20',
      '₱1.00',
      '₱2.00',
      '₱3.00',
      '₱4.00',
      '₱5.00',
      '₱6.00',
      '₱7.00',
      '₱10.00',
    ])
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export page', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('expenses.csv')
  const path = testInfo.outputPath('expenses.csv')
  await download.saveAs(path)
  const csv = await readFile(path, 'utf8')
  expect(csv).toContain(`"'${prefix}`)
  expect(csv.split('\r\n')).toHaveLength(11)
  expect(csv).not.toContain('₱100.00')
  expect(csv).not.toContain('₱11.00')
  expect(csv).not.toContain('Expense fixture')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await expect
    .poll(async () =>
      Promise.all(
        (await table.locator('tbody tr').all()).map((row) =>
          row.getByRole('cell').nth(amountColumn).innerText(),
        ),
      ),
    )
    .toEqual(['₱11.00', '₱100.00'])
})

test('a committed manual expense retries after a lost response without duplicate financial entries', async ({
  page,
}) => {
  await login(page)
  await prepareExpense(
    page,
    `Expense category suggestion ${crypto.randomUUID().slice(0, 8)}`,
    '0.01',
  )
  let attempts = 0
  const requestKeys: string[] = []
  await page.route('**/api/v1/expenses', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts += 1
    requestKeys.push((route.request().postDataJSON() as { requestKey: string }).requestKey)
    if (attempts === 1) {
      expect((await route.fetch()).status()).toBe(201)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'The expense response was lost. Retry this draft.' },
        }),
      })
    } else await route.continue()
  })
  await page.goto('/expenses')
  await page.getByRole('button', { name: 'New expense', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'New expense', exact: true })
  const description = `Single expense receipt ${crypto.randomUUID().slice(0, 8)}`
  await form.getByLabel('Description', { exact: true }).fill(description)
  await fillCategory(form)
  await form.getByLabel('Amount', { exact: true }).fill('0.30')
  await form.getByLabel('Branch', { exact: true }).selectOption(fixtures.branchId)
  const first = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/expenses` && response.request().method() === 'POST',
  )
  await form.getByRole('button', { name: 'Save expense', exact: true }).click()
  expect((await first).status()).toBe(503)
  await expect(form.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(form.getByLabel('Description', { exact: true })).toHaveValue(description)
  await expect(form.getByLabel('Amount', { exact: true })).toHaveValue('0.30')
  const second = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/expenses` && response.request().method() === 'POST',
  )
  await form.getByRole('button', { name: 'Save expense', exact: true }).click()
  expect((await second).status()).toBe(201)
  await expect(form).toBeHidden()
  expect(requestKeys).toHaveLength(2)
  expect(requestKeys[0]).toMatch(/^[a-f\d-]{36}$/i)
  expect(requestKeys[1]).toBe(requestKeys[0])
  const records = await api<ExpenseList>(
    page.request,
    `/expenses?search=${encodeURIComponent(description)}`,
  )
  expect(records.total).toBe(1)
  const saved = await api<ExpenseDetail>(page.request, `/expenses/${records.data[0].id}`)
  expect(saved.expense.amount).toBe('0.30')
  expect(saved.history.filter((entry) => entry.action === 'created expenses')).toHaveLength(1)
})
