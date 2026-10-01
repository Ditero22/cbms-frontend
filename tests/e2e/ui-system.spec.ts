import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const password = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
  customerId: string
}
type ListResult = { data: Record<string, string>[]; total: number }
type RouteDefinition = {
  id: string
  title: string
  primary?: string
  mobileFields?: string[]
}

// These expectations describe business information users need while reviewing a record,
// independently of the component's implementation or its metadata defaults.
const routes: RouteDefinition[] = [
  {
    id: 'users',
    title: 'Users & Roles',
    primary: 'Add user',
    mobileFields: ['Email', 'Role', 'Branch'],
  },
  {
    id: 'branches',
    title: 'Branches',
    primary: 'Add branch',
    mobileFields: ['Code', 'Manager', 'Phone'],
  },
  {
    id: 'employees',
    title: 'Employees',
    primary: 'Add employee',
    mobileFields: ['Employee ID', 'Position', 'Branch'],
  },
  {
    id: 'customers',
    title: 'Customers',
    primary: 'Add customer',
    mobileFields: ['Contact', 'Phone', 'Location', 'Branch'],
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    primary: 'Add supplier',
    mobileFields: ['Contact', 'Category', 'Payment terms'],
  },
  {
    id: 'products',
    title: 'Products',
    primary: 'Add product',
    mobileFields: ['SKU', 'Category', 'Unit price'],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    primary: 'Adjust stock',
    mobileFields: ['Branch', 'On hand', 'Reserved', 'Available', 'Reorder point'],
  },
  {
    id: 'transfers',
    title: 'Stock Transfers',
    primary: 'New transfer',
    mobileFields: ['From', 'To', 'Items', 'Requested'],
  },
  {
    id: 'orders',
    title: 'Orders',
    primary: 'Create order',
    mobileFields: ['Customer', 'Amount', 'Branch', 'Date'],
  },
  {
    id: 'payments',
    title: 'Payments',
    primary: 'Record payment',
    mobileFields: ['Customer', 'Remaining Balance', 'Amount Paid', 'Total Amount'],
  },
  {
    id: 'deliveries',
    title: 'Deliveries',
    primary: 'Schedule delivery',
    mobileFields: ['Order', 'Destination', 'Driver', 'Schedule'],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    primary: 'Add vehicle',
    mobileFields: ['Branch', 'Plate number', 'Capacity'],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    primary: 'New expense',
    mobileFields: ['Amount', 'Branch', 'Category', 'Submitted by', 'Date'],
  },
  {
    id: 'payroll',
    title: 'Payroll',
    primary: 'Create pay run',
    mobileFields: ['Period', 'Employees', 'Net pay', 'Paid', 'Branch'],
  },
  { id: 'reports', title: 'Reports', primary: 'Download CSV' },
  {
    id: 'audit-logs',
    title: 'Audit Logs',
    mobileFields: ['User', 'Module', 'Branch', 'Date & time'],
  },
]
const unique = crypto.randomUUID().slice(0, 8)
const searches: Record<string, string> = {
  branches: `UI service branch ${unique}`,
  employees: `UI operations employee ${unique}`,
  customers: `UI construction customer ${unique}`,
  suppliers: `UI materials supplier ${unique}`,
  products: `UI structural material ${unique}`,
}

async function api<T>(request: APIRequestContext, path: string, method = 'GET', data?: unknown) {
  const response = await request.fetch(`${apiUrl}${path}`, { method, data })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  return (response.status() === 204 ? undefined : await response.json()) as T
}

