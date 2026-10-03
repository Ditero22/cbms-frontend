import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

// Direct fixture API mutations follow the same allowed-origin policy as browser requests.
test.use({
  extraHTTPHeaders: {
    Origin: new URL(process.env.CBMS_E2E_BASE_URL ?? 'http://127.0.0.1:5180').origin,
  },
})

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  customerId: string
  productId: string
  legacyAllowancePendingId: string
}
type Vehicle = {
  vehicle: {
    id: string
    status: string
    capacityValue: string
    capacityUnit: string
    odometer: string
  }
  assignments: { id: string; status: string }[]
  currentMaintenance: { id: string; problemReported: string; totalCost: string } | null
  totalMaintenanceCost: string
  history: { action: string }[]
}
type Allowance = {
  allowance: {
    id: string
    reference: string
    status: string
    expenseId: string | null
    acknowledgement: string | null
    workerName: string
  }
  history: { action: string }[]
}
type Order = {
  id: string
  orderNumber: string
  items: { id: string; deliveredQuantity: string }[]
  stockMovements: unknown[]
}
const receipt = {
  name: 'receipt.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8n8AAAAASUVORK5CYII=',
    'base64',
  ),
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
async function api<T>(
  request: APIRequestContext,
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
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
async function prepareFleet(page: Page, suffix: string) {
  const name = `Fleet driver ${suffix}`,
    vehicleName = `Water truck ${suffix}`
  const driver = await api<{ id: string }>(page.request, '/employees', 'POST', {
    employeeNumber: `QA-D-${suffix}`,
    name,
    position: 'Truck Driver',
    branchId: fixtures.branchId,
    isDriver: true,
    licenseNumber: `LIC-${suffix}`,
    licenseClassification: 'Professional',
    licenseExpiresOn: '2035-12-31',
    driverAvailability: 'Available',
  })
  const vehicle = await api<{ id: string }>(page.request, '/vehicles', 'POST', {
    branchId: fixtures.branchId,
    name: vehicleName,
    plateNumber: `QA-${suffix}`,
    vehicleType: 'Water Truck',
    capacityValue: '5000',
    capacityUnit: 'L',
    defaultDriverId: driver.id,
    odometer: '1000',
  })
  const allowance = { id: fixtures.legacyAllowancePendingId }
  const detail = await api<Allowance>(page.request, `/driver-allowances/${allowance.id}`)
  return { driver, vehicle, allowance, name, vehicleName, reference: detail.allowance.reference }
}
async function openVehicle(page: Page, name: string) {
  await page.goto('/vehicles')
  await page.getByLabel('Search Vehicles', { exact: true }).fill(name)
  await tableRecordControl(page, name).click()
  const dialog = page.getByRole('dialog', { name, exact: true })
  await expect(dialog.getByText('Maintenance & Repair Expenses', { exact: true })).toBeVisible()
  return dialog
}
async function openAllowance(page: Page, reference: string) {
  await page.goto('/payroll?view=legacy')
  await page.getByLabel('Search Legacy allowances', { exact: true }).fill(reference)
  await tableRecordControl(page, reference).click()
  const dialog = page.getByRole('dialog', { name: reference, exact: true })
  await expect(dialog.getByText('Allowance amount', { exact: true })).toBeVisible()
  return dialog
}
async function uploadReceipt(dialog: Locator) {
  await dialog.getByLabel('Attach proof', { exact: true }).setInputFiles(receipt)
  await dialog.getByRole('button', { name: 'Upload proof', exact: true }).click()
  await expect(dialog.getByText('receipt.png', { exact: true })).toBeVisible()
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`fleet and allowance lists, forms, and details fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const data = await prepareFleet(page, `${width}-${Date.now().toString(36)}`)
    await page.goto('/vehicles')
    await page.getByLabel('Search Vehicles', { exact: true }).fill(data.vehicleName)
    await expect(page.getByRole('button', { name: 'Add vehicle', exact: true })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (width <= 800) {
      await expect(page.getByRole('table', { name: 'Vehicles records', exact: true })).toBeHidden()
      const card = tableRecordControl(page, data.vehicleName)
      await expect(card).toContainText('5,000 L')
      await expect(card).toContainText('Available')
    }
    await page.screenshot({ path: testInfo.outputPath(`fleet-list-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Add vehicle', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: 'Add vehicle', exact: true })
    await expect(dialog.getByLabel('Default driver', { exact: true })).toBeEnabled()
    await bounds(page, dialog)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    dialog = await openVehicle(page, data.vehicleName)
    await bounds(page, dialog)
    await dialog.getByRole('button', { name: 'Schedule maintenance', exact: true }).click()
    let form = page.getByRole('dialog', { name: 'Schedule maintenance', exact: true })
    await expect(form.getByLabel('Expense branch', { exact: true })).toBeEnabled()
    await bounds(page, form)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page
      .getByRole('dialog', { name: data.vehicleName, exact: true })
      .getByRole('button', { name: 'New assignment', exact: true })
      .click()
    form = page.getByRole('dialog', { name: 'Assign driver and vehicle', exact: true })
    await expect(form.getByLabel('Driver / employee', { exact: true })).toBeEnabled()
    await bounds(page, form)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.goto('/payroll?view=legacy')
    await page.getByLabel('Search Legacy allowances', { exact: true }).fill(data.reference)
    await expect(page.getByRole('button', { name: 'Record allowance', exact: true })).toHaveCount(0)
    if (width <= 800)
      await expect(tableRecordControl(page, data.reference)).toContainText('₱1,500.00')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    dialog = await openAllowance(page, data.reference)
    await bounds(page, dialog)
    await page.screenshot({ path: testInfo.outputPath(`allowance-detail-${width}.png`) })
  })
}

