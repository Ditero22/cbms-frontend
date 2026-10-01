import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const password = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
}
type Transfer = { id: string; reference: string; status: string }
type StockList = {
  data: { id: string; productId: string; branchId: string; quantity: string }[]
}
type StockDetail = {
  movements: { referenceId: string | null; transactionType: string; quantityDelta: string }[]
}

test.beforeAll(() => {
  expect(password.length, 'Use the disposable browser-test runner.').toBeGreaterThanOrEqual(12)
  for (const branch of [fixtures.branchId, fixtures.otherBranchId])
    expect(branch).toMatch(/^[a-f\d-]{36}$/i)
})

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const dark = page.getByRole('button', { name: 'Switch to dark mode', exact: true })
  if (await dark.isVisible()) await dark.click()
}

async function api<T>(request: APIRequestContext, path: string, method = 'GET', data?: unknown) {
  const response = await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function prepareStock(page: Page, quantity: string) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const sku = `REPLAY-${suffix}`
  const product = await api<{ id: string }>(page.request, '/products', 'POST', {
    name: `Transfer replay material ${suffix}`,
    sku,
    category: 'Materials',
    unit: 'kg',
    unitPrice: '10.00',
  })
  await api(page.request, '/inventory/adjustments', 'POST', {
    productId: product.id,
    branchId: fixtures.branchId,
    quantityDelta: quantity,
  })
  return { ...product, sku, name: `Transfer replay material ${suffix}` }
}

async function openTransfer(page: Page, productId: string, quantity: string) {
  await page.goto('/transfers')
  await page.getByRole('button', { name: 'New transfer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New stock transfer', exact: true })
  const source = dialog.getByRole('combobox', { name: 'From branch', exact: true })
  await expect(source).toBeEnabled()
  await source.selectOption(fixtures.branchId)
  await dialog
    .getByRole('combobox', { name: 'To branch', exact: true })
    .selectOption(fixtures.otherBranchId)
  await dialog.getByRole('combobox', { name: 'Product', exact: true }).selectOption(productId)
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill(quantity)
  return dialog
}

async function withinViewport(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible()
  await expect
    .poll(async () => {
      const bounds = await dialog.boundingBox()
      const viewport = page.viewportSize()!
      return Boolean(
        bounds &&
        bounds.x >= -1 &&
        bounds.y >= -1 &&
        bounds.x + bounds.width <= viewport.width + 1 &&
        bounds.y + bounds.height <= viewport.height + 1,
      )
    })
    .toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

async function interceptCommittedResponse(page: Page) {
  const keys: string[] = []
  const committed: Transfer[] = []
  await page.route(`${apiUrl}/transfers`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const body = route.request().postDataJSON() as { requestKey: string }
    keys.push(body.requestKey)
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    committed.push((await response.json()) as Transfer)
    if (keys.length === 1)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'RESPONSE_LOST',
            message: 'The save response was interrupted. Retry the unchanged transfer.',
          },
        }),
      })
    return route.fulfill({ response })
  })
  return { keys, committed }
}

async function inspectStock(page: Page, productId: string, sku: string) {
  const list = await api<StockList>(
    page.request,
    `/inventory?search=${encodeURIComponent(sku)}&limit=100`,
  )
  const source = list.data.find(
    (row) => row.productId === productId && row.branchId === fixtures.branchId,
  )!
  const destination = list.data.find(
    (row) => row.productId === productId && row.branchId === fixtures.otherBranchId,
  )!
  const detail = await api<StockDetail>(page.request, `/inventory/${source.id}`)
  return { source, destination, detail }
}

