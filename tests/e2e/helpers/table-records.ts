import { type Locator, type Page } from '@playwright/test'

export function tableRecordControl(page: Page, recordName: string): Locator {
  if ((page.viewportSize()?.width ?? 1280) <= 800) {
    return page.getByRole('button', { name: `View details for ${recordName}`, exact: true })
  }
  return page.getByRole('row', { name: `Open ${recordName} record`, exact: true })
}

export async function openTableRecord(page: Page, recordName: string) {
  await tableRecordControl(page, recordName).click()
}
