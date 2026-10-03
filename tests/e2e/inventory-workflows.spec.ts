import { readFile } from 'node:fs/promises'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const temporaryPassword = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
  customerId: string
}

type InventoryList = { data: { id: string; productId: string; branchId: string }[]; total: number }
type InventoryDetail = {
  inventory: {
    id: string
    productId: string
    branchId: string
    quantity: string
    reservedQuantity: string
    availableQuantity: string
    reorderLevel: string
    status: string
  }
  movements: {
    id: string
    transactionType: string
    quantityDelta: string
    stockDelta: string
    reservedDelta: string
    note: string | null
    createdAt: string
  }[]
  movementPage: number
  movementTotal: number
  historyTotal: number
}
type StockFixture = { id: string; otherId: string; productId: string; name: string }

test.beforeAll(() => {
  for (const key of ['branchId', 'otherBranchId', 'customerId'] as const) {
    expect(fixtures[key], `Disposable browser fixture ${key} is required.`).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,
    )
  }
  expect(temporaryPassword.length, 'Use the isolated browser-test runner.').toBeGreaterThanOrEqual(
    12,
  )
})

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

async function prepareStock(page: Page, prefix = 'Inventory material', quantity = '10.125') {
  const suffix = crypto.randomUUID().slice(0, 8)
  const name = `${prefix} ${suffix}`
  const product = await api<{ id: string }>(page.request, '/products', 'POST', {
    name,
    sku: `INV-${suffix}`,
    category: 'Materials',
    unit: 'kg',
    unitPrice: '10.00',
  })
  await api(page.request, '/inventory/adjustments', 'POST', {
    productId: product.id,
    branchId: fixtures.branchId,
    quantityDelta: quantity,
    note: 'Acceptance opening adjustment',
  })
  const list = await api<InventoryList>(
    page.request,
    `/inventory?search=${encodeURIComponent(name)}&page=1&limit=10`,
  )
  const own = list.data.find((row) => row.branchId === fixtures.branchId)
  const other = list.data.find((row) => row.branchId === fixtures.otherBranchId)
  expect(own?.id).toMatch(/^[a-f\d-]{36}$/i)
  expect(other?.id).toMatch(/^[a-f\d-]{36}$/i)
  return { id: own!.id, otherId: other!.id, productId: product.id, name }
}

function stockRow(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1280) <= 800
  return mobile
    ? page
        .locator('.record-grid .record-card')
        .filter({ hasText: name })
        .filter({ has: page.getByText('Acceptance branch', { exact: true }) })
    : page
        .getByRole('table', { name: 'Inventory records', exact: true })
        .getByRole('row')
        .filter({ hasText: name })
        .filter({ has: page.getByRole('cell', { name: 'Acceptance branch', exact: true }) })
}

