import { expect, test, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
}
type Detail = Record<string, unknown> & { history: { action: string }[] }

async function login(page: Page, email = 'administrator@example.invalid') {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(process.env.CBMS_E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function detail(page: Page, moduleId: string, id: string) {
  const response = await page.request.get(`${apiUrl}/${moduleId}/${id}`)
  expect(response.ok()).toBe(true)
  return response.json() as Promise<Detail>
}

async function bounds(page: Page, dialog: Locator) {
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
}

async function create(
  page: Page,
  moduleId: string,
  label: string,
  fill: (dialog: Locator) => Promise<void>,
) {
  await page.goto(`/${moduleId}`)
  await page.getByRole('button', { name: label, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await bounds(page, dialog)
  await fill(dialog)
  const response = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/${moduleId}` && response.request().method() === 'POST',
  )
  await dialog
    .getByRole('button', {
      name: moduleId === 'employees' ? 'Create employee' : 'Create record',
      exact: true,
    })
    .click()
  const saved = await response
  expect(saved.ok()).toBe(true)
  const record = (await saved.json()) as { id: string }
  await expect(dialog).toBeHidden()
  return record.id
}

async function openRecord(page: Page, moduleId: string, title: string, name: string) {
  await page.goto(`/${moduleId}`)
  await page.getByRole('textbox', { name: `Search ${title}`, exact: true }).fill(name)
  const row = tableRecordControl(page, name)
  await row.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible()
  await bounds(page, dialog)
  return dialog
}

async function edit(
  page: Page,
  moduleId: string,
  title: string,
  name: string,
  singular: string,
  fill: (dialog: Locator) => Promise<void>,
) {
  const current = await openRecord(page, moduleId, title, name)
  await current.getByRole('button', { name: `Edit ${singular}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: `Edit ${singular}`, exact: true })).toBeVisible()
  await fill(dialog)
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function archive(page: Page, moduleId: string, title: string, name: string) {
  const current = await openRecord(page, moduleId, title, name)
  await current
    .getByRole('button', {
      name: moduleId === 'employees' ? 'Archive employee' : 'Archive',
      exact: true,
    })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: /Archive .*\?/ })).toBeVisible()
  await dialog
    .getByRole('button', {
      name: moduleId === 'employees' ? 'Archive employee' : 'Archive',
      exact: true,
    })
    .click()
  await expect(dialog).toBeHidden()
  await expect(tableRecordControl(page, name)).toHaveCount(0)
}

