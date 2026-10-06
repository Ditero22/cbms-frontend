import type { QueryClient } from '@tanstack/react-query'

/** Run edits and processing change both the display and the editable projection. */
export function invalidatePayrollRun(client: QueryClient, runId?: string | null) {
  return Promise.all(
    [
      ['module', 'payroll'],
      ['payroll-ledger'],
      ['payroll-entry'],
      runId ? ['payroll-run', runId] : ['payroll-run'],
      runId ? ['payroll-run-edit', runId] : ['payroll-run-edit'],
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  )
}