async function openStock(page: Page, stock: StockFixture) {
  await page.goto('/inventory')
  await page.getByLabel('Search Inventory', { exact: true }).fill(stock.name)
  const loaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/v1/inventory/${stock.id}`,
  )
  await stockRow(page, stock.name).click()
  const detail = (await (await loaded).json()) as InventoryDetail
  expect(detail.inventory).toMatchObject({ id: stock.id, branchId: fixtures.branchId })
  const dialog = page.getByRole('dialog', { name: stock.name, exact: true })
  await expect(dialog.getByRole('heading', { name: 'Stock movements', exact: true })).toBeVisible()
  return dialog
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
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
}

async function saveAdjustment(page: Page, form: Locator) {
  const response = page.waitForResponse(
    (res) => res.url() === `${apiUrl}/inventory/adjustments` && res.request().method() === 'POST',
  )
  await form.getByRole('button', { name: 'Save adjustment', exact: true }).click()
  return response
}

function movements(page: Page, detail: Locator) {
  return (page.viewportSize()?.width ?? 1280) <= 800
    ? detail.locator('[aria-label="Stock movement cards"]')
    : detail.getByRole('table', { name: 'Stock movement ledger', exact: true })
}

async function changeReorder(page: Page, detail: Locator, level: string) {
  await detail.getByRole('button', { name: 'Edit reorder point', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Edit reorder point', exact: true })
  await form.getByLabel('Reorder point', { exact: true }).fill(level)
  const saved = page.waitForResponse(
    (res) => /\/inventory\/[^/]+\/reorder$/.test(res.url()) && res.request().method() === 'PATCH',
  )
  await form.getByRole('button', { name: 'Save reorder point', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(form).toBeHidden()
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`inventory list, stock detail, adjustment and reorder forms fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const stock = await prepareStock(page)
    await page.goto('/inventory')
    await page.getByLabel('Search Inventory', { exact: true }).fill(stock.name)
    await expect(page.getByRole('button', { name: 'Adjust stock', exact: true })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    const row = stockRow(page, stock.name)
    await expect(row).toContainText('10.125 kg')
    if (width <= 800) {
      await expect(page.getByRole('table', { name: 'Inventory records', exact: true })).toBeHidden()
      for (const label of ['Branch', 'On hand', 'Reserved', 'Available', 'Reorder point']) {
        await expect(row.getByText(label, { exact: true })).toBeVisible()
      }
    }
    await page.screenshot({
      path: testInfo.outputPath(`inventory-list-${width}.png`),
      fullPage: true,
    })
    const adjust = page.getByRole('button', { name: 'Adjust stock', exact: true })
    await adjust.click()
    let form = page.getByRole('dialog', { name: 'Adjust stock', exact: true })
    await expect(form.getByLabel('Product', { exact: true })).toBeEnabled()
    await form.getByLabel('Product', { exact: true }).selectOption(stock.productId)
    await form.getByLabel('Branch', { exact: true }).selectOption(fixtures.branchId)
    await expect(form.getByRole('radio', { name: 'Add stock', exact: true })).toBeChecked()
    await expect(form.getByLabel('Quantity', { exact: true })).toHaveAttribute('step', '0.001')
    await bounds(page, form)
    await page.screenshot({ path: testInfo.outputPath(`inventory-adjustment-${width}.png`) })
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
    await expect(adjust).toBeFocused()
    const detail = await openStock(page, stock)
    await bounds(page, detail)
    for (const label of ['On hand', 'Reserved', 'Available', 'Reorder point']) {
      await expect(detail.getByText(label, { exact: true })).toBeVisible()
    }
    await detail.getByRole('button', { name: 'Edit reorder point', exact: true }).click()
    form = page.getByRole('dialog', { name: 'Edit reorder point', exact: true })
    await bounds(page, form)
    await expect(form.getByLabel('Reorder point', { exact: true })).toHaveAttribute('min', '0')
    await page.screenshot({ path: testInfo.outputPath(`inventory-reorder-${width}.png`) })
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await bounds(page, detail)
    await page.screenshot({ path: testInfo.outputPath(`inventory-detail-${width}.png`) })
  })
}