for (const width of [390, 768, 1440]) {
  test(`an unchanged committed-transfer retry moves stock once at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const product = await prepareStock(page, '2.375')
    const dialog = await openTransfer(page, product.id, '2.375')
    await dialog.getByLabel('Note', { exact: true }).fill('  One restock intent  ')
    const interception = await interceptCommittedResponse(page)
    await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'The service is temporarily unavailable. Please try again shortly.',
    )
    await expect(dialog.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue(
      '2.375',
    )
    await withinViewport(page, dialog)
    const beforeRetry = await inspectStock(page, product.id, product.sku)
    expect(beforeRetry.source.quantity).toBe('0.000')
    expect(beforeRetry.destination.quantity).toBe('2.375')
    await page.screenshot({ path: testInfo.outputPath(`transfer-interrupted-${width}.png`) })

    // Equivalent decimal text and trimmed notes still represent the original intent.
    await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('02.375')
    await dialog.getByLabel('Note', { exact: true }).fill('One restock intent')
    await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
    await expect(dialog).toBeHidden()
    expect(interception.keys).toHaveLength(2)
    expect(interception.keys[0]).toMatch(/^[a-f\d-]{36}$/i)
    expect(interception.keys[1]).toBe(interception.keys[0])
    expect(interception.committed[1]).toEqual(interception.committed[0])
    const afterRetry = await inspectStock(page, product.id, product.sku)
    expect(afterRetry.source.quantity).toBe('0.000')
    expect(afterRetry.destination.quantity).toBe('2.375')
    expect(
      afterRetry.detail.movements.filter(
        (movement) => movement.referenceId === interception.committed[0]!.id,
      ),
    ).toEqual([
      expect.objectContaining({ transactionType: 'TRANSFER_OUT', quantityDelta: '-2.375' }),
    ])
    const listed = await api<{ total: number }>(
      page.request,
      `/transfers?search=${encodeURIComponent(interception.committed[0]!.reference)}`,
    )
    expect(listed.total).toBe(1)
    const transferDetail = await api<{
      fromBranchName: string
      toBranchName: string
      note: string | null
      items: { productName: string; quantity: string }[]
      history: { action: string }[]
    }>(page.request, `/transfers/${interception.committed[0]!.id}`)
    expect(transferDetail).toMatchObject({
      fromBranchName: expect.any(String),
      toBranchName: expect.any(String),
      note: 'One restock intent',
      items: [{ productName: product.name, quantity: '2.375' }],
      history: [{ action: 'completed inventory transfer' }],
    })
    await page.goto('/transfers')
    await page
      .getByLabel('Search Stock Transfers', { exact: true })
      .fill(interception.committed[0]!.reference)
    await tableRecordControl(page, interception.committed[0]!.reference).click()
    const details = page.getByRole('dialog', { name: interception.committed[0]!.reference })
    await expect(details.getByRole('heading', { name: 'Branch movement' })).toBeVisible()
    await expect(details.getByText(transferDetail.fromBranchName, { exact: true })).toBeVisible()
    await expect(details.getByText(transferDetail.toBranchName, { exact: true })).toBeVisible()
    await expect(details.getByText(product.name, { exact: true })).toBeVisible()
    await expect(details.locator('.transfer-detail-items')).toContainText(product.sku)
    await expect(details.getByText('One restock intent', { exact: true })).toBeVisible()
    await expect(details.getByRole('heading', { name: 'Record history' })).toBeVisible()
    await withinViewport(page, details)
  })
}

test('changing the transfer intent creates a new replay identity and posts only the new quantity', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await login(page)
  const product = await prepareStock(page, '5.000')
  const dialog = await openTransfer(page, product.id, '1.000')
  const interception = await interceptCommittedResponse(page)
  await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2.000')
  await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(interception.keys).toHaveLength(2)
  expect(interception.keys[1]).not.toBe(interception.keys[0])
  expect(interception.committed[1]?.id).not.toBe(interception.committed[0]?.id)
  const result = await inspectStock(page, product.id, product.sku)
  expect(result.source.quantity).toBe('2.000')
  expect(result.destination.quantity).toBe('3.000')
  expect(
    result.detail.movements.filter((movement) => movement.transactionType === 'TRANSFER_OUT'),
  ).toHaveLength(2)

  // A new form after success can intentionally post the same quantity again.
  const nextDialog = await openTransfer(page, product.id, '2.000')
  await nextDialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
  await expect(nextDialog).toBeHidden()
  expect(interception.keys).toHaveLength(3)
  expect(interception.keys[2]).not.toBe(interception.keys[1])
  expect(interception.committed[2]?.id).not.toBe(interception.committed[1]?.id)
  const afterNewForm = await inspectStock(page, product.id, product.sku)
  expect(afterNewForm.source.quantity).toBe('0.000')
  expect(afterNewForm.destination.quantity).toBe('5.000')
})
