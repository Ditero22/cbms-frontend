import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'
import { paymentProof, recordPaymentWithProof } from './helpers/payment-proof'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const password = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  customerId: string
  productId: string
}
const proofBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=',
  'base64',
)
type Order = { id: string; orderNumber: string }
type Detail = {
  balance: string
  paymentStatus: string
  payments: {
    id: string
    amount: string
    method: string
    paymentDate: string
    externalReference: string | null
    notes: string | null
  }[]
  history: { action: string }[]
}

async function api<T>(
  request: APIRequestContext,
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const response =
    path === '/payments' && method === 'POST'
      ? await recordPaymentWithProof(request, apiUrl, data as Record<string, unknown>)
      : await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  if (response.status() === 204) return undefined as T
  return response.json() as Promise<T>
}

async function login(page: Page, email = 'administrator@example.invalid') {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible()
  const dark = page.getByRole('button', { name: 'Switch to dark mode', exact: true })
  if (await dark.isVisible()) await dark.click()
  await expect(
    page.getByRole('button', { name: 'Switch to light mode', exact: true }),
  ).toBeVisible()
}

async function createOrder(request: APIRequestContext, quantity = 1) {
  return api<Order>(request, '/orders', 'POST', {
    customerId: fixtures.customerId,
    branchId: fixtures.branchId,
    items: [{ productId: fixtures.productId, quantity }],
  })
}

async function bounds(page: Page, dialog: Locator) {
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
}

async function searchOrder(page: Page, order: Order) {
  await page.goto('/payments')
  await page.getByLabel('Search Payments', { exact: true }).fill(order.orderNumber)
  await expect(tableRecordControl(page, order.orderNumber)).toBeVisible()
}

async function openOrder(page: Page, order: Order) {
  await searchOrder(page, order)
  await tableRecordControl(page, order.orderNumber).click()
  const dialog = page.getByRole('dialog', { name: `${order.orderNumber} payments`, exact: true })
  await expect(dialog.getByRole('heading', { name: 'Payment history', exact: true })).toBeVisible()
  return dialog
}