for (const width of [390, 1280]) {
  test(`exact stock adjustments preserve reservations and reorder alerts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const stock = await prepareStock(page)
    await api(page.request, '/orders', 'POST', {
      customerId: fixtures.customerId,
      branchId: fixtures.branchId,
      items: [{ productId: stock.productId, quantity: '4.125' }],
    })
    let snapshot = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
    expect(snapshot.inventory).toMatchObject({
      quantity: '10.125',
      reservedQuantity: '4.125',
      availableQuantity: '6.000',
    })
    expect(snapshot.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stockDelta: '0.000', reservedDelta: '4.125' }),
      ]),
    )
    let detail = await openStock(page, stock)
    const reservation =
      width <= 800
        ? movements(page, detail).getByRole('article').filter({ hasText: 'Stock reserved' })
        : movements(page, detail).getByRole('row').filter({ hasText: 'Stock reserved' })
    await expect(reservation).toContainText('+4.125')
    if (width <= 800) {
      await expect(
        reservation
          .locator('dl > div')
          .filter({ hasText: 'On-hand change' })
          .getByRole('definition'),
      ).toHaveText('0')
      await expect(
        reservation
          .locator('dl > div')
          .filter({ hasText: 'Reserved change' })
          .getByRole('definition'),
      ).toHaveText('+4.125')
    } else {
      await expect(reservation.getByRole('cell').nth(1)).toHaveText('0')
      await expect(reservation.getByRole('cell').nth(2)).toHaveText('+4.125')
    }
    await detail.getByRole('button', { name: 'Adjust this stock', exact: true }).click()
    let form = page.getByRole('dialog', { name: 'Adjust stock', exact: true })
    await expect(form.getByLabel('Product', { exact: true })).toHaveValue(stock.productId)
    await expect(form.getByLabel('Branch', { exact: true })).toHaveValue(fixtures.branchId)
    await form.getByRole('radio', { name: 'Remove stock', exact: true }).check()
    await form.getByLabel('Quantity', { exact: true }).fill('6.001')
    await form
      .getByLabel('Reason / note', { exact: true })
      .fill('Do not consume reserved customer stock')
    expect((await saveAdjustment(page, form)).status()).toBe(409)
    await expect(form.getByRole('alert')).toContainText(/stock|reserved|available/i)
    await expect(form.getByLabel('Quantity', { exact: true })).toHaveValue('6.001')
    await expect(form.getByLabel('Reason / note', { exact: true })).toHaveValue(
      'Do not consume reserved customer stock',
    )
    const rejected = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
    expect(rejected.inventory.quantity).toBe('10.125')
    expect(rejected.movementTotal).toBe(snapshot.movementTotal)
    await form.getByLabel('Quantity', { exact: true }).fill('0.125')
    await form.getByLabel('Reason / note', { exact: true }).fill('Measured wastage')
    expect((await saveAdjustment(page, form)).status()).toBe(201)
    await expect(form).toBeHidden()
    detail = page.getByRole('dialog', { name: stock.name, exact: true })
    await expect(
      movements(page, detail).getByText('Measured wastage', { exact: true }),
    ).toBeVisible()
    await detail.getByRole('button', { name: 'Adjust this stock', exact: true }).click()
    form = page.getByRole('dialog', { name: 'Adjust stock', exact: true })
    await form.getByRole('radio', { name: 'Add stock', exact: true }).check()
    await form.getByLabel('Quantity', { exact: true }).fill('0.001')
    await form.getByLabel('Reason / note', { exact: true }).fill('Measured replenishment')
    expect((await saveAdjustment(page, form)).status()).toBe(201)
    await expect(form).toBeHidden()
    snapshot = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
    expect(snapshot.inventory).toMatchObject({
      quantity: '10.001',
      reservedQuantity: '4.125',
      availableQuantity: '5.876',
    })
    expect(snapshot.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionType: 'Adjustment',
          quantityDelta: '-0.125',
          note: 'Measured wastage',
        }),
        expect.objectContaining({
          transactionType: 'Adjustment',
          quantityDelta: '0.001',
          note: 'Measured replenishment',
        }),
      ]),
    )
    detail = page.getByRole('dialog', { name: stock.name, exact: true })
    await changeReorder(page, detail, '0')
    const before = await api<{ stats: { stockAlerts: number } }>(page.request, '/dashboard/summary')
    const reportBefore = await api<{ rows: Record<string, string>[] }>(
      page.request,
      '/reports/data?report=inventory-health&dateFrom=2026-01-01&dateTo=2026-12-31',
    )
    await changeReorder(page, detail, '10.001')
    await expect(detail.getByText('Low stock', { exact: true })).toBeVisible()
    const after = await api<{ stats: { stockAlerts: number } }>(page.request, '/dashboard/summary')
    expect(after.stats.stockAlerts).toBe(before.stats.stockAlerts + 1)
    const reportAfter = await api<{ rows: Record<string, string>[] }>(
      page.request,
      '/reports/data?report=inventory-health&dateFrom=2026-01-01&dateTo=2026-12-31',
    )
    const lowBefore = Number(
      reportBefore.rows.find((row) => row.Branch === 'Acceptance branch')?.['Low stock'],
    )
    const lowAfter = Number(
      reportAfter.rows.find((row) => row.Branch === 'Acceptance branch')?.['Low stock'],
    )
    expect(lowAfter).toBe(lowBefore + 1)
    await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(stockRow(page, stock.name).getByText('Low stock', { exact: true })).toBeVisible()
    const list = await api<InventoryList>(
      page.request,
      `/inventory?search=${encodeURIComponent(stock.name)}`,
    )
    expect(list.data.find((row) => row.branchId === fixtures.branchId)?.id).toBe(stock.id)
    await page.goto('/dashboard')
    await expect(
      page.getByRole('article').filter({ hasText: 'Stock alerts' }).locator('.stat-value'),
    ).toHaveText(String(after.stats.stockAlerts))
    detail = await openStock(page, stock)
    await changeReorder(page, detail, '0')
    await expect(detail.getByText('In stock', { exact: true })).toBeVisible()
    const reset = await api<{ stats: { stockAlerts: number } }>(page.request, '/dashboard/summary')
    expect(reset.stats.stockAlerts).toBe(before.stats.stockAlerts)
  })
}

test('inventory read and reorder grants are enforced by the API and the actual parent branch', async ({
  page,
}) => {
  await login(page)
  const stock = await prepareStock(page)
  const suffix = crypto.randomUUID().slice(0, 8)
  const readerEmail = `inventory-reader-${suffix}@example.invalid`
  const editorEmail = `inventory-reorder-${suffix}@example.invalid`
  for (const [email, permissions] of [
    [readerEmail, ['inventory.read']],
    [editorEmail, ['inventory.read', 'inventory.reorder']],
  ] as const) {
    const role = await api<{ id: string }>(page.request, '/roles', 'POST', {
      name: `Inventory ${email.split('@')[0]}`,
      permissions,
    })
    await api(page.request, '/users', 'POST', {
      name: `Inventory account ${suffix}`,
      email,
      password: temporaryPassword,
      roleId: role.id,
      branchId: fixtures.branchId,
      isCrossBranch: false,
    })
  }
  await api(page.request, '/auth/logout', 'POST')
  await login(page, readerEmail)
  let detail = await openStock(page, stock)
  await expect(page.getByRole('button', { name: 'Adjust stock', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Adjust this stock', exact: true })).toHaveCount(
    0,
  )
  await expect(detail.getByRole('button', { name: 'Edit reorder point', exact: true })).toHaveCount(
    0,
  )
  await expect(detail.getByRole('heading', { name: 'Record history', exact: true })).toHaveCount(0)
  expect(
    (
      await page.request.patch(`${apiUrl}/inventory/${stock.id}/reorder`, {
        data: { reorderLevel: '20' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await page.request.post(`${apiUrl}/inventory/adjustments`, {
        data: { productId: stock.productId, branchId: fixtures.branchId, quantityDelta: '1' },
      })
    ).status(),
  ).toBe(403)
  expect((await page.request.get(`${apiUrl}/inventory/${stock.otherId}`)).status()).toBe(404)
  const readerList = await api<InventoryList>(
    page.request,
    `/inventory?search=${encodeURIComponent(stock.name)}`,
  )
  expect(readerList.data.map((row) => row.branchId)).toEqual([fixtures.branchId])
  await api(page.request, '/auth/logout', 'POST')
  await login(page, editorEmail)
  detail = await openStock(page, stock)
  await expect(detail.getByRole('button', { name: 'Adjust this stock', exact: true })).toHaveCount(
    0,
  )
  await changeReorder(page, detail, '12.375')
  const updated = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
  expect(updated.inventory.reorderLevel).toBe('12.375')
  expect(
    (
      await page.request.patch(`${apiUrl}/inventory/${stock.otherId}/reorder`, {
        data: { reorderLevel: '20' },
      })
    ).status(),
  ).toBe(404)
})

test('stock movement filters and pagination show real adjustments without changing totals', async ({
  page,
}) => {
  await login(page)
  const stock = await prepareStock(page, 'Ledger material', '1')
  for (let index = 1; index <= 21; index += 1) {
    await api(page.request, '/inventory/adjustments', 'POST', {
      productId: stock.productId,
      branchId: fixtures.branchId,
      quantityDelta: '0.001',
      note: `Ledger adjustment ${String(index).padStart(2, '0')}`,
    })
  }
  const before = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
  expect(before.inventory.quantity).toBe('1.021')
  expect(before.movementTotal).toBe(22)
  const detail = await openStock(page, stock)
  const pagination = detail.getByRole('navigation', { name: 'Stock movement pages', exact: true })
  await expect(pagination).toContainText('Page 1 of 2')
  await expect(
    movements(page, detail).getByText('Ledger adjustment 21', { exact: true }),
  ).toBeVisible()
  await pagination.getByRole('button', { name: 'Older', exact: true }).click()
  await expect(pagination).toContainText('Page 2 of 2')
  await expect(
    movements(page, detail).getByText('Acceptance opening adjustment', { exact: true }),
  ).toBeVisible()
  await detail.getByLabel('Movement type', { exact: true }).selectOption('Adjustment')
  await detail.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(pagination).toContainText('Page 1 of 2')
  await detail.getByLabel('From date', { exact: true }).fill('1999-01-01')
  await detail.getByLabel('To date', { exact: true }).fill('1999-01-01')
  await detail.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(detail.getByText(/No stock movements/)).toBeVisible()
  await expect(pagination).toHaveCount(0)
  await detail.getByLabel('From date', { exact: true }).fill('')
  await detail.getByLabel('To date', { exact: true }).fill('')
  await detail.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(pagination).toContainText('Page 1 of 2')
  const after = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
  expect(after.inventory).toEqual(before.inventory)
  expect(after.movementTotal).toBe(before.movementTotal)
})

test('inventory option, list and detail failures retry without losing adjustment drafts', async ({
  page,
}) => {
  await login(page)
  const stock = await prepareStock(page)
  let failOptions = true
  let releaseOptions: () => void = () => undefined
  const optionsGate = new Promise<void>((resolve) => {
    releaseOptions = resolve
  })
  await page.route('**/api/v1/inventory/options', async (route) => {
    if (failOptions)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Stock options temporarily unavailable.' } }),
      })
    else {
      await optionsGate
      await route.continue()
    }
  })
  await page.goto('/inventory')
  await page.getByRole('button', { name: 'Adjust stock', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Adjust stock', exact: true })
  await form.getByLabel('Quantity', { exact: true }).fill('0.125')
  await form.getByLabel('Reason / note', { exact: true }).fill('Keep this adjustment draft')
  await expect(form.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failOptions = false
  await form.getByRole('button', { name: 'Try again', exact: true }).click()
  await form.getByLabel('Reason / note', { exact: true }).focus()
  releaseOptions()
  await expect(form.getByLabel('Product', { exact: true })).toBeEnabled()
  await expect(form.getByLabel('Reason / note', { exact: true })).toBeFocused()
  await expect(form.getByLabel('Quantity', { exact: true })).toHaveValue('0.125')
  await expect(form.getByLabel('Reason / note', { exact: true })).toHaveValue(
    'Keep this adjustment draft',
  )
  await form.getByLabel('Product', { exact: true }).selectOption(stock.productId)
  await form.getByLabel('Branch', { exact: true }).selectOption(fixtures.branchId)
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.getByLabel('Search Inventory', { exact: true }).fill('no-matching-inventory-fixture')
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible()
  let failDetail = true
  let releaseDetail: () => void = () => undefined
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve
  })
  await page.route(`**/api/v1/inventory/${stock.id}**`, async (route) => {
    if (failDetail) {
      await detailGate
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Stock detail temporarily unavailable.' } }),
      })
    } else await route.continue()
  })
  const detail = await openStockAfterFailure(page, stock)
  try {
    await expect(detail.getByRole('status')).toHaveText('Loading inventory…')
  } finally {
    releaseDetail()
  }
  await expect(detail.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failDetail = false
  const recovered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/inventory/${stock.id}` &&
      response.status() === 200,
  )
  await detail.getByRole('button', { name: 'Try again', exact: true }).click()
  const recoveredDetail = (await (await recovered).json()) as InventoryDetail
  expect(recoveredDetail.inventory).toMatchObject({ id: stock.id, branchId: fixtures.branchId })
  await expect(detail.getByRole('heading', { name: 'Stock movements', exact: true })).toBeVisible()
  await detail.getByRole('button', { name: 'Close dialog', exact: true }).click()
  let failList = true
  await page.route('**/api/v1/inventory?*', (route) =>
    failList
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Inventory temporarily unavailable.' } }),
        })
      : route.continue(),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failList = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Inventory records', exact: true })).toBeVisible()
})

