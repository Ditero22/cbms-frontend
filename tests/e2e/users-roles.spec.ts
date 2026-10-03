import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { tableRecordControl } from './helpers/table-records'

const apiUrl = process.env.CBMS_E2E_API_URL ?? 'http://127.0.0.1:3002/api/v1'
const temporaryPassword = process.env.CBMS_E2E_PASSWORD ?? ''
const fixtures = JSON.parse(process.env.CBMS_E2E_FIXTURES ?? '{}') as {
  branchId: string
  otherBranchId: string
  administratorRoleId: string
  accountReaderRoleId: string
  accountReaderUserId: string
  branchManagerRoleId: string
  branchManagerUserId: string
  otherBranchUserId: string
}

type Role = {
  id: string
  name: string
  description: string | null
  permissions: string[]
  assignedUserCount: number
}

test.beforeAll(() => {
  for (const key of [
    'branchId',
    'otherBranchId',
    'administratorRoleId',
    'accountReaderRoleId',
    'accountReaderUserId',
    'branchManagerRoleId',
    'branchManagerUserId',
    'otherBranchUserId',
  ] as const) {
    expect(fixtures[key], `Browser fixture ${key} must be a valid identifier.`).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    )
  }
})

async function login(
  page: Page,
  email = 'administrator@example.invalid',
  password = temporaryPassword,
  dark = true,
) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  if (dark) {
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  }
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

async function checkBounds(page: Page, dialog: Locator) {
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

async function colors(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return { foreground: style.color, background: style.backgroundColor }
  })
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.map(Number)
    if (!channels || channels.length < 3 || (channels[3] !== undefined && channels[3] < 1)) {
      throw new Error(`Contrast verification requires an opaque RGB color; received ${color}.`)
    }
    const linear = channels.slice(0, 3).map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const values = [luminance(foreground), luminance(background)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}

async function openUser(page: Page, name: string) {
  await page.goto('/users')
  await page.getByLabel('Search Users & Roles', { exact: true }).fill(name)
  await tableRecordControl(page, name).click()
  const detail = page.getByRole('dialog', { name, exact: true })
  await expect(
    detail.getByRole('heading', { name: 'Account information', exact: true }),
  ).toBeVisible()
  return detail
}