function recordElement(page: Page, order: Order, width: number) {
  return width <= 800
    ? page.locator('.record-card').filter({ hasText: order.orderNumber })
    : page.getByRole('row').filter({ hasText: order.orderNumber })
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`Payments balance and receipt form are visible and fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const order = await createOrder(page.request)
    await searchOrder(page, order)
    await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toHaveCount(1)
    const record = recordElement(page, order, width)
    await expect(record.getByText('Unpaid', { exact: true })).toBeVisible()
    await expect(record.getByText('₱10.00', { exact: true }).first()).toBeVisible()
    if (width <= 800) {
      await expect(page.getByRole('table', { name: 'Payments records', exact: true })).toBeHidden()
      await expect(record.getByText('Remaining Balance', { exact: true })).toBeVisible()
      await expect(record.getByText('Amount Paid', { exact: true })).toBeVisible()
    } else {
      await expect(
        page.getByRole('columnheader').filter({ hasText: 'Remaining Balance' }),
      ).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({ path: testInfo.outputPath(`payments-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Record payment', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Record customer payment', exact: true })
    await expect(form.getByLabel(/^Order/)).toBeEnabled()
    await form.getByLabel(/^Order/).selectOption(order.id)
    await expect(
      form
        .getByLabel(/^Method/)
        .locator('option')
        .filter({ hasText: 'GCash' }),
    ).toHaveCount(1)
    await bounds(page, form)
    await page.screenshot({ path: testInfo.outputPath(`payment-form-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeFocused()
    const detail = await openOrder(page, order)
    await bounds(page, detail)
    await expect(
      detail.getByText('No payments have been recorded for this order.', { exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`payment-detail-${width}.png`) })
  })
}

for (const width of [390, 1280]) {
  test(`partial and final payments retain receipts and update table balances at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const order = await createOrder(page.request, 10)
    let detail = await openOrder(page, order)
    await detail.getByRole('button', { name: 'Record payment', exact: true }).click()
    let form = page.getByRole('dialog', { name: 'Record customer payment', exact: true })
    await expect(form.getByLabel(/^Order/)).toHaveValue(order.id)
    await form.getByLabel(/^Amount/).fill('30.00')
    await form.getByLabel(/^Method/).selectOption('GCash')
    await form.getByLabel(/^Payment date/).fill('2020-09-01')
    await form.getByLabel(/^Reference number/).fill(`GCash-${width}-first`)
    await form.getByLabel(/^Notes/).fill('Initial construction delivery installment')
    await form.getByLabel(/^Receipt \/ payment proof/).setInputFiles(paymentProof)
    await expect(
      form.getByRole('img', { name: `Selected payment proof: ${paymentProof.name}` }),
    ).toBeVisible()
    await form.getByRole('button', { name: 'Record payment', exact: true }).click()
    await expect(form).toBeHidden()
    detail = page.getByRole('dialog', { name: `${order.orderNumber} payments`, exact: true })
    await expect(detail.getByText('Partially Paid', { exact: true })).toBeVisible()
    await expect(detail.getByText(`GCash-${width}-first`, { exact: true })).toBeVisible()
    await expect(
      detail.getByText('Initial construction delivery installment', { exact: true }),
    ).toBeVisible()
    await detail.getByRole('button', { name: 'Close', exact: true }).click()
    const row = recordElement(page, order, width)
    await expect(row.getByText('₱70.00', { exact: true })).toBeVisible()
    await expect(row.getByText('Partially Paid', { exact: true })).toBeVisible()
    await tableRecordControl(page, order.orderNumber).click()
    detail = page.getByRole('dialog', { name: `${order.orderNumber} payments`, exact: true })
    await detail.getByRole('button', { name: 'Record payment', exact: true }).click()
    form = page.getByRole('dialog', { name: 'Record customer payment', exact: true })
    await form.getByLabel(/^Amount/).fill('70.00')
    await form.getByLabel(/^Method/).selectOption('Bank transfer')
    await form.getByLabel(/^Payment date/).fill('2020-09-20')
    await form.getByLabel(/^Reference number/).fill(`Bank-${width}-final`)
    await form.getByLabel(/^Receipt \/ payment proof/).setInputFiles(paymentProof)
    await form.getByRole('button', { name: 'Record payment', exact: true }).click()
    await expect(form).toBeHidden()
    detail = page.getByRole('dialog', { name: `${order.orderNumber} payments`, exact: true })
    await expect(detail.getByText('Paid', { exact: true })).toBeVisible()
    await expect(detail.getByRole('article')).toHaveCount(2)
    await expect(detail.getByRole('button', { name: 'Record payment', exact: true })).toBeDisabled()
    const financial = await api<Detail>(page.request, `/payments/orders/${order.id}`)
    expect(financial).toMatchObject({ balance: '0.00', paymentStatus: 'Paid' })
    expect(financial.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: '30.00',
          method: 'GCash',
          paymentDate: '2020-09-01',
          externalReference: `GCash-${width}-first`,
        }),
        expect.objectContaining({
          amount: '70.00',
          method: 'Bank transfer',
          paymentDate: '2020-09-20',
          externalReference: `Bank-${width}-final`,
        }),
      ]),
    )
    await detail.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(row.getByText('₱0.00', { exact: true })).toBeVisible()
    await expect(row.getByText('Paid', { exact: true })).toBeVisible()
  })
}