test.beforeAll(async ({ request }) => {
  expect(password.length, 'Use the disposable browser-test runner.').toBeGreaterThanOrEqual(12)
  expect(fixtures.branchId).toMatch(/^[a-f\d-]{36}$/i)
  await api(request, '/auth/login', 'POST', { email: 'administrator@example.invalid', password })
  try {
    await api(request, '/branches', 'POST', {
      name: searches.branches,
      code: `UI-${unique}`,
      managerName: 'Regional construction operations manager',
      phone: '+63 917 123 4567',
      address: 'Warehouse 12, Industrial Road, Construction Services District',
    })
    await api(request, '/employees', 'POST', {
      name: searches.employees,
      employeeNumber: `UI-${unique}`,
      position: 'Construction operations coordinator',
      branchId: fixtures.branchId,
    })
    await api(request, '/customers', 'POST', {
      name: searches.customers,
      branchId: fixtures.branchId,
      contactName: 'Construction procurement coordinator',
      email: `construction.procurement.${unique}@example.invalid`,
      location: 'Warehouse 12, Industrial Road, Construction Services District',
      phone: '+63 917 123 4567',
    })
    const supplier = await api<{ id: string }>(request, '/suppliers', 'POST', {
      name: searches.suppliers,
      contactName: 'Construction materials account representative',
      category: 'Structural construction materials',
      paymentTerms: 'Payment within thirty days of the recorded invoice',
      email: `materials.account.${unique}@example.invalid`,
    })
    await api(request, '/products', 'POST', {
      name: searches.products,
      sku: `UI-MATERIAL-${unique}`,
      category: 'Structural construction materials',
      unit: 'piece',
      unitPrice: '98765.43',
      supplierId: supplier.id,
    })
  } finally {
    await api(request, '/auth/logout', 'POST')
  }
})

async function login(page: Page, email = 'administrator@example.invalid') {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible()
  const theme = process.env.CBMS_E2E_THEME === 'light' ? 'light' : 'dark'
  const themeControl = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true })
  if (await themeControl.isVisible()) await themeControl.click()
  await expect(
    page.getByRole('button', {
      name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
      exact: true,
    }),
  ).toBeVisible()
}

async function noDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
}