async function openRoles(page: Page, roleId?: string) {
  await page.getByRole('button', { name: 'Manage roles', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage roles', exact: true })
  await expect(dialog.getByLabel(/^Existing role/)).toBeEnabled()
  if (roleId) await dialog.getByLabel(/^Existing role/).selectOption(roleId)
  await expect(dialog.getByLabel('Search permissions', { exact: true })).toHaveCount(1)
  return dialog
}

for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`users, account form, and role editor fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Users & Roles', exact: true })).toBeVisible()
    const create = page.getByRole('button', { name: 'Add user', exact: true })
    await expect(create).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Manage roles', exact: true })).toHaveCount(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
    if (width <= 800) {
      await expect(
        page.getByRole('table', { name: 'Users & Roles records', exact: true }),
      ).toBeHidden()
      await expect(tableRecordControl(page, 'Acceptance account reader')).toBeVisible()
    } else {
      await expect(
        page.getByRole('table', { name: 'Users & Roles records', exact: true }),
      ).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath(`users-${width}.png`), fullPage: true })
    await create.click()
    const account = page.getByRole('dialog', { name: 'Create user account', exact: true })
    await expect(account.getByLabel(/^Role/)).toBeEnabled()
    await checkBounds(page, account)
    await expect(account.getByLabel(/^Name/)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(account.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(account.getByRole('button', { name: 'Create account', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(account.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(account.getByLabel(/^Name/)).toBeFocused()
    const accountRole = account.getByLabel(/^Role/)
    const globalAccessNotice = account.getByText(
      'Administrator accounts have company-wide branch access.',
      { exact: true },
    )
    await accountRole.selectOption(fixtures.accountReaderRoleId)
    await expect(globalAccessNotice).toHaveCount(0)
    await accountRole.selectOption(fixtures.administratorRoleId)
    await expect(globalAccessNotice).toBeVisible()
    await accountRole.selectOption(fixtures.accountReaderRoleId)
    await expect(globalAccessNotice).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`account-form-${width}.png`) })
    await page.keyboard.press('Escape')
    const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await expect(discard).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(discard).toBeHidden()
    await expect(account).toBeVisible()
    await account.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(account).toBeHidden()
    await expect(create).toBeFocused()
    const role = await openRoles(page, fixtures.accountReaderRoleId)
    await expect(role.getByLabel('Search permissions', { exact: true })).toBeVisible()
    await checkBounds(page, role)
    await role.getByLabel('Search permissions', { exact: true }).fill('users')
    await expect(role.getByRole('checkbox', { name: 'Read users', exact: true })).toBeVisible()
    await expect(role.getByRole('checkbox', { name: 'Read inventory', exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`role-editor-${width}.png`) })
    const permissionSearch = role.getByLabel('Search permissions', { exact: true })
    await permissionSearch.fill('')
    await expect(permissionSearch).toHaveValue('')
    await expect(role).toBeVisible()
    await role.getByRole('button', { name: 'Cancel', exact: true }).click()
    if (await discard.isVisible()) {
      await discard.getByRole('button', { name: 'Discard', exact: true }).click()
    }
    await expect(role).toBeHidden()
    await expect(page.getByRole('button', { name: 'Manage roles', exact: true })).toBeFocused()
  })
}

for (const width of [390, 1280]) {
  test(`create, edit, deactivate, reactivate, and reset an account at ${width}px`, async ({
    page,
    browser,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await page.goto('/users')
    await page.getByRole('button', { name: 'Add user', exact: true }).click()
    const account = page.getByRole('dialog', { name: 'Create user account', exact: true })
    const originalName = `Acceptance lifecycle user ${width}`
    const email = `lifecycle-${width}@example.invalid`
    await account.getByLabel(/^Name/).fill(originalName)
    await account.getByLabel(/^Email/).fill(email)
    await account.getByLabel(/^Initial password/).fill(temporaryPassword)
    await account.getByLabel(/^Confirm initial password/).fill(temporaryPassword)
    await account.getByLabel(/^Role/).selectOption(fixtures.accountReaderRoleId)
    await account.getByLabel(/^Branch/).selectOption(fixtures.branchId)
    await account.getByLabel(/^Confirm initial password/).fill(`${temporaryPassword}-mismatch`)
    await account.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(account.getByText('Passwords do not match.', { exact: true })).toBeVisible()
    await expect(account.getByLabel(/^Confirm initial password/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await account.getByLabel(/^Confirm initial password/).fill(temporaryPassword)
    const created = page.waitForResponse(
      (response) => response.url() === `${apiUrl}/users` && response.request().method() === 'POST',
    )
    await account.getByRole('button', { name: 'Create account', exact: true }).click()
    const creation = await created
    expect(creation.status()).toBe(201)
    const user = (await creation.json()) as { id: string }
    await expect(account).toBeHidden()

    const session = await browser.newContext()
    const targetPage = await session.newPage()
    try {
      await login(targetPage, email, temporaryPassword, false)
      let detail = await openUser(page, originalName)
      await checkBounds(page, detail)
      await expect(
        detail.getByRole('heading', { name: 'Access and permissions', exact: true }),
      ).toBeVisible()
      const listStatusColors = await colors(page.locator('.table-card .status-badge.good').first())
      const detailStatusColors = await colors(detail.locator('.status-badge.good'))
      expect(detailStatusColors).toEqual(listStatusColors)
      expect(
        contrastRatio(detailStatusColors.foreground, detailStatusColors.background),
      ).toBeGreaterThanOrEqual(4.5)
      const dangerColors = await colors(
        detail.getByRole('button', { name: 'Deactivate account', exact: true }),
      )
      expect(
        contrastRatio(dangerColors.foreground, dangerColors.background),
      ).toBeGreaterThanOrEqual(4.5)
      await page.screenshot({ path: testInfo.outputPath(`account-detail-${width}.png`) })
      await detail.getByRole('button', { name: 'Edit account', exact: true }).click()
      const edit = page.getByRole('dialog', { name: 'Edit user account', exact: true })
      await expect(edit.getByLabel(/^Email/)).toBeDisabled()
      await expect(edit.getByLabel(/^Initial password/)).toHaveCount(0)
      await expect(edit.getByLabel(/^Role/)).toBeEnabled()
      await expect(edit.getByLabel(/^Role/)).toHaveValue(fixtures.accountReaderRoleId)
      await expect(edit.getByLabel(/^Branch/)).toHaveValue(fixtures.branchId)
      const editedName = `${originalName} updated`
      await edit.getByLabel(/^Name/).fill(editedName)
      await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(edit).toBeHidden()
      detail = await openUser(page, editedName)
      const saved = await api<{ user: { name: string } }>(page.request, `/users/${user.id}`)
      expect(saved.user.name).toBe(editedName)
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(200)

      await detail.getByRole('button', { name: 'Deactivate account', exact: true }).click()
      const deactivate = page.getByRole('dialog', { name: 'Deactivate user account?', exact: true })
      await deactivate.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect(deactivate).toBeHidden()
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(401)
      await targetPage.reload()
      await expect(targetPage).toHaveURL(/\/login$/)
      const inactiveLogin = await session.request.post(`${apiUrl}/auth/login`, {
        data: { email, password: temporaryPassword },
      })
      expect(inactiveLogin.status()).toBe(401)

      detail = await openUser(page, editedName)
      await expect(detail.getByText('Inactive', { exact: true })).toBeVisible()
      await detail.getByRole('button', { name: 'Activate account', exact: true }).click()
      const activate = page.getByRole('dialog', { name: 'Reactivate user account?', exact: true })
      await activate.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect(activate).toBeHidden()
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(401)
      await login(targetPage, email, temporaryPassword, false)
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(200)

      detail = await openUser(page, editedName)
      await detail.getByRole('button', { name: 'Reset password', exact: true }).click()
      const reset = page.getByRole('dialog', { name: 'Reset user password', exact: true })
      const newPassword = `${temporaryPassword}-reset`
      await reset.getByLabel(/^New password/).fill(newPassword)
      await reset.getByLabel(/^Confirm new password/).fill(newPassword)
      await checkBounds(page, reset)
      await reset.getByRole('button', { name: 'Reset password', exact: true }).click()
      await expect(reset).toBeHidden()
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(401)
      const oldPassword = await session.request.post(`${apiUrl}/auth/login`, {
        data: { email, password: temporaryPassword },
      })
      expect(oldPassword.status()).toBe(401)
      await targetPage.reload()
      await expect(targetPage).toHaveURL(/\/login$/)
      await login(targetPage, email, newPassword, false)
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(200)
      detail = await openUser(page, editedName)
      await expect(
        detail.getByRole('heading', { name: 'Record history', exact: true }),
      ).toBeVisible()
      await expect(detail.getByText(/reset user password/i)).toBeVisible()

      await detail.getByRole('button', { name: 'Delete account', exact: true }).click()
      const deleteConfirmation = page.getByRole('dialog', {
        name: 'Delete user account?',
        exact: true,
      })
      await checkBounds(page, deleteConfirmation)
      await expect(
        deleteConfirmation.getByText(
          /account email, audit, and business history will be retained/i,
        ),
      ).toBeVisible()
      await expect(deleteConfirmation.getByText(/email cannot be reused/i)).toBeVisible()
      const deletion = page.waitForResponse(
        (response) =>
          response.url() === `${apiUrl}/users/${user.id}` &&
          response.request().method() === 'DELETE',
      )
      await deleteConfirmation.getByRole('button', { name: 'Delete account', exact: true }).click()
      expect((await deletion).status()).toBe(200)
      await expect(deleteConfirmation).toBeHidden()
      await expect(tableRecordControl(page, editedName)).toHaveCount(0)
      expect((await session.request.get(`${apiUrl}/auth/me`)).status()).toBe(401)
      await targetPage.reload()
      await expect(targetPage).toHaveURL(/\/login$/)
      const deletedLogin = await session.request.post(`${apiUrl}/auth/login`, {
        data: { email, password: newPassword },
      })
      expect(deletedLogin.status()).toBe(401)
    } finally {
      await session.close()
    }
  })
}

for (const width of [390, 1280]) {
  test(`create, edit, inspect assignment, and delete roles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await page.goto('/users')
    let editor = await openRoles(page)
    await editor.getByRole('button', { name: 'New role', exact: true }).click()
    await expect(editor.getByLabel('Search permissions', { exact: true })).toHaveCount(1)
    const name = `Acceptance custom role ${width}`
    await editor.getByLabel(/^Role name/).fill(name)
    await editor.getByLabel('Description', { exact: true }).fill('Verified browser acceptance role')
    await editor.getByLabel('Search permissions', { exact: true }).fill('users')
    await editor.getByRole('checkbox', { name: 'Read users', exact: true }).check()
    const created = page.waitForResponse(
      (response) => response.url() === `${apiUrl}/roles` && response.request().method() === 'POST',
    )
    await editor.getByRole('button', { name: 'Create role', exact: true }).click()
    const creation = await created
    expect(creation.status()).toBe(201)
    const role = (await creation.json()) as { id: string }
    await expect(editor).toBeHidden()
    let saved = (await api<Role[]>(page.request, '/roles')).find((value) => value.id === role.id)!
    expect(saved.permissions).toEqual(['users.read'])

    editor = await openRoles(page, role.id)
    await editor.getByLabel(/^Role name/).fill(`${name} edited`)
    await editor.getByLabel('Search permissions', { exact: true }).fill('users')
    await editor.getByRole('checkbox', { name: 'Create users', exact: true }).check()
    await editor.getByRole('button', { name: 'Save role', exact: true }).click()
    await expect(editor).toBeHidden()
    saved = (await api<Role[]>(page.request, '/roles')).find((value) => value.id === role.id)!
    expect(saved.name).toBe(`${name} edited`)
    expect([...saved.permissions].sort()).toEqual(['users.create', 'users.read'])

    editor = await openRoles(page, role.id)
    await editor.getByRole('button', { name: 'Delete role', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: 'Delete this role?', exact: true })
    const deleted = page.waitForResponse(
      (response) =>
        response.url() === `${apiUrl}/roles/${role.id}` && response.request().method() === 'DELETE',
    )
    await confirmation.getByRole('button', { name: 'Delete role', exact: true }).click()
    expect((await deleted).status()).toBe(200)
    await expect(confirmation).toBeHidden()
    expect((await api<Role[]>(page.request, '/roles')).some((value) => value.id === role.id)).toBe(
      false,
    )

    editor = await openRoles(page, fixtures.accountReaderRoleId)
    await expect(editor.getByText(/\d+ assigned users?/)).toBeVisible()
    const inUseDelete = editor.getByRole('button', { name: 'Delete role', exact: true })
    await expect(inUseDelete).toBeDisabled()
    const forbiddenDelete = await page.request.delete(
      `${apiUrl}/roles/${fixtures.accountReaderRoleId}`,
    )
    expect(forbiddenDelete.status()).toBe(409)
    await editor.getByRole('button', { name: 'Close dialog', exact: true }).click()
  })
}

