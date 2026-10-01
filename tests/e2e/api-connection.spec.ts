import { expect, test, type Page, type Route } from '@playwright/test'

const dashboardRoute = '**/api/v1/dashboard/summary'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill('administrator@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill(process.env.CBMS_E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

const failures: {
  name: string
  respond: (route: Route) => Promise<void>
  message: string
}[] = [
  {
    name: 'backend cannot be reached',
    respond: (route) => route.abort('connectionrefused'),
    message: 'The backend could not be reached. Check your connection and try again.',
  },
  {
    name: 'server failure',
    respond: (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Database exception details' },
        }),
      }),
    message: 'The server could not complete this request. Please try again.',
  },
  {
    name: 'service temporarily unavailable',
    respond: (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    message: 'The service is temporarily unavailable. Please try again shortly.',
  },
  {
    name: 'pending database migrations',
    respond: (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'DATABASE_MIGRATIONS_REQUIRED' } }),
      }),
    message:
      'The workspace database needs an update. Ask your administrator to apply the pending migrations.',
  },
  {
    name: 'HTML received instead of API JSON',
    respond: (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    message:
      'The server returned an invalid response. Try again; if this continues, contact your administrator.',
  },
  {
    name: 'malformed API JSON',
    respond: (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }),
    message:
      'The server returned an invalid response. Try again; if this continues, contact your administrator.',
  },
  {
    name: 'unexpected dashboard payload',
    respond: (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"stats":{}}' }),
    message:
      'The server returned an invalid response. Try again; if this continues, contact your administrator.',
  },
]

for (const failure of failures) {
  test(`dashboard distinguishes ${failure.name} and recovers real data`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    let fail = true
    await page.route(dashboardRoute, (route) => (fail ? failure.respond(route) : route.continue()))
    await login(page)
    const alert = page.getByRole('alert').filter({ hasText: 'We couldn’t load the dashboard.' })
    await expect(alert).toContainText(failure.message)
    await expect(page.getByText('Database exception details', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )

    fail = false
    const response = page.waitForResponse((result) => result.url().endsWith('/dashboard/summary'))
    await alert.getByRole('button', { name: 'Try again', exact: true }).click()
    expect((await response).status()).toBe(200)
    await expect(page.locator('.dashboard-grid')).toBeVisible()
    await expect(alert).toHaveCount(0)
  })
}

test('forbidden dashboard preserves the session and explains the permission restriction', async ({
  page,
}) => {
  await page.route(dashboardRoute, (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }),
  )
  await login(page)
  const alert = page.getByRole('alert').filter({ hasText: 'We couldn’t load the dashboard.' })
  await expect(alert).toContainText('You do not have permission to access this information.')
  await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  await expect(page.getByLabel('Work email')).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('an expired protected request returns to sign-in with a session explanation', async ({
  page,
}) => {
  await login(page)
  await expect(page.locator('.dashboard-grid')).toBeVisible()
  await page.route(dashboardRoute, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByText('Your session has expired. Sign in again.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Work email')).toBeVisible()
})

test('session service failure is distinct from being signed out and can be retried', async ({
  page,
}) => {
  let fail = true
  await page.route('**/api/v1/auth/me', (route) =>
    fail
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
      : route.continue(),
  )
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Unable to connect to your workspace' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('The service is temporarily unavailable.')
  await expect(page.getByLabel('Work email')).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByLabel('Work email')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('a temporary session recheck failure preserves authenticated navigation', async ({ page }) => {
  await login(page)
  await expect(page.locator('.dashboard-grid')).toBeVisible()
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  )
  const checked = page.waitForResponse(
    (response) => response.url().endsWith('/auth/me') && response.status() === 500,
  )
  await page.evaluate(() => {
    // Headless Chromium keeps tabs visible. Exercise the browser visibility
    // state/event boundary, including the bubbling native events use.
    const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    let visibilityState: DocumentVisibilityState = 'hidden'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    try {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
      visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    } finally {
      if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor)
      else Reflect.deleteProperty(document, 'visibilityState')
    }
  })
  await checked
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('.dashboard-grid')).toBeVisible()
  await expect(page.getByLabel('Work email')).toHaveCount(0)
})

test('a malformed session payload is an API failure rather than a signed-out state', async ({
  page,
}) => {
  let fail = true
  await page.route('**/api/v1/auth/me', (route) =>
    fail
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"user":{}}' })
      : route.continue(),
  )
  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('The server returned an invalid response.')
  await expect(page.getByLabel('Work email')).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByLabel('Work email')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