async function openStockAfterFailure(page: Page, stock: StockFixture) {
  await page.goto('/inventory')
  await page.getByLabel('Search Inventory', { exact: true }).fill(stock.name)
  await stockRow(page, stock.name).click()
  return page.getByRole('dialog')
}

test('a committed adjustment survives a lost response and retries exactly once', async ({
  page,
}) => {
  await login(page)
  const stock = await prepareStock(page)
  const before = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
  let attempts = 0
  const submittedKeys: string[] = []
  await page.route('**/api/v1/inventory/adjustments', async (route) => {
    attempts += 1
    const payload = route.request().postDataJSON() as { requestKey: string }
    submittedKeys.push(payload.requestKey)
    if (attempts === 1) {
      const committed = await route.fetch()
      expect(committed.status()).toBe(201)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'The adjustment response was lost. Retry this draft.' },
        }),
      })
    } else await route.continue()
  })
  const detail = await openStock(page, stock)
  await detail.getByRole('button', { name: 'Adjust this stock', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Adjust stock', exact: true })
  await form.getByLabel('Quantity', { exact: true }).fill('0.125')
  await form.getByLabel('Reason / note', { exact: true }).fill('Single committed stock receipt')
  expect((await saveAdjustment(page, form)).status()).toBe(503)
  await expect(form.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(form.getByLabel('Quantity', { exact: true })).toHaveValue('0.125')
  expect((await saveAdjustment(page, form)).status()).toBe(201)
  await expect(form).toBeHidden()
  expect(submittedKeys).toHaveLength(2)
  expect(submittedKeys[0]).toMatch(/^[a-f\d-]{36}$/i)
  expect(submittedKeys[1]).toBe(submittedKeys[0])
  const after = await api<InventoryDetail>(page.request, `/inventory/${stock.id}`)
  expect(after.inventory.quantity).toBe('10.250')
  expect(after.movementTotal).toBe(before.movementTotal + 1)
  expect(
    after.movements.filter((movement) => movement.note === 'Single committed stock receipt'),
  ).toHaveLength(1)
})

test('inventory CSV exports the filtered page with safe spreadsheet cells', async ({
  page,
}, testInfo) => {
  await login(page)
  const stock = await prepareStock(page, '=SUM(1,2) Inventory')
  await page.goto('/inventory')
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname.endsWith('/inventory') &&
      url.searchParams.get('search') === stock.name &&
      response.request().method() === 'GET'
    )
  })
  await page.getByLabel('Search Inventory', { exact: true }).fill(stock.name)
  await expect(page.getByRole('button', { name: 'Export page', exact: true })).toBeDisabled()
  const response = await filtered
  expect(response.status()).toBe(200)
  const results = (await response.json()) as InventoryList
  expect(results.total).toBe(2)
  expect(results.data.map((row) => row.id).sort()).toEqual([stock.id, stock.otherId].sort())
  await expect(
    page.getByRole('table', { name: 'Inventory records', exact: true }).locator('tbody tr'),
  ).toHaveCount(2)
  await expect(stockRow(page, stock.name)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export page', exact: true })).toBeEnabled()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export page', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('inventory.csv')
  const path = testInfo.outputPath('inventory.csv')
  await download.saveAs(path)
  const csv = await readFile(path, 'utf8')
  expect(csv).toContain(`"'${stock.name}"`)
  for (const label of ['On hand', 'Reserved', 'Available', 'Reorder point'])
    expect(csv).toContain(`"${label}"`)
  expect(csv).toContain('10.125 kg')
  expect(csv).not.toContain('Acceptance material')
  expect(csv.split('\r\n')).toHaveLength(3)
})