async function dialogBounds(page: Page, dialog: Locator) {
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

async function readableTextContrast(text: Locator, background: Locator) {
  const foregroundColor = await text.evaluate((element) => getComputedStyle(element).color)
  const backgroundColor = await background.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.map(Number)
    if (!channels || channels.length < 3 || (channels[3] !== undefined && channels[3] < 1)) {
      throw new Error(`Contrast verification requires opaque RGB colors; received ${color}.`)
    }
    const linear = channels.slice(0, 3).map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const values = [luminance(foregroundColor), luminance(backgroundColor)]
  expect(
    (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05),
    `Text ${foregroundColor} must be readable against ${backgroundColor}.`,
  ).toBeGreaterThanOrEqual(4.5)
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`all 18 application pages and shared record forms work at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    const browserErrors: string[] = []
    const failedApiResponses: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    const dashboard = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/v1/dashboard/summary',
    )
    await login(page)
    expect((await dashboard).status()).toBe(200)
    // An anonymous /auth/me 401 is expected while opening the sign-in screen.
    // From here on, every authenticated page and its option requests must succeed.
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('response', (response) => {
      if (response.url().startsWith(apiUrl) && response.status() >= 400) {
        failedApiResponses.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        )
      }
    })
    await expect(page.locator('.dashboard-grid')).toBeVisible()
    await readableTextContrast(page.locator('.page-heading p'), page.locator('.app-root'))
    await noDocumentOverflow(page)
    await expect(page.locator('.page-heading .button-primary')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Open orders', exact: true })).toHaveCount(1)
    await page.screenshot({ path: testInfo.outputPath(`overview-${width}.png`), fullPage: true })

    for (const route of routes) {
      await test.step(route.title, async () => {
        const result = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname ===
              `/api/v1/${route.id === 'reports' ? 'reports/data' : route.id}`,
        )
        await page.goto(route.id === 'payroll' ? '/payroll?view=runs' : `/${route.id}`)
        const response = await result
        expect(response.status(), `${route.title} list must load from its actual API.`).toBe(200)
        await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible()
        const canvas = page.locator('.app-root')
        await readableTextContrast(page.locator('.page-heading p'), canvas)
        const workspaceBreadcrumb = page
          .getByRole('navigation', { name: 'Breadcrumb', exact: true })
          .getByRole('link', { name: 'Workspace', exact: true })
        await expect(workspaceBreadcrumb).toBeVisible()
        await readableTextContrast(workspaceBreadcrumb, canvas)
        await expect(page.locator('.page-heading .button-primary')).toHaveCount(
          route.primary ? 1 : 0,
        )
        if (route.primary)
          await expect(page.getByRole('button', { name: route.primary, exact: true })).toHaveCount(
            1,
          )
        if (route.id === 'reports') {
          await expect(page.getByLabel('Report', { exact: true })).toBeEnabled()
          await expect(page.getByText('Generating report…', { exact: true })).toBeHidden()
          await expect(
            page.getByText('Could not generate this report.', { exact: true }),
          ).toHaveCount(0)
          // The seeded inventory gives this report real rows even when this file runs alone.
          const inventorySnapshot = page.waitForResponse(
            (next) =>
              new URL(next.url()).pathname === '/api/v1/reports/data' &&
              new URL(next.url()).searchParams.get('report') === 'inventory-health',
          )
          await page
            .getByRole('combobox', { name: 'Report', exact: true })
            .selectOption('inventory-health')
          const snapshot = await inventorySnapshot
          expect(snapshot.status()).toBe(200)
          expect(((await snapshot.json()) as { rows: unknown[] }).rows.length).toBeGreaterThan(0)
          if (width <= 800) {
            const reportLabel = page
              .locator('.report-record-card .report-record-field > span')
              .first()
            await expect(reportLabel).toBeVisible()
            // Report cards are transparent; their actual opaque surface belongs to this ancestor.
            await readableTextContrast(reportLabel, page.locator('.report-results'))
          }
        } else {
          await expect(page.getByLabel(`Search ${route.title}`, { exact: true })).toBeVisible()
          let list = (await response.json()) as ListResult
          if (searches[route.id]) {
            const searched = page.waitForResponse(
              (next) =>
                next.request().method() === 'GET' &&
                new URL(next.url()).pathname === `/api/v1/${route.id}` &&
                new URL(next.url()).searchParams.get('search') === searches[route.id],
            )
            await page.getByLabel(`Search ${route.title}`, { exact: true }).fill(searches[route.id])
            const filtered = await searched
            expect(filtered.status()).toBe(200)
            list = (await filtered.json()) as ListResult
            expect(list.data).toHaveLength(1)
          }
          const table = page.getByRole('table', { name: `${route.title} records`, exact: true })
          if (width <= 800) {
            await expect(table).toBeHidden()
            if (list.data.length > 0) {
              const card = page.locator('.record-grid .record-card').first()
              await expect(card).toBeVisible()
              await readableTextContrast(card.locator('.record-card-heading > strong'), card)
              for (const field of route.mobileFields ?? []) {
                const recordField = card
                  .locator('.record-card-field')
                  .filter({ has: page.getByText(field, { exact: true }) })
                await expect(recordField).toHaveCount(1)
                await expect(recordField.locator('strong')).toHaveText(list.data[0][field] || '—')
              }
            } else {
              await expect(page.getByText('No records yet', { exact: true })).toBeVisible()
            }
          } else {
            await expect(table).toBeVisible()
            await expect(page.locator('.record-grid')).toBeHidden()
          }
          await expect(page.getByRole('button', { name: 'Export page', exact: true })).toBeEnabled()
          const pageCaption = page.locator('.pagination > span')
          await expect(pageCaption).toBeVisible()
          expect(
            await pageCaption.evaluate((element) =>
              Number.parseFloat(getComputedStyle(element).fontSize),
            ),
            `${route.title} pagination must remain readable at ${width}px.`,
          ).toBeGreaterThanOrEqual(11)
          if (route.id === 'customers') {
            const record = tableRecordControl(page, searches.customers)
            await record.click()
            const detail = page.getByRole('dialog', { name: searches.customers, exact: true })
            await expect(
              detail.getByText(`construction.procurement.${unique}@example.invalid`, {
                exact: true,
              }),
            ).toBeVisible()
            await dialogBounds(page, detail)
            await detail.getByRole('button', { name: 'Close', exact: true }).click()
            await expect(detail).toBeHidden()
            await expect(record).toBeFocused()
          }
        }
        await noDocumentOverflow(page)
        if (['orders', 'products', 'reports'].includes(route.id)) {
          await page.screenshot({
            path: testInfo.outputPath(`${route.id}-${width}.png`),
            fullPage: true,
          })
        }
        if (['branches', 'customers', 'suppliers', 'products'].includes(route.id)) {
          const create = page.getByRole('button', { name: route.primary!, exact: true })
          await create.click()
          const dialog = page.getByRole('dialog', { name: route.primary!, exact: true })
          await expect(
            dialog.getByRole('button', { name: 'Create record', exact: true }),
          ).toBeEnabled()
          await dialogBounds(page, dialog)
          await page.keyboard.press('Escape')
          await expect(dialog).toBeHidden()
          await expect(create).toBeFocused()
          await noDocumentOverflow(page)
        }
      })
    }
    expect(
      failedApiResponses,
      'Every audited page must finish its actual API requests successfully.',
    ).toEqual([])
    expect(
      browserErrors,
      'No uncaught application or console errors while navigating all modules.',
    ).toEqual([])
  })
}

test('keyboard users can skip shared navigation and land in the main content', async ({ page }) => {
  await login(page)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 820 })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Welcome, Acceptance' })).toBeVisible()

    const skipLink = page.getByRole('link', { name: 'Skip to main content', exact: true })
    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()
    await expect.poll(async () => (await skipLink.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0)
    await page.keyboard.press('Enter')

    await expect(page.locator('#main-content')).toBeFocused()
    await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('collapsed sidebar explains icons on keyboard focus and persists through navigation and reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  const sidebar = page.locator('#desktop-navigation')
  const inventory = sidebar.getByRole('link', { name: 'Inventory', exact: true })
  await inventory.focus()
  await expect(page.getByRole('tooltip')).toHaveText('Inventory')
  await expect(inventory).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cbms-sidebar-collapsed'))).toBe('true')
  const orders = sidebar.getByRole('link', { name: 'Orders', exact: true })
  await orders.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Orders')
  await page.mouse.move(800, 100)
  await expect(page.getByRole('tooltip')).toBeHidden()
  await orders.focus()
  await expect(orders).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Orders')
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).focus()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cbms-sidebar-collapsed'))).toBe('false')
})

test('mobile drawer shows actual branch scope, permission-filtered navigation, independent scroll and focus restoration', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 740 })
  await login(page, 'viewer@example.invalid')
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })
  await trigger.click()
  const drawer = page.getByRole('dialog', { name: 'Main navigation', exact: true })
  await expect(
    drawer.getByRole('group', { name: 'Current branch scope', exact: true }),
  ).toContainText('Acceptance branch')
  await expect(drawer.getByRole('link', { name: 'Orders', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Payments', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Deliveries', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Users & roles', exact: true })).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await dialogBounds(page, drawer)
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
  await page.screenshot({ path: testInfo.outputPath('branch-viewer-drawer-390.png') })
  await drawer.getByRole('link', { name: 'Orders', exact: true }).click()
  await expect(drawer).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create order', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')

  await api(page.request, '/auth/logout', 'POST')
  await login(page)
  await trigger.click()
  await expect(
    drawer.getByRole('group', { name: 'Current branch scope', exact: true }),
  ).toContainText('All branches')
  await dialogBounds(page, drawer)
  const navigation = drawer.getByRole('navigation', { name: 'Main navigation', exact: true })
  const before = await drawer
    .getByRole('button', { name: 'Close navigation', exact: true })
    .boundingBox()
  expect(await navigation.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  )
  await navigation.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(drawer.getByRole('link', { name: 'Design system', exact: true })).toBeVisible()
  const after = await drawer
    .getByRole('button', { name: 'Close navigation', exact: true })
    .boundingBox()
  expect(before).not.toBeNull()
  expect(after).not.toBeNull()
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
})

test('shared record form associates inline errors, preserves failed drafts, and protects pending saves', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await login(page)
  await page.goto('/customers')
  const create = page.getByRole('button', { name: 'Add customer', exact: true })
  await create.click()
  const dialog = page.getByRole('dialog', { name: 'Add customer', exact: true })
  const name = dialog.getByRole('textbox', { name: 'Customer name', exact: true })
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-required', 'true')
  await dialog.getByRole('button', { name: 'Create record', exact: true }).click()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  const errorId = await name.getAttribute('aria-describedby')
  expect(errorId).toBeTruthy()
  const inlineError = dialog.locator(`[id="${errorId}"]`)
  await expect(inlineError).toContainText('Customer name is required.')
  await readableTextContrast(inlineError, dialog)
  await expect(name).toBeFocused()
  const draftName = `UI preserved customer ${crypto.randomUUID().slice(0, 8)}`
  await name.fill(draftName)
  await dialog
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption(fixtures.branchId)
  await dialog.getByLabel('Contact', { exact: true }).fill('Construction procurement coordinator')
  await dialog.getByLabel('Email', { exact: true }).fill('preserved.customer@example.invalid')
  await dialog.getByLabel('Location', { exact: true }).fill('Construction services district')
  await page.route(`${apiUrl}/customers`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'TEMPORARY_UNAVAILABLE', message: 'Customer save temporarily unavailable.' },
      }),
    })
  })
  await dialog.getByRole('button', { name: 'Create record', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(name).toHaveValue(draftName)
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(
    'preserved.customer@example.invalid',
  )
  await expect(dialog.getByLabel('Location', { exact: true })).toHaveValue(
    'Construction services district',
  )
  await page.screenshot({ path: testInfo.outputPath('customer-failed-draft-390.png') })
  await page.unroute(`${apiUrl}/customers`)

  let releaseSave!: () => void
  const pending = new Promise<void>((resolve) => {
    releaseSave = resolve
  })
  await page.route(`${apiUrl}/customers`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await pending
    await route.continue()
  })
  const response = page.waitForResponse(
    (res) => res.url() === `${apiUrl}/customers` && res.request().method() === 'POST',
  )
  try {
    await dialog.getByRole('button', { name: 'Create record', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
    await expect(name).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(dialog).toBeVisible()
    await dialogBounds(page, dialog)
  } finally {
    releaseSave()
  }
  expect((await response).status()).toBe(201)
  await expect(dialog).toBeHidden()
  await expect(create).toBeFocused()
  await page.getByLabel('Search Customers', { exact: true }).fill(draftName)
  await expect(tableRecordControl(page, draftName)).toBeVisible()
  await noDocumentOverflow(page)
})

async function prepareMaterial(page: Page, unitPrice: string) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const sku = `UI-EXACT-${suffix}`
  const product = await api<{ id: string }>(page.request, '/products', 'POST', {
    name: `UI exact material ${suffix}`,
    sku,
    category: 'Materials',
    unit: 'kg',
    unitPrice,
  })
  await api(page.request, '/inventory/adjustments', 'POST', {
    productId: product.id,
    branchId: fixtures.branchId,
    quantityDelta: '1.000',
    note: 'Disposable UI exact-quantity fixture',
  })
  return { ...product, sku }
}

async function failOptions(page: Page, path: string) {
  await page.route(`${apiUrl}${path}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'OPTIONS_UNAVAILABLE', message: 'Catalog temporarily unavailable.' },
      }),
    }),
  )
}