for (const width of [390, 430, 768, 1024, 1440]) {
  test(`master records persist create/edit/status/archive at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const suffix = `${width}-${crypto.randomUUID().slice(0, 8)}`
    const branchName = `Master yard ${suffix}`
    const branchId = await create(page, 'branches', 'Add branch', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Branch name', exact: true }).fill(branchName)
      await dialog.getByRole('textbox', { name: 'Branch code', exact: true }).fill(`MY-${suffix}`)
      await dialog.getByLabel('Manager', { exact: true }).fill('Test manager')
      await dialog.getByLabel('Phone', { exact: true }).fill('555-0111')
      await dialog.getByLabel('Email', { exact: true }).fill('yard@example.invalid')
      await dialog.getByLabel('Address', { exact: true }).fill('Test service yard')
    })
    expect(await detail(page, 'branches', branchId)).toMatchObject({
      email: 'yard@example.invalid',
      address: 'Test service yard',
    })
    await edit(page, 'branches', 'Branches', branchName, 'branch', async (dialog) => {
      await dialog.getByLabel('Manager', { exact: true }).fill('Updated manager')
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Inactive')
    })
    expect(await detail(page, 'branches', branchId)).toMatchObject({
      managerName: 'Updated manager',
      status: 'Inactive',
    })
    await edit(page, 'branches', 'Branches', branchName, 'branch', async (dialog) => {
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Active')
    })

    const employeeName = `Master worker ${suffix}`
    const employeeId = await create(page, 'employees', 'Add employee', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Employee ID', exact: true }).fill(`MW-${suffix}`)
      await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill(employeeName)
      await dialog.getByRole('textbox', { name: 'Position', exact: true }).fill('Mason')
      await dialog.getByRole('combobox', { name: 'Branch', exact: true }).selectOption(branchId)
      await dialog.getByLabel('Hire date', { exact: true }).fill('2026-09-01')
      await dialog.getByLabel('Phone', { exact: true }).fill('555-0122')
      await dialog.getByLabel('Address', { exact: true }).fill('Test worker address')
      await dialog.getByLabel('Emergency contact name', { exact: true }).fill('Test contact')
      await dialog.getByLabel('Emergency contact phone', { exact: true }).fill('555-0133')
      await expect(dialog.getByLabel('License number', { exact: true })).toHaveCount(0)
      await dialog.screenshot({ path: test.info().outputPath('employee-form.png') })
    })
    const worker = await detail(page, 'employees', employeeId)
    expect(worker.employee).toMatchObject({
      address: 'Test worker address',
      emergencyContactName: 'Test contact',
      hiredAt: '2026-09-01',
      isDriver: false,
    })
    await edit(page, 'employees', 'Employees', employeeName, 'employee', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Position', exact: true }).fill('Senior mason')
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Inactive')
    })
    expect((await detail(page, 'employees', employeeId)).employee).toMatchObject({
      position: 'Senior mason',
      status: 'Inactive',
      emergencyContactName: 'Test contact',
    })
    await archive(page, 'employees', 'Employees', employeeName)
    expect((await detail(page, 'employees', employeeId)).employee).toMatchObject({
      archivedAt: expect.any(String),
    })

    const customerName = `Master customer ${suffix}`
    const customerId = await create(page, 'customers', 'Add customer', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Customer name', exact: true }).fill(customerName)
      await dialog.getByLabel('Contact', { exact: true }).fill('Test customer contact')
      await dialog.getByLabel('Phone', { exact: true }).fill('555-0144')
      await dialog.getByLabel('Email', { exact: true }).fill('customer@example.invalid')
      await dialog.getByLabel('Location', { exact: true }).fill('Test construction site')
      await dialog.getByRole('combobox', { name: 'Branch', exact: true }).selectOption(branchId)
    })
    const otherCustomerName = `Other branch customer ${suffix}`
    await create(page, 'customers', 'Add customer', async (dialog) => {
      await dialog
        .getByRole('textbox', { name: 'Customer name', exact: true })
        .fill(otherCustomerName)
      await dialog
        .getByRole('combobox', { name: 'Branch', exact: true })
        .selectOption(fixtures.otherBranchId)
    })
    const branchFilter = page.getByRole('combobox', { name: 'Filter by branch', exact: true })
    await branchFilter.selectOption(branchId)
    await expect(tableRecordControl(page, customerName)).toBeVisible()
    await expect(tableRecordControl(page, otherCustomerName)).toHaveCount(0)
    await branchFilter.selectOption(fixtures.otherBranchId)
    await expect(tableRecordControl(page, otherCustomerName)).toBeVisible()
    await expect(tableRecordControl(page, customerName)).toHaveCount(0)
    await branchFilter.selectOption('')
    await edit(page, 'customers', 'Customers', customerName, 'customer', async (dialog) => {
      await dialog.getByLabel('Location', { exact: true }).fill('Updated test site')
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Inactive')
    })
    expect(await detail(page, 'customers', customerId)).toMatchObject({
      phone: '555-0144',
      location: 'Updated test site',
      status: 'Inactive',
    })
    await archive(page, 'customers', 'Customers', customerName)

    const supplierName = `Master supplier ${suffix}`
    const supplierId = await create(page, 'suppliers', 'Add supplier', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Supplier name', exact: true }).fill(supplierName)
      await dialog.getByLabel('Phone', { exact: true }).fill('555-0155')
      await dialog.getByLabel('Email', { exact: true }).fill('supplier@example.invalid')
      await dialog.getByRole('textbox', { name: 'Category', exact: true }).fill('Materials')
      await dialog.getByLabel('Payment terms', { exact: true }).fill('Net 30')
    })
    const productName = `Master cement ${suffix}`
    const productId = await create(page, 'products', 'Add product', async (dialog) => {
      await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill(productName)
      await dialog.getByRole('textbox', { name: 'SKU', exact: true }).fill(`MC-${suffix}`)
      await dialog.getByRole('textbox', { name: 'Category', exact: true }).fill('Cement')
      await dialog.getByRole('textbox', { name: 'Unit', exact: true }).fill('bag')
      const price = dialog.getByRole('spinbutton', { name: 'Unit price', exact: true })
      await price.fill('1e2')
      await dialog.getByRole('button', { name: 'Create record', exact: true }).click()
      await expect(dialog.getByRole('alert')).toContainText(
        'Enter a non-negative price with up to 12 digits and 2 decimal places.',
      )
      await expect(price).toHaveAttribute('aria-invalid', 'true')
      await price.fill('250.05')
      await dialog.getByRole('combobox', { name: 'Supplier', exact: true }).selectOption(supplierId)
      await dialog
        .getByLabel('Specifications / description', { exact: true })
        .fill('40 kg test bag')
    })
    expect(await detail(page, 'products', productId)).toMatchObject({
      unitPrice: '250.05',
      description: '40 kg test bag',
      supplierId,
    })
    await edit(page, 'products', 'Products', productName, 'product', async (dialog) => {
      await dialog.getByRole('spinbutton', { name: 'Unit price', exact: true }).fill('0')
      await dialog
        .getByLabel('Specifications / description', { exact: true })
        .fill('Updated test specification')
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Inactive')
    })
    expect(await detail(page, 'products', productId)).toMatchObject({
      unitPrice: '0.00',
      description: 'Updated test specification',
      status: 'Inactive',
    })
    await archive(page, 'products', 'Products', productName)
    await edit(page, 'suppliers', 'Suppliers', supplierName, 'supplier', async (dialog) => {
      await dialog.getByLabel('Payment terms', { exact: true }).fill('Prepaid')
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Inactive')
    })
    expect(await detail(page, 'suppliers', supplierId)).toMatchObject({
      paymentTerms: 'Prepaid',
      status: 'Inactive',
    })
    await archive(page, 'suppliers', 'Suppliers', supplierName)
    await archive(page, 'branches', 'Branches', branchName)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
  })
}

test('validation and failed employee saves retain accessible drafts; archive cannot close while pending', async ({
  page,
}) => {
  await login(page)
  const suffix = crypto.randomUUID().slice(0, 8)
  const name = `Retry worker ${suffix}`
  const id = await create(page, 'employees', 'Add employee', async (dialog) => {
    await dialog.getByRole('textbox', { name: 'Employee ID', exact: true }).fill(`RW-${suffix}`)
    await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill(name)
    await dialog.getByRole('textbox', { name: 'Position', exact: true }).fill('Mason')
    await dialog
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption(fixtures.branchId)
  })
  let dialog = await openRecord(page, 'employees', 'Employees', name)
  await dialog.getByRole('button', { name: 'Edit employee', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill(' ')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Full name', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(
    dialog.getByRole('textbox', { name: 'Full name', exact: true }),
  ).toHaveAccessibleDescription('Full name is required.')
  await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill(name)
  await dialog.getByRole('textbox', { name: 'Position', exact: true }).fill('Draft retained')
  await page.route(`${apiUrl}/employees/${id}`, async (route) => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 503,
        json: { error: { code: 'TEST_UNAVAILABLE', message: 'Please retry this test save.' } },
      })
    else await route.continue()
  })
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(dialog.getByRole('textbox', { name: 'Position', exact: true })).toHaveValue(
    'Draft retained',
  )
  await page.unroute(`${apiUrl}/employees/${id}`)
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect((await detail(page, 'employees', id)).employee).toMatchObject({
    position: 'Draft retained',
  })

  dialog = await openRecord(page, 'employees', 'Employees', name)
  await dialog.getByRole('button', { name: 'Archive employee', exact: true }).click()
  dialog = page.getByRole('dialog')
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`${apiUrl}/employees/${id}/archive`, async (route) => {
    await gate
    await route.continue()
  })
  try {
    await dialog.getByRole('button', { name: 'Archive employee', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(dialog).toBeVisible()
  } finally {
    release()
  }
  await expect(dialog).toBeHidden()
})

test('blocked archive stays open with server explanation and retry controls', async ({ page }) => {
  await login(page)
  await page.goto('/branches')
  await page
    .getByRole('textbox', { name: 'Search Branches', exact: true })
    .fill('Acceptance branch')
  await page
    .getByRole('row', { name: 'Open Acceptance branch record', exact: true })
    .filter({ visible: true })
    .click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Archive', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await detail(page, 'branches', fixtures.branchId)).toMatchObject({ status: 'Active' })
})

test('read-only master access hides writes and the API denies edits and archives', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)
  const suffix = crypto.randomUUID().slice(0, 8)
  const email = 'master-reader@example.invalid'
  const recordDefinitions = [
    {
      module: 'branches',
      title: 'Branches',
      add: 'Add branch',
      name: 'Acceptance branch',
      id: fixtures.branchId,
    },
    {
      module: 'employees',
      title: 'Employees',
      add: 'Add employee',
      name: `Read-only worker ${suffix}`,
      data: {
        employeeNumber: `RO-${suffix}`,
        name: `Read-only worker ${suffix}`,
        position: 'Mason',
        branchId: fixtures.branchId,
      },
    },
    {
      module: 'customers',
      title: 'Customers',
      add: 'Add customer',
      name: `Read-only customer ${suffix}`,
      data: { name: `Read-only customer ${suffix}`, branchId: fixtures.branchId },
    },
    {
      module: 'suppliers',
      title: 'Suppliers',
      add: 'Add supplier',
      name: `Read-only supplier ${suffix}`,
      data: { name: `Read-only supplier ${suffix}` },
    },
    {
      module: 'products',
      title: 'Products',
      add: 'Add product',
      name: `Read-only material ${suffix}`,
      data: {
        name: `Read-only material ${suffix}`,
        sku: `RO-${suffix}`,
        category: 'Materials',
        unit: 'bag',
        unitPrice: '12.50',
      },
    },
  ]
  const records: { module: string; title: string; add: string; name: string; id: string }[] = []
  for (const definition of recordDefinitions) {
    const response = definition.id
      ? undefined
      : await page.request.post(`${apiUrl}/${definition.module}`, { data: definition.data })
    if (response) expect(response.ok()).toBe(true)
    const id = definition.id ?? ((await response!.json()) as { id: string }).id
    records.push({ ...definition, id })
  }
  await page.request.post(`${apiUrl}/auth/logout`)
  await login(page, email)
  for (const record of records) {
    const dialog = await openRecord(page, record.module, record.title, record.name)
    await expect(page.getByRole('button', { name: record.add, exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /^(Edit|Archive)/ })).toHaveCount(0)
    await expect(dialog.getByRole('heading', { name: /(Recent|Record) history/ })).toHaveCount(0)
    const deniedEdit = await page.request.patch(`${apiUrl}/${record.module}/${record.id}`, {
      data: { name: 'Denied change' },
    })
    expect(deniedEdit.status()).toBe(403)
    const deniedArchive = await page.request.patch(
      `${apiUrl}/${record.module}/${record.id}/archive`,
    )
    expect(deniedArchive.status()).toBe(403)
    const stored = await detail(page, record.module, record.id)
    expect(record.module === 'employees' ? (stored.employee as Detail).name : stored.name).toBe(
      record.name,
    )
    expect(stored.history).toEqual([])
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
})