for (const email of ['account-reader@example.invalid', 'branch-manager@example.invalid']) {
  test(`${email} cannot access Management through navigation, direct URLs, or APIs`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await login(page, email)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
    await expect(drawer.getByRole('link', { name: 'Users & roles', exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('link', { name: 'Branches', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    for (const path of ['/users', '/branches']) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { name: 'Access restricted', exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add user', exact: true })).toHaveCount(0)
    }
    for (const path of ['/users', '/users/options', '/roles', '/branches']) {
      expect((await page.request.get(`${apiUrl}${path}`)).status()).toBe(403)
    }
    expect(
      (
        await page.request.patch(`${apiUrl}/users/${fixtures.branchManagerUserId}`, {
          data: { status: 'Inactive' },
        })
      ).status(),
    ).toBe(403)
  })
}

test('user records expose loading, recoverable errors, filter empty, and pagination', async ({
  page,
}) => {
  await login(page)
  let releaseList: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    releaseList = resolve
  })
  let releaseSearch: (() => void) | undefined
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })
  let delaySearch = false
  let fail = true
  await page.route(/\/api\/v1\/users(\?|$)/, async (route) => {
    await pending
    if (delaySearch && new URL(route.request().url()).searchParams.get('search')) {
      await pendingSearch
    }
    if (fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'ACCEPTANCE_UNAVAILABLE', message: 'Temporary test interruption.' },
        }),
      })
    } else await route.continue()
  })
  try {
    await page.goto('/users')
    await expect(page.getByText('Loading users…', { exact: true })).toBeVisible()
  } finally {
    releaseList!()
  }
  await expect(page.getByText('Could not load users.', { exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(
    page.getByRole('table', { name: 'Users & Roles records', exact: true }),
  ).toBeVisible()
  const search = page.getByLabel('Search Users & Roles', { exact: true })
  const firstSearch = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname.endsWith('/users') &&
      url.searchParams.get('search') === 'No such acceptance account'
    )
  })
  delaySearch = true
  try {
    await search.fill('No such acceptance account')
    await firstSearch
    await expect(search).toBeFocused()
    await expect(
      page.getByRole('region', { name: 'Users & Roles records', exact: true }),
    ).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('button', { name: 'Export page', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
    const continuedSearch = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return (
        url.pathname.endsWith('/users') &&
        url.searchParams.get('search') === 'No such acceptance account!'
      )
    })
    await search.press('End')
    await search.press('!')
    await continuedSearch
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('No such acceptance account!')
  } finally {
    delaySearch = false
    releaseSearch!()
  }
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('No such acceptance account!')
  await page.getByLabel('Search Users & Roles', { exact: true }).fill('')
  await expect(tableRecordControl(page, 'Acceptance account reader')).toBeVisible()
  await page.getByLabel('Filter by status', { exact: true }).selectOption('Active')
  await expect(page.getByLabel('Filter by status', { exact: true })).toHaveValue('Active')
  await page.getByLabel('Rows per page', { exact: true }).selectOption('10')
  await expect(page.getByLabel('Rows per page', { exact: true })).toHaveValue('10')
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  // Other accepted workflows create real users in this disposable database.
  // Verify pagination against the current scoped count instead of a fixed fixture size.
  const activeUsers = await api<{ total: number }>(page.request, '/users?status=Active&limit=10')
  const lastPage = Math.ceil(activeUsers.total / 10)
  expect(lastPage).toBeGreaterThan(1)
  for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
    await page.getByRole('button', { name: 'Next page', exact: true }).click()
    await expect(page.getByText(`Page ${pageNumber} of ${lastPage}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeEnabled()
  }
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  for (let pageNumber = lastPage - 1; pageNumber >= 1; pageNumber -= 1) {
    await page.getByRole('button', { name: 'Previous page', exact: true }).click()
    await expect(page.getByText(`Page ${pageNumber} of ${lastPage}`, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Name', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  const sorted = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname.endsWith('/users') &&
      url.searchParams.get('sort') === 'Name' &&
      url.searchParams.get('order') === 'desc'
    )
  })
  await page.getByRole('button', { name: 'Name', exact: true }).click()
  const sortedRows = (await (await sorted).json()) as { data: { Name: string }[] }
  const names = sortedRows.data.map((row) => row.Name)
  expect(names).toEqual([...names].sort((left, right) => right.localeCompare(left)))
  await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
})

test('account options failures recover without erasing entered values', async ({ page }) => {
  await login(page)
  let fail = true
  await page.route('**/api/v1/users/options', async (route) => {
    if (fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'ACCEPTANCE_UNAVAILABLE', message: 'Options temporarily unavailable.' },
        }),
      })
    } else await route.continue()
  })
  await page.goto('/users')
  await page.getByRole('button', { name: 'Add user', exact: true }).click()
  const account = page.getByRole('dialog', { name: 'Create user account', exact: true })
  await account.getByLabel(/^Name/).fill('Unsaved acceptance name')
  await account.getByLabel(/^Email/).fill('unsaved@example.invalid')
  await expect(account.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(account.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled()
  fail = false
  await account.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(account.getByLabel(/^Role/)).toBeEnabled()
  await expect(account.getByLabel(/^Name/)).toHaveValue('Unsaved acceptance name')
  await expect(account.getByLabel(/^Email/)).toHaveValue('unsaved@example.invalid')
})