async function failWrite(page: Page, path: string) {
  await page.route(`${apiUrl}${path}`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'SAVE_UNAVAILABLE', message: 'Save temporarily unavailable.' },
      }),
    })
  })
}

async function holdWrite(page: Page, path: string) {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`${apiUrl}${path}`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await pending
    await route.continue()
  })
  return release
}

async function assertPendingCloseGuard(page: Page, dialog: Locator, savingText: string) {
  await expect(dialog.getByRole('button', { name: savingText, exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).first(),
  ).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Add product', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(dialog).toBeVisible()
  await dialogBounds(page, dialog)
}

test('order options recover without losing quantities, per-line totals match the API, and pending saves keep the form open', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await login(page)
  const first = await prepareMaterial(page, '0.05')
  const second = await prepareMaterial(page, '0.05')
  await failOptions(page, '/orders/options')
  await page.goto('/orders')
  await page.getByRole('button', { name: 'Create order', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create order', exact: true })
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(dialog.getByRole('combobox', { name: 'Customer', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Create order', exact: true })).toBeDisabled()
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0.1')
  await page.unroute(`${apiUrl}/orders/options`)
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(dialog.getByRole('combobox', { name: 'Customer', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0.1')
  await dialog
    .getByRole('combobox', { name: 'Customer', exact: true })
    .selectOption(fixtures.customerId)
  await dialog
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption(fixtures.branchId)
  await dialog.getByRole('combobox', { name: 'Product', exact: true }).selectOption(first.id)
  await dialog.getByRole('button', { name: 'Add product', exact: true }).click()
  await dialog
    .getByRole('combobox', { name: 'Product', exact: true })
    .nth(1)
    .selectOption(second.id)
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).nth(1).fill('0.1')
  // Each 0.05 × 0.1 line rounds to 0.01; summing unrounded lines would wrongly show 0.01.
  await expect(dialog.locator('.order-estimate strong')).toHaveText('₱0.02')
  await failWrite(page, '/orders')
  await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(dialog.getByRole('combobox', { name: 'Product', exact: true }).nth(0)).toHaveValue(
    first.id,
  )
  await expect(dialog.getByRole('combobox', { name: 'Product', exact: true }).nth(1)).toHaveValue(
    second.id,
  )
  await expect(
    dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).nth(0),
  ).toHaveValue('0.1')
  await expect(
    dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).nth(1),
  ).toHaveValue('0.1')
  await expect(dialog.locator('.order-estimate strong')).toHaveText('₱0.02')
  await page.screenshot({ path: testInfo.outputPath('order-retry-exact-total-390.png') })
  await page.unroute(`${apiUrl}/orders`)
  const release = await holdWrite(page, '/orders')
  const saved = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/orders` && response.request().method() === 'POST',
  )
  try {
    await dialog.getByRole('button', { name: 'Create order', exact: true }).click()
    await assertPendingCloseGuard(page, dialog, 'Saving order…')
  } finally {
    release()
  }
  const response = await saved
  expect(response.status()).toBe(201)
  const created = (await response.json()) as { id: string }
  const stored = await api<{
    totalAmount: string
    payableAmount: string
    items: { lineTotal: string }[]
  }>(page.request, `/orders/${created.id}`)
  expect(stored.totalAmount).toBe('0.02')
  expect(stored.payableAmount).toBe('0.02')
  expect(stored.items.map((item) => item.lineTotal)).toEqual(['0.01', '0.01'])
  await expect(dialog).toBeHidden()
  await noDocumentOverflow(page)
})

test('transfer options recover with the note and quantity intact, failed writes retain selections, and pending saves stay open', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await login(page)
  const product = await prepareMaterial(page, '10.00')
  await failOptions(page, '/transfers/options')
  await page.goto('/transfers')
  await page.getByRole('button', { name: 'New transfer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New stock transfer', exact: true })
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(dialog.getByRole('combobox', { name: 'From branch', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Complete transfer', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0.125')
  const note = 'Preserve this fractional construction material transfer draft'
  await dialog.getByLabel('Note', { exact: true }).fill(note)
  await page.unroute(`${apiUrl}/transfers/options`)
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(dialog.getByRole('combobox', { name: 'From branch', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue(
    '0.125',
  )
  await expect(dialog.getByLabel('Note', { exact: true })).toHaveValue(note)
  await dialog
    .getByRole('combobox', { name: 'From branch', exact: true })
    .selectOption(fixtures.branchId)
  await dialog
    .getByRole('combobox', { name: 'To branch', exact: true })
    .selectOption(fixtures.otherBranchId)
  await dialog.getByRole('combobox', { name: 'Product', exact: true }).selectOption(product.id)
  await failWrite(page, '/transfers')
  await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again shortly.',
  )
  await expect(dialog.getByRole('combobox', { name: 'From branch', exact: true })).toHaveValue(
    fixtures.branchId,
  )
  await expect(dialog.getByRole('combobox', { name: 'To branch', exact: true })).toHaveValue(
    fixtures.otherBranchId,
  )
  await expect(dialog.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue(
    product.id,
  )
  await expect(dialog.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue(
    '0.125',
  )
  await expect(dialog.getByLabel('Note', { exact: true })).toHaveValue(note)
  await page.screenshot({ path: testInfo.outputPath('transfer-failed-draft-768.png') })
  await page.unroute(`${apiUrl}/transfers`)
  const release = await holdWrite(page, '/transfers')
  const saved = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/transfers` && response.request().method() === 'POST',
  )
  try {
    await dialog.getByRole('button', { name: 'Complete transfer', exact: true }).click()
    await assertPendingCloseGuard(page, dialog, 'Saving transfer…')
  } finally {
    release()
  }
  const response = await saved
  expect(response.status()).toBe(201)
  const transfer = (await response.json()) as { reference: string; status: string }
  expect(transfer.status).toBe('Completed')
  await expect(dialog).toBeHidden()
  await page.getByLabel('Search Stock Transfers', { exact: true }).fill(transfer.reference)
  await expect(tableRecordControl(page, transfer.reference)).toBeVisible()
  const stock = await api<{ data: { branchId: string; productId: string; quantity: string }[] }>(
    page.request,
    `/inventory?search=${encodeURIComponent(product.sku)}&page=1&limit=100`,
  )
  expect(
    stock.data.find((row) => row.productId === product.id && row.branchId === fixtures.branchId)
      ?.quantity,
  ).toBe('0.875')
  expect(
    stock.data.find(
      (row) => row.productId === product.id && row.branchId === fixtures.otherBranchId,
    )?.quantity,
  ).toBe('0.125')
  await noDocumentOverflow(page)
})