test('payment proofs upload and download privately, reject executable files, and audit real receipts', async ({
  page,
  browser,
}) => {
  await login(page)
  const order = await createOrder(page.request)
  const receipt = await api<{ id: string; reference: string }>(page.request, '/payments', 'POST', {
    orderId: order.id,
    amount: '10.00',
    method: 'GCash',
    requestKey: crypto.randomUUID(),
  })
  const detail = await openOrder(page, order)
  const card = detail.getByRole('article', { name: `Payment ${receipt.reference}`, exact: true })
  await card.getByRole('button', { name: 'View or attach receipt/proof', exact: true }).click()
  const file = card.getByLabel('Attach proof', { exact: true })
  await file.setInputFiles({
    name: 'unsafe.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ unsafe executable'),
  })
  await card.getByRole('button', { name: 'Upload proof', exact: true }).click()
  await expect(card.getByRole('alert')).toContainText('JPEG')
  await file.setInputFiles({ name: 'gcash-receipt.png', mimeType: 'image/png', buffer: proofBytes })
  await card.getByRole('button', { name: 'Upload proof', exact: true }).click()
  await expect(card.getByText('gcash-receipt.png', { exact: true })).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await card.getByRole('button', { name: 'Download gcash-receipt.png', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('gcash-receipt.png')
  const attachments = await api<{ items: { id: string; fileName: string }[] }>(
    page.request,
    `/attachments?entityType=payment&entityId=${receipt.id}`,
  )
  expect(attachments.items).toHaveLength(2)
  const uploadedProof = attachments.items.find((item) => item.fileName === 'gcash-receipt.png')!
  const downloaded = await page.request.get(`${apiUrl}/attachments/${uploadedProof.id}/content`)
  expect(downloaded.ok()).toBe(true)
  expect(downloaded.headers()['cache-control']).toBe('private, no-store')
  expect(await downloaded.body()).toEqual(proofBytes)
  const financial = await api<Detail>(page.request, `/payments/orders/${order.id}`)
  expect(financial.history.some((entry) => entry.action === 'uploaded proof')).toBe(true)
  const deniedContext = await browser.newContext({
    baseURL: process.env.CBMS_E2E_BASE_URL ?? 'http://127.0.0.1:5180',
  })
  try {
    const deniedPage = await deniedContext.newPage()
    await login(deniedPage, 'account-reader@example.invalid')
    expect(
      (
        await deniedPage.request.get(`${apiUrl}/attachments/${attachments.items[0].id}/content`)
      ).status(),
    ).toBe(403)
    expect((await deniedPage.request.get(`${apiUrl}/payments/orders/${order.id}`)).status()).toBe(
      403,
    )
  } finally {
    await deniedContext.close()
  }
})

test('read-only payment users see balances and history without financial actions or upload controls', async ({
  page,
}) => {
  await login(page)
  const order = await createOrder(page.request)
  await api(page.request, '/payments', 'POST', {
    orderId: order.id,
    amount: '5.00',
    method: 'Cash',
  })
  await api(page.request, '/auth/logout', 'POST')
  await login(page, 'viewer@example.invalid')
  const detail = await openOrder(page, order)
  await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toHaveCount(0)
  await expect(detail.getByText('Partially Paid', { exact: true })).toBeVisible()
  await expect(detail.getByRole('heading', { name: 'Record history', exact: true })).toHaveCount(0)
  await detail.getByRole('button', { name: 'View receipt/proof', exact: true }).click()
  await expect(detail.getByLabel('Attach proof', { exact: true })).toHaveCount(0)
  await detail.getByRole('button', { name: `Preview ${paymentProof.name}`, exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Payment proof', exact: true })
  await expect(
    preview.getByRole('img', { name: `Payment proof: ${paymentProof.name}` }),
  ).toBeVisible()
  await preview.getByRole('button', { name: 'Close', exact: true }).click()
  const denied = await page.request.post(`${apiUrl}/payments`, {
    data: { orderId: order.id, amount: '1.00', method: 'Cash' },
  })
  expect(denied.status()).toBe(403)
})

test('payment options retry preserves input and list errors/empty filters recover', async ({
  page,
}) => {
  await login(page)
  const order = await createOrder(page.request)
  let failOptions = true
  await page.route('**/api/v1/payments/options', async (route) => {
    if (failOptions)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Payment options temporarily unavailable.' } }),
      })
    else await route.continue()
  })
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Record payment', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Record customer payment', exact: true })
  await form.getByLabel(/^Notes/).fill('Keep this draft after retry')
  await expect(form.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failOptions = false
  await form.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(form.getByLabel(/^Order/)).toBeEnabled()
  await expect(form.getByLabel(/^Notes/)).toHaveValue('Keep this draft after retry')
  await form.getByLabel(/^Order/).selectOption(order.id)
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByLabel('Search Payments', { exact: true }).fill('no-matching-payment-order')
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible()
  await page.getByLabel('Search Payments', { exact: true }).fill(order.orderNumber)
  await expect(tableRecordControl(page, order.orderNumber)).toBeVisible()
  let failList = true
  await page.route('**/api/v1/payments?*', async (route) => {
    if (failList)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Payments temporarily unavailable.' } }),
      })
    else await route.continue()
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failList = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Payments records', exact: true })).toBeVisible()
})
