import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const password = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  customerId: string
  productId: string
}

type Order = { id: string; orderNumber: string; totalAmount: string; itemCount: number }
type InventoryList = { data: { id: string; productId: string; branchId: string }[] }
type InventoryDetail = {
  inventory: { quantity: string; reservedQuantity: string; availableQuantity: string }
  movements: { referenceId: string | null; transactionType: string; quantityDelta: string }[]
}
type OrderDetail = { id: string; items: { quantity: string }[] }

test.beforeAll(() => {
  expect(password.length, 'Use the disposable browser-test runner.').toBeGreaterThanOrEqual(12)
  expect(fixtures.branchId).toMatch(/^[a-f\d-]{36}$/i)
  expect(fixtures.customerId).toMatch(/^[a-f\d-]{36}$/i)
  expect(fixtures.productId).toMatch(/^[a-f\d-]{36}$/i)
})

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function api<T>(request: APIRequestContext, path: string) {
  const response = await request.get(`${apiUrl}${path}`)
  expect(response.ok(), `GET ${path}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function getInventory(page: Page) {
  const list = await api<InventoryList>(page.request, '/inventory?search=QA-MATERIAL&limit=100')
  const stock = list.data.find(
    (record) => record.productId === fixtures.productId && record.branchId === fixtures.branchId,
  )
  expect(stock).toBeDefined()
  return api<InventoryDetail>(page.request, `/inventory/${stock!.id}`)
}

async function interceptCommittedResponse(page: Page) {
  const requestKeys: string[] = []
  const committedOrders: Order[] = []
  await page.route(`${apiUrl}/orders`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const body = route.request().postDataJSON() as { requestKey: string }
    requestKeys.push(body.requestKey)
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    committedOrders.push((await response.json()) as Order)
    if (requestKeys.length === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'RESPONSE_LOST',
            message: 'The save response was interrupted. Retry the unchanged order.',
          },
        }),
      })
    }
    return route.fulfill({ response })
  })
  return { requestKeys, committedOrders }
}

for (const width of [390, 768, 1440]) {
  test(`an unchanged committed order retry reserves stock once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const before = await getInventory(page)

    await page.goto('/orders')
    await page.getByRole('button', { name: 'Create order', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create order', exact: true })
    await dialog.getByLabel(/^Customer/).selectOption(fixtures.customerId)
    await dialog.getByLabel(/^Branch/).selectOption(fixtures.branchId)
    await dialog.getByLabel(/^Product/).selectOption(fixtures.productId)
    await dialog.getByLabel(/^Quantity/).fill('1.125')
    const interception = await interceptCommittedResponse(page)

    await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'The service is temporarily unavailable. Please try again shortly.',
    )
    await expect(dialog.getByLabel(/^Quantity/)).toHaveValue('1.125')
    const afterFirstCommit = await getInventory(page)
    expect(afterFirstCommit.inventory.reservedQuantity).toBe(
      (Number(before.inventory.reservedQuantity) + 1.125).toFixed(3),
    )
    expect(
      afterFirstCommit.movements.filter(
        (movement) =>
          movement.referenceId === interception.committedOrders[0]?.id &&
          movement.transactionType === 'RESERVATION_CREATED',
      ),
    ).toHaveLength(1)

    await dialog.getByLabel(/^Quantity/).fill('01.125')
    await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
    await expect(dialog).toBeHidden()
    expect(interception.requestKeys).toHaveLength(2)
    expect(interception.requestKeys[0]).toMatch(/^[a-f\d-]{36}$/i)
    expect(interception.requestKeys[1]).toBe(interception.requestKeys[0])
    expect(interception.committedOrders[1]).toEqual(interception.committedOrders[0])

    const afterRetry = await getInventory(page)
    expect(afterRetry.inventory.reservedQuantity).toBe(afterFirstCommit.inventory.reservedQuantity)
    expect(
      afterRetry.movements.filter(
        (movement) =>
          movement.referenceId === interception.committedOrders[0]?.id &&
          movement.transactionType === 'RESERVATION_CREATED',
      ),
    ).toHaveLength(1)
    const detail = await api<OrderDetail>(
      page.request,
      `/orders/${interception.committedOrders[0]!.id}`,
    )
    expect(detail).toMatchObject({
      id: interception.committedOrders[0]!.id,
      items: [{ quantity: '1.125' }],
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
  })
}

test('changing an interrupted order creates a new request identity', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await login(page)
  const before = await getInventory(page)
  await page.goto('/orders')
  await page.getByRole('button', { name: 'Create order', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create order', exact: true })
  await dialog.getByLabel(/^Customer/).selectOption(fixtures.customerId)
  await dialog.getByLabel(/^Branch/).selectOption(fixtures.branchId)
  await dialog.getByLabel(/^Product/).selectOption(fixtures.productId)
  await dialog.getByLabel(/^Quantity/).fill('1.000')
  const interception = await interceptCommittedResponse(page)

  await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await dialog.getByLabel(/^Quantity/).fill('2.000')
  await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
  await expect(dialog).toBeHidden()

  expect(interception.requestKeys).toHaveLength(2)
  expect(interception.requestKeys[1]).not.toBe(interception.requestKeys[0])
  expect(interception.committedOrders[1]?.id).not.toBe(interception.committedOrders[0]?.id)
  const after = await getInventory(page)
  expect(after.inventory.reservedQuantity).toBe(
    (Number(before.inventory.reservedQuantity) + 3).toFixed(3),
  )
  for (const order of interception.committedOrders) {
    expect(
      after.movements.filter(
        (movement) =>
          movement.referenceId === order.id && movement.transactionType === 'RESERVATION_CREATED',
      ),
    ).toHaveLength(1)
  }
})
