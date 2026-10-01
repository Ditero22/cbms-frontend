import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'
import { paymentProof, recordPaymentWithProof } from './helpers/payment-proof'
import { toMinorUnits } from '../../src/features/modules/order-decimals'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  customerId: string
  productId: string
  legacyOrderId: string
  legacyDeliveryId: string
}
type Order = {
  id: string
  orderNumber: string
  status: string
  payableAmount: string
  paidAmount: string
  balance: string
  items: { id: string; cancelledQuantity: string; returnedQuantity: string }[]
  payments: { id: string; amount: string }[]
  refunds: { id: string; amount: string; status: string }[]
  returns: { id: string; status: string }[]
  history: unknown[]
  lifecycle: { requiresLegacyDeliveryReconciliation: boolean }
}

async function login(page: Page, viewer = false) {
  await page.goto('/login')
  await page
    .getByLabel('Work email')
    .fill(viewer ? 'viewer@example.invalid' : 'administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(process.env.CBMS_E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
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
  return response.json() as Promise<T>
}

async function createOrder(request: APIRequestContext, quantity = 2) {
  return api<Order>(request, '/orders', 'POST', {
    customerId: fixtures.customerId,
    branchId: fixtures.branchId,
    items: [{ productId: fixtures.productId, quantity }],
  })
}

async function prepareDeliveredOrder(page: Page, quantity = 2) {
  const order = await createOrder(page.request, quantity)
  const detail = await api<Order>(page.request, `/orders/${order.id}`)
  await api(page.request, '/payments', 'POST', {
    orderId: order.id,
    amount: String(quantity * 10),
    method: 'Cash',
  })
  const delivery = await api<{ id: string }>(page.request, '/deliveries', 'POST', {
    orderId: order.id,
    destination: 'Acceptance construction site',
    items: [{ orderItemId: detail.items[0].id, quantity: String(quantity) }],
  })
  for (const status of ['In Transit', 'Delivered']) {
    await api(page.request, `/deliveries/${delivery.id}/status`, 'PATCH', { status })
  }
  return { order, delivery }
}

async function openOrder(page: Page, order: Pick<Order, 'orderNumber'>) {
  await page.goto('/orders')
  await page.getByLabel('Search Orders', { exact: true }).fill(order.orderNumber)
  await tableRecordControl(page, order.orderNumber).click()
  const dialog = page.getByRole('dialog', { name: order.orderNumber, exact: true })
  await expect(dialog.getByRole('heading', { name: 'Order items', exact: true })).toBeVisible()
  return dialog
}

async function checkDialogBounds(page: Page, dialog: Locator) {
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const bounds = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(-1)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(bounds!.y).toBeGreaterThanOrEqual(-1)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
}

async function submitAndClose(page: Page, dialog: Locator, button: string) {
  await dialog.getByRole('button', { name: button, exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('dialog').last()).toBeVisible()
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`order page, navigation, and form fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    if (width <= 900) {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      const drawer = page.getByRole('dialog', { name: 'Main navigation' })
      await expect(
        drawer.getByText('Acceptance administrator', { exact: true }).first(),
      ).toBeVisible()
      await expect(drawer.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
      await checkDialogBounds(page, drawer)
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
      await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`) })
      await drawer.getByRole('link', { name: 'Orders', exact: true }).click()
      await expect(drawer).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
    } else {
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
      const link = page
        .locator('#desktop-navigation')
        .getByRole('link', { name: 'Orders', exact: true })
      await link.hover()
      await expect(page.getByRole('tooltip')).toHaveText('Orders')
      await link.focus()
      await expect(page.getByRole('tooltip')).toHaveText('Orders')
      await link.click()
    }
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible()
    const create = page.getByRole('button', { name: 'Create order', exact: true })
    await expect(create).toHaveCount(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`orders-${width}.png`), fullPage: true })
    await create.click()
    const form = page.getByRole('dialog', { name: 'Create order', exact: true })
    await expect(form.getByLabel(/^Customer/)).toBeEnabled()
    await checkDialogBounds(page, form)
    await page.screenshot({ path: testInfo.outputPath(`order-form-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(form).not.toBeVisible()
    await expect(create).toBeFocused()
  })
}

for (const width of [390, 768, 1440]) {
  test(`place, pay, deliver, and complete an order through the UI at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await page.goto('/orders')
    await page.getByRole('button', { name: 'Create order', exact: true }).click()
    const create = page.getByRole('dialog', { name: 'Create order', exact: true })
    await create.getByLabel(/^Customer/).selectOption(fixtures.customerId)
    await create.getByLabel(/^Branch/).selectOption(fixtures.branchId)
    await create.getByLabel(/^Product/).selectOption(fixtures.productId)
    await create.getByLabel(/^Quantity/).fill('2')
    const placed = page.waitForResponse(
      (response) => response.url() === `${apiUrl}/orders` && response.request().method() === 'POST',
    )
    await create.getByRole('button', { name: 'Create order', exact: true }).click()
    const placedResponse = await placed
    expect(placedResponse.status()).toBe(201)
    const order = (await placedResponse.json()) as Order
    await expect(create).not.toBeVisible()

    await page.goto('/payments')
    await page.getByRole('button', { name: 'Record payment', exact: true }).click()
    const payment = page.getByRole('dialog', { name: 'Record customer payment', exact: true })
    await payment.getByLabel(/^Receipt \/ payment proof/).setInputFiles(paymentProof)
    await payment.getByLabel(/^Order/).selectOption(order.id)
    await payment.getByLabel(/^Amount/).fill('20.00')
    await payment.getByLabel(/^Method/).selectOption('Cash')
    await payment.getByRole('button', { name: 'Record payment', exact: true }).click()
    await expect(payment).not.toBeVisible()

    await page.goto('/deliveries')
    await page.getByRole('button', { name: 'Schedule delivery', exact: true }).click()
    const schedule = page.getByRole('dialog', { name: 'Schedule delivery', exact: true })
    await schedule.getByLabel(/^Order/).selectOption(order.id)
    await schedule.getByRole('checkbox').check()
    await schedule.getByRole('spinbutton').fill('2.000')
    await schedule.getByLabel(/^Destination/).fill('Acceptance construction site')
    const scheduled = page.waitForResponse(
      (response) =>
        response.url() === `${apiUrl}/deliveries` && response.request().method() === 'POST',
    )
    await schedule.getByRole('button', { name: 'Schedule delivery', exact: true }).click()
    const scheduledResponse = await scheduled
    expect(scheduledResponse.status()).toBe(201)
    const delivery = (await scheduledResponse.json()) as { id: string; reference: string }
    await expect(schedule).not.toBeVisible()
    for (const status of ['In Transit', 'Delivered']) {
      await page.getByLabel('Search Deliveries', { exact: true }).fill(delivery.reference)
      await tableRecordControl(page, delivery.reference).click()
      const deliveryDetail = page.getByRole('dialog', { name: delivery.reference, exact: true })
      await expect(
        deliveryDetail.getByRole('heading', { name: 'Order and destination' }),
      ).toBeVisible()
      await expect(
        deliveryDetail.getByText('Acceptance construction site', { exact: true }),
      ).toBeVisible()
      await expect(deliveryDetail.getByRole('heading', { name: 'Delivery items' })).toBeVisible()
      await expect(deliveryDetail.getByText('Acceptance material', { exact: true })).toBeVisible()
      await expect(deliveryDetail.getByRole('heading', { name: 'Record history' })).toBeVisible()
      await checkDialogBounds(page, deliveryDetail)
      await page
        .getByRole('dialog', { name: delivery.reference, exact: true })
        .getByRole('button', { name: 'Update status', exact: true })
        .click()
      const update = page.getByRole('dialog', { name: 'Update delivery status', exact: true })
      await update.getByLabel(/^New status/).selectOption(status)
      await update.getByRole('button', { name: 'Save status', exact: true }).click()
      await expect(update).not.toBeVisible()
    }
    const detail = await openOrder(page, order)
    await detail.getByRole('button', { name: 'Complete order', exact: true }).click()
    const completion = page.getByRole('dialog', { name: 'Complete order', exact: true })
    await checkDialogBounds(page, completion)
    await submitAndClose(page, completion, 'Complete order')
    await expect(detail.getByText('Completed', { exact: true })).toBeVisible()
    const final = await api<Order>(page.request, `/orders/${order.id}`)
    expect(final).toMatchObject({
      status: 'Completed',
      payableAmount: '20.00',
      paidAmount: '20.00',
      balance: '0.00',
    })
  })

  test(`return, refund, and cancel a paid delivered quantity at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const { order, delivery } = await prepareDeliveredOrder(page)
    const detail = await openOrder(page, order)
    await expect(
      detail.getByRole('button', { name: 'Cancel quantities', exact: true }),
    ).toHaveCount(0)
    await detail.getByRole('button', { name: 'Request return', exact: true }).click()
    const returns = page.getByRole('dialog', { name: 'Request item return', exact: true })
    await returns.getByLabel(/^Delivery/).selectOption(delivery.id)
    await returns
      .getByLabel('Quantity to return for Acceptance material', { exact: true })
      .fill('1.000')
    await returns.getByLabel(/^Reason/).fill('Customer returned unused material')
    await checkDialogBounds(page, returns)
    await page.screenshot({ path: testInfo.outputPath(`return-form-${width}.png`) })
    await submitAndClose(page, returns, 'Submit return request')
    const returnHistory = detail
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Returns', exact: true }) })
    await returnHistory.getByRole('button', { name: 'Approve', exact: true }).click()
    await returnHistory.getByRole('button', { name: 'Receive items', exact: true }).click()
    const receive = page.getByRole('dialog', { name: 'Receive returned items', exact: true })
    await receive.getByLabel(/^Condition/).selectOption('Resalable')
    await receive.getByLabel('Accepted qty', { exact: true }).fill('1.000')
    await submitAndClose(page, receive, 'Receive return')

    await detail.getByRole('button', { name: 'Request refund', exact: true }).click()
    const refund = page.getByRole('dialog', { name: 'Request payment refund', exact: true })
    const paid = await api<Order>(page.request, `/orders/${order.id}`)
    await refund.getByLabel(/^Payment/).selectOption(paid.payments[0].id)
    await refund.getByLabel(/^Amount/).fill('10.00')
    await refund.getByLabel(/^Reason/).fill('Refund for returned quantity')
    await checkDialogBounds(page, refund)
    await page.screenshot({ path: testInfo.outputPath(`refund-form-${width}.png`) })
    await submitAndClose(page, refund, 'Submit refund request')
    const refundHistory = detail
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Refunds', exact: true }) })
    await refundHistory.getByRole('button', { name: 'Approve', exact: true }).click()
    await refundHistory.getByRole('button', { name: 'Mark processed', exact: true }).click()
    await expect(refundHistory.getByText('Processed', { exact: true })).toBeVisible()

    await detail.getByRole('button', { name: 'Cancel quantities', exact: true }).click()
    const cancellation = page.getByRole('dialog', { name: 'Cancel order quantities', exact: true })
    await cancellation
      .getByLabel('Quantity to cancel for Acceptance material', { exact: true })
      .fill('1.000')
    await submitAndClose(page, cancellation, 'Cancel selected quantities')
    await detail.getByRole('button', { name: 'Complete order', exact: true }).click()
    await submitAndClose(
      page,
      page.getByRole('dialog', { name: 'Complete order', exact: true }),
      'Complete order',
    )
    const final = await api<Order>(page.request, `/orders/${order.id}`)
    expect(final).toMatchObject({
      status: 'Completed',
      payableAmount: '10.00',
      paidAmount: '10.00',
      balance: '0.00',
    })
    expect(final.payments[0].amount).toBe('20.00')
    expect(final.items[0]).toMatchObject({ cancelledQuantity: '1.000', returnedQuantity: '1.000' })
    expect(final.refunds).toHaveLength(1)
    expect(final.returns).toHaveLength(1)
  })
}

test('read-only users see order details without action buttons or audit history', async ({
  page,
  request,
}) => {
  await api(request, '/auth/login', 'POST', {
    email: 'administrator@example.invalid',
    password: process.env.CBMS_E2E_PASSWORD,
  })
  const order = await createOrder(request)
  await login(page, true)
  await page.goto('/orders')
  await expect(page.getByRole('button', { name: 'Create order', exact: true })).toHaveCount(0)
  const detail = await openOrder(page, order)
  for (const name of ['Complete order', 'Cancel quantities', 'Request refund', 'Request return']) {
    await expect(detail.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expect(detail.getByRole('heading', { name: 'Audit history', exact: true })).toHaveCount(0)
  const data = await api<Order>(page.request, `/orders/${order.id}`)
  expect(data.history).toEqual([])
})

test('order detail shows loading and retryable errors; filters have an empty state', async ({
  page,
}) => {
  await login(page)
  const order = await createOrder(page.request)
  await page.goto('/orders')
  await page.getByLabel('Search Orders', { exact: true }).fill('there-is-no-such-order')
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible()
  await page.getByLabel('Search Orders', { exact: true }).fill(order.orderNumber)
  let release: () => void = () => undefined
  const held = new Promise<void>((resolveHeld) => {
    release = resolveHeld
  })
  await page.route(`${apiUrl}/orders/${order.id}`, async (route) => {
    await held
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Acceptance service temporarily unavailable' } }),
    })
  })
  await tableRecordControl(page, order.orderNumber).click()
  const detail = page.getByRole('dialog', { name: 'Order details', exact: true })
  await expect(detail.getByRole('status')).toHaveText('Loading order details…')
  release()
  await expect(detail.getByRole('alert')).toContainText('Could not load this order.')
  await page.unroute(`${apiUrl}/orders/${order.id}`)
  await detail.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(
    page
      .getByRole('dialog', { name: order.orderNumber, exact: true })
      .getByRole('heading', { name: 'Order items', exact: true }),
  ).toBeVisible()
})

for (const workflow of ['refund', 'return'] as const) {
  test(`an ambiguous ${workflow} response can be retried without creating another request`, async ({
    page,
  }) => {
    await login(page)
    const { order, delivery } = await prepareDeliveredOrder(page)
    const detail = await openOrder(page, order)
    const collection = workflow === 'refund' ? 'refunds' : 'returns'
    const path = `${apiUrl}/orders/${order.id}/${collection}`
    const keys: string[] = []
    await page.route(path, async (route) => {
      keys.push(route.request().postDataJSON().requestKey as string)
      if (keys.length === 1) {
        const saved = await route.fetch()
        expect(saved.status()).toBe(201)
        await route.abort('failed')
      } else {
        await route.continue()
      }
    })
    await detail
      .getByRole('button', {
        name: workflow === 'refund' ? 'Request refund' : 'Request return',
        exact: true,
      })
      .click()
    const form = page.getByRole('dialog', {
      name: workflow === 'refund' ? 'Request payment refund' : 'Request item return',
      exact: true,
    })
    if (workflow === 'refund') {
      const data = await api<Order>(page.request, `/orders/${order.id}`)
      await form.getByLabel(/^Payment/).selectOption(data.payments[0].id)
      await form.getByLabel(/^Amount/).fill('5.00')
    } else {
      await form.getByLabel(/^Delivery/).selectOption(delivery.id)
      await form
        .getByLabel('Quantity to return for Acceptance material', { exact: true })
        .fill('0.500')
    }
    await form.getByLabel(/^Reason/).fill('Acceptance retry after lost response')
    const submit = workflow === 'refund' ? 'Submit refund request' : 'Submit return request'
    await form.getByRole('button', { name: submit, exact: true }).click()
    await expect(
      page.getByText('The backend could not be reached. Check your connection and try again.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(form.getByRole('button', { name: submit, exact: true })).toBeEnabled()
    await submitAndClose(page, form, submit)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    const updated = await api<Order>(page.request, `/orders/${order.id}`)
    expect(updated[collection]).toHaveLength(1)
  })
}

test('legacy delivery quantities require audited verification before cancellation becomes available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await login(page)
  const order = await api<Order>(page.request, `/orders/${fixtures.legacyOrderId}`)
  expect(order.lifecycle.requiresLegacyDeliveryReconciliation).toBe(true)
  const stockBefore = await api(page.request, '/inventory?search=QA-LEGACY')
  const detail = await openOrder(page, order)
  await expect(detail.getByRole('button', { name: 'Request return', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Cancel quantities', exact: true })).toHaveCount(
    0,
  )
  await detail.getByRole('button', { name: 'Verify legacy deliveries', exact: true }).click()
  const verify = page.getByRole('dialog', {
    name: 'Verify legacy delivery quantities',
    exact: true,
  })
  await verify.getByLabel(/^Historical delivery/).selectOption(fixtures.legacyDeliveryId)
  await verify
    .getByLabel('Delivered quantity for Acceptance legacy material', { exact: true })
    .fill('1.000')
  await verify
    .getByLabel(/^Verification note/)
    .fill('Checked original signed delivery document: one piece delivered.')
  await checkDialogBounds(page, verify)
  await verify.getByRole('button', { name: 'Confirm delivery quantities', exact: true }).click()
  await expect(verify).not.toBeVisible()
  await expect(
    detail.getByRole('button', { name: 'Verify legacy deliveries', exact: true }),
  ).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Cancel quantities', exact: true })).toBeVisible()
  const verified = await api<Order>(page.request, `/orders/${order.id}`)
  expect(verified.lifecycle.requiresLegacyDeliveryReconciliation).toBe(false)
  expect(await api(page.request, '/inventory?search=QA-LEGACY')).toEqual(stockBefore)
})

test('mixed-condition receipt classifies all returned goods and restocks only resalable quantities', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await login(page)
  const { order, delivery } = await prepareDeliveredOrder(page, 10)
  type Stock = { data: { 'On hand': string }[] }
  const stockBefore = await api<Stock>(page.request, '/inventory?search=QA-MATERIAL')
  const detail = await openOrder(page, order)
  await detail.getByRole('button', { name: 'Request return', exact: true }).click()
  const returns = page.getByRole('dialog', { name: 'Request item return', exact: true })
  await returns.getByLabel(/^Delivery/).selectOption(delivery.id)
  await returns
    .getByLabel('Quantity to return for Acceptance material', { exact: true })
    .fill('10.000')
  await returns
    .getByLabel(/^Reason/)
    .fill('Ten returned pieces include seven good and three damaged')
  await submitAndClose(page, returns, 'Submit return request')
  const history = detail
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Returns', exact: true }) })
  await history.getByRole('button', { name: 'Approve', exact: true }).click()
  await history.getByRole('button', { name: 'Receive items', exact: true }).click()
  const receive = page.getByRole('dialog', { name: 'Receive returned items', exact: true })
  await receive.getByLabel('Accepted qty', { exact: true }).fill('7.000')
  const remainder = receive.getByLabel('Condition of remaining quantity for Acceptance material', {
    exact: true,
  })
  await expect(remainder).toBeVisible()
  await expect(remainder).toHaveAttribute('required', '')
  await receive.getByRole('button', { name: 'Receive return', exact: true }).click()
  await expect(receive).toBeVisible()
  await remainder.selectOption('Damaged')
  await checkDialogBounds(page, receive)
  await page.screenshot({ path: testInfo.outputPath('mixed-return-receipt-390.png') })
  await submitAndClose(page, receive, 'Receive return')
  await expect(history).toContainText('7.000 restocked · 3.000 damaged, not restocked')
  const updated = await api<Order>(page.request, `/orders/${order.id}`)
  expect(updated.status).toBe('Processing')
  expect(updated.returns).toMatchObject([
    { status: 'Received', items: [{ acceptedQuantity: '7.000', remainderCondition: 'Damaged' }] },
  ])
  const stockAfter = await api<Stock>(page.request, '/inventory?search=QA-MATERIAL')
  const before = toMinorUnits(stockBefore.data[0]['On hand'].split(' ')[0], 3)
  const after = toMinorUnits(stockAfter.data[0]['On hand'].split(' ')[0], 3)
  expect(after - before).toBe(7000n)
})