test('driver, delivery, maintenance expense, receipt, and allowance lifecycle remain connected', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await login(page)
  const suffix = Date.now().toString(36),
    driverName = `Workflow driver ${suffix}`,
    vehicleName = `Workflow water truck ${suffix}`
  await page.goto('/employees')
  await page.getByRole('button', { name: 'Add employee', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Add employee', exact: true })
  await dialog.getByRole('textbox', { name: 'Employee ID', exact: true }).fill(`QA-${suffix}`)
  await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill(driverName)
  await dialog.getByRole('textbox', { name: 'Position', exact: true }).fill('Truck Driver')
  await dialog
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption(fixtures.branchId)
  await dialog.getByRole('checkbox', { name: /This employee can work as a driver/ }).check()
  await dialog.getByLabel('License number', { exact: true }).fill(`LIC-${suffix}`)
  await dialog.getByLabel('License expiration', { exact: true }).fill('2035-12-31')
  const employeeResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/employees` && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Create employee', exact: true }).click()
  const driver = (await (await employeeResponse).json()) as { id: string }
  await expect(dialog).not.toBeVisible()
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Add vehicle', exact: true })
  await dialog
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption(fixtures.branchId)
  await dialog.getByLabel('Vehicle name', { exact: true }).fill(vehicleName)
  await dialog.getByLabel('Plate number', { exact: true }).fill(`QA-${suffix}`)
  await dialog.getByLabel('Vehicle type', { exact: true }).fill('Water Truck')
  await dialog.getByLabel('Capacity', { exact: true }).fill('5000')
  await dialog.getByLabel('Capacity unit', { exact: true }).fill('L')
  await dialog.getByLabel('Default driver', { exact: true }).selectOption(driver.id)
  await dialog.getByLabel('Current odometer (km)', { exact: true }).fill('1000')
  const vehicleResponse = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/vehicles` && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Add vehicle', exact: true }).click()
  const vehicle = (await (await vehicleResponse).json()) as { id: string }
  await expect(dialog).not.toBeVisible()
  expect((await api<Vehicle>(page.request, `/vehicles/${vehicle.id}`)).vehicle.status).toBe(
    'Available',
  )
  const order = await api<Order>(page.request, '/orders', 'POST', {
    customerId: fixtures.customerId,
    branchId: fixtures.branchId,
    items: [{ productId: fixtures.productId, quantity: '2' }],
  })
  await page.goto('/deliveries')
  await page.getByRole('button', { name: 'Schedule delivery', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Schedule delivery', exact: true })
  await dialog.getByLabel('Order', { exact: true }).selectOption(order.id)
  await dialog.getByRole('checkbox', { name: /Acceptance material/ }).check()
  await dialog.getByLabel('Quantity for Acceptance material', { exact: true }).fill('2')
  await dialog.getByLabel('Destination', { exact: true }).fill(`Workflow site ${suffix}`)
  await dialog.getByLabel('Driver / employee', { exact: true }).selectOption(driver.id)
  await dialog.getByLabel('Vehicle', { exact: true }).selectOption(vehicle.id)
  const deliveryResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/deliveries` && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Schedule delivery', exact: true }).click()
  const delivery = (await (await deliveryResponse).json()) as { id: string }
  await expect(dialog).not.toBeVisible()
  expect((await api<Vehicle>(page.request, `/vehicles/${vehicle.id}`)).vehicle.status).toBe(
    'On Service',
  )
  const rows = await api<{ data: Record<string, string>[] }>(
    page.request,
    `/deliveries?search=${encodeURIComponent(`Workflow site ${suffix}`)}`,
  )
  const deliveryReference = rows.data.find((row) => row.id === delivery.id)!.Delivery
  for (const status of ['In Transit', 'Delivered']) {
    await page.goto('/deliveries')
    await page.getByLabel('Search Deliveries', { exact: true }).fill(deliveryReference)
    await tableRecordControl(page, deliveryReference).click()
    await page
      .getByRole('dialog', { name: deliveryReference, exact: true })
      .getByRole('button', { name: 'Update status', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'Update delivery status', exact: true })
    await dialog.getByLabel('New status', { exact: true }).selectOption(status)
    if (status === 'Delivered')
      await dialog.getByLabel('Ending odometer (km, if tracked)', { exact: true }).fill('1010')
    await dialog.getByRole('button', { name: 'Save status', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  }
  await page.goto('/deliveries')
  await page.getByLabel('Search Deliveries', { exact: true }).fill(deliveryReference)
  await tableRecordControl(page, deliveryReference).click()
  dialog = page.getByRole('dialog', { name: deliveryReference, exact: true })
  await uploadReceipt(dialog)
  await bounds(page, dialog)
  const deliveryProofs = await api<{ items: { id: string }[] }>(
    page.request,
    `/attachments?entityType=delivery&entityId=${delivery.id}`,
  )
  expect(deliveryProofs.items).toHaveLength(1)
  const deliveryProof = await page.request.get(
    `${apiUrl}/attachments/${deliveryProofs.items[0].id}/content`,
  )
  expect(deliveryProof.status()).toBe(200)
  expect(await deliveryProof.body()).toEqual(receipt.buffer)
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  let fleet = await api<Vehicle>(page.request, `/vehicles/${vehicle.id}`)
  expect(fleet.vehicle.status).toBe('Available')
  expect(fleet.assignments[0].status).toBe('Completed')
  const posted = await api<Order>(page.request, `/orders/${order.id}`)
  expect(posted.items[0].deliveredQuantity).toBe('2.000')
  expect(posted.stockMovements.length).toBeGreaterThan(0)
  dialog = await openVehicle(page, vehicleName)
  await dialog.getByRole('button', { name: 'Schedule maintenance', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Schedule maintenance', exact: true })
  await dialog.getByLabel('Expense branch', { exact: true }).selectOption(fixtures.branchId)
  await dialog.getByLabel('Maintenance / repair type', { exact: true }).fill('Oil Change')
  await dialog.getByLabel('Description', { exact: true }).fill('Replace oil and inspect engine')
  await dialog.getByLabel('Problem reported', { exact: true }).fill('Engine oil service needed')
  await dialog
    .getByLabel('Service provider / repair shop', { exact: true })
    .fill('Acceptance repair shop')
  await dialog.getByLabel('Labor cost (PHP)', { exact: true }).fill('100')
  await dialog.getByLabel('Parts cost (PHP)', { exact: true }).fill('200')
  await dialog.getByLabel('Other expenses (PHP)', { exact: true }).fill('50')
  await expect(dialog).toContainText('₱350.00')
  const maintenanceResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/vehicles/${vehicle.id}/maintenance` &&
      response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Schedule maintenance', exact: true }).click()
  const maintenance = (await (await maintenanceResponse).json()) as { id: string }
  await expect(dialog).not.toBeVisible()
  let maintenanceDetail = await api<{
    maintenance: { reference: string; status: string; expenseId: string | null }
    history: { action: string }[]
  }>(page.request, `/vehicle-maintenance/${maintenance.id}`)
  await page
    .getByRole('dialog', { name: vehicleName, exact: true })
    .getByRole('button', { name: /Oil Change/ })
    .click()
  dialog = page.getByRole('dialog', { name: maintenanceDetail.maintenance.reference, exact: true })
  await uploadReceipt(dialog)
  await dialog.getByRole('button', { name: 'Start maintenance', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Start maintenance?', exact: true })
    .getByRole('button', { name: 'Confirm', exact: true })
    .click()
  await expect(dialog.locator('.status-badge')).toHaveText('In Progress')
  const conflict = await page.request.post(`${apiUrl}/vehicle-assignments`, {
    data: {
      vehicleId: vehicle.id,
      driverId: driver.id,
      branchId: fixtures.branchId,
      destination: 'Another job',
      purpose: 'Conflict check',
    },
  })
  expect(conflict.status()).toBe(409)
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  dialog = page.getByRole('dialog', { name: vehicleName, exact: true })
  await expect(dialog.getByRole('button', { name: 'New assignment', exact: true })).toBeDisabled()
  await expect(dialog.getByText('Current maintenance', { exact: true })).toBeVisible()
  await expect(dialog).toContainText('Engine oil service needed')
  await expect(dialog).toContainText('₱350.00')
  await bounds(page, dialog)
  await page.screenshot({ path: testInfo.outputPath('current-maintenance.png') })
  await dialog.getByRole('button', { name: 'Open maintenance record', exact: true }).click()
  dialog = page.getByRole('dialog', { name: maintenanceDetail.maintenance.reference, exact: true })
  await dialog.getByRole('button', { name: 'Complete maintenance', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Complete this maintenance record?', exact: true })
    .getByRole('button', { name: 'Confirm', exact: true })
    .click()
  await expect(dialog.locator('.status-badge')).toHaveText('Completed')
  fleet = await api<Vehicle>(page.request, `/vehicles/${vehicle.id}`)
  expect(fleet.vehicle.status).toBe('Available')
  expect(fleet.totalMaintenanceCost).toBe('350.00')
  maintenanceDetail = await api(page.request, `/vehicle-maintenance/${maintenance.id}`)
  expect(maintenanceDetail.maintenance.expenseId).toBeTruthy()
  expect(maintenanceDetail.history.some((entry) => entry.action === 'complete maintenance')).toBe(
    true,
  )
  const allowance = { id: fixtures.legacyAllowancePendingId }
  let financial = await api<Allowance>(page.request, `/driver-allowances/${allowance.id}`)
  dialog = await openAllowance(page, financial.allowance.reference)
  await dialog.getByRole('button', { name: 'Approve allowance', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Approve this driver allowance?', exact: true })
    .getByRole('button', { name: 'Confirm', exact: true })
    .click()
  await expect(dialog.locator('.status-badge')).toHaveText('Approved')
  await dialog.getByRole('button', { name: 'Release payment', exact: true }).click()
  const release = page.getByRole('dialog', {
    name: `Release ₱1,500.00 allowance to ${financial.allowance.workerName}?`,
    exact: true,
  })
  await release.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog.locator('.status-badge')).toHaveText('Released')
  await uploadReceipt(dialog)
  await dialog.getByRole('button', { name: 'Confirm receipt', exact: true }).click()
  const received = page.getByRole('dialog', {
    name: `Confirm that ${financial.allowance.workerName} received ₱1,500.00?`,
    exact: true,
  })
  await received.getByRole('button', { name: 'Confirm receipt', exact: true }).click()
  await expect(received.getByRole('alert')).toContainText('Choose receipt proof')
  await received.getByLabel('Receipt proof', { exact: true }).selectOption({ label: 'receipt.png' })
  await received.getByRole('button', { name: 'Confirm receipt', exact: true }).click()
  await expect(received).not.toBeVisible()
  await expect(dialog.locator('.status-badge')).toHaveText('Received')
  financial = await api<Allowance>(page.request, `/driver-allowances/${allowance.id}`)
  expect(financial.allowance.expenseId).toBeTruthy()
  expect(financial.history.some((entry) => entry.action === 'receive driver allowance')).toBe(true)
  await expect(dialog.getByRole('button', { name: 'Edit allowance', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancel allowance', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('allowance-received.png') })
})

test('fleet option retry preserves input and financial permissions are enforced', async ({
  page,
}) => {
  await login(page)
  const data = await prepareFleet(page, `retry-${Date.now().toString(36)}`)
  let failOptions = true
  await page.route('**/api/v1/vehicles/options', (route) =>
    failOptions
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Fleet choices temporarily unavailable.' } }),
        })
      : route.continue(),
  )
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add vehicle', exact: true })
  await dialog.getByLabel('Vehicle name', { exact: true }).fill('Keep this vehicle draft')
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  failOptions = false
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(
    dialog.getByLabel('Default driver', { exact: true }).locator('option', { hasText: data.name }),
  ).toHaveCount(1)
  await expect(dialog.getByLabel('Vehicle name', { exact: true })).toHaveValue(
    'Keep this vehicle draft',
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  const vehicleDetail = await openVehicle(page, data.vehicleName)
  await vehicleDetail.getByRole('button', { name: 'Edit vehicle', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit vehicle', exact: true })
  await expect(editor.getByLabel('Default driver', { exact: true })).toHaveValue(data.driver.id)
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.request.post(`${apiUrl}/auth/logout`)
  await login(page, 'viewer@example.invalid')
  await page.goto('/vehicles')
  await expect(page.getByRole('heading', { name: 'Access restricted', exact: true })).toBeVisible()
  await page.goto('/driver-allowances')
  await expect(page.getByRole('heading', { name: 'Access restricted', exact: true })).toBeVisible()
  const denied = await page.request.post(
    `${apiUrl}/driver-allowances/${data.allowance.id}/approve`,
    { data: {} },
  )
  expect(denied.status()).toBe(403)
})

test('vehicle maintenance pagination keeps the current repair visible and older records reachable', async ({
  page,
}) => {
  await login(page)
  const data = await prepareFleet(page, `pages-${Date.now().toString(36)}`)
  const create = (description: string) =>
    api<{ id: string }>(page.request, `/vehicles/${data.vehicle.id}/maintenance`, 'POST', {
      branchId: fixtures.branchId,
      maintenanceType: 'Inspection',
      description,
      laborCost: '0',
      partsCost: '0',
      otherCost: '0',
    })
  const current = await create('Old open repair needing attention')
  await api(page.request, `/vehicle-maintenance/${current.id}/start`, 'POST', {})
  for (let index = 0; index < 20; index++) await create(`Scheduled inspection ${index + 1}`)
  const dialog = await openVehicle(page, data.vehicleName)
  await expect(dialog.getByText('Current maintenance', { exact: true })).toBeVisible()
  const pages = dialog.getByRole('navigation', { name: 'Maintenance record pages', exact: true })
  await expect(pages).toContainText('Page 1 of 2 · 21 records')
  await pages.getByRole('button', { name: 'Older', exact: true }).click()
  await expect(pages).toContainText('Page 2 of 2 · 21 records')
  await expect(dialog.locator('.fleet-current')).toContainText('Old open repair needing attention')
  await expect(
    dialog.getByRole('button').filter({ hasText: 'Old open repair needing attention' }),
  ).toHaveCount(1)
})
