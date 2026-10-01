import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const localBrowser =
  process.platform === 'win32'
    ? [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      ].find(existsSync)
    : undefined

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.CBMS_E2E_BASE_URL ?? 'http://127.0.0.1:5180',
    viewport: { width: 1280, height: 900 },
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || localBrowser,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
