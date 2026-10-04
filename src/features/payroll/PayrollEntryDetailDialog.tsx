import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { QueryState } from '@/components/common/QueryState'
import { getPayrollEntry } from './payroll.api'
import { PayrollEntryCard } from './PayrollEntryCard'

export function PayrollEntryDetailDialog({
  id,
  permissions,
  onClose,
  onRun,
}: {
  id: string
  permissions: string[]
  onClose: () => void
  onRun: (id: string) => void
}) {
  const client = useQueryClient()
  const detail = useQuery({ queryKey: ['payroll-entry', id], queryFn: () => getPayrollEntry(id) })
  const entry = detail.data?.entry
  async function refresh() {
    await Promise.all(
      [
        ['payroll-entry', id],
        ['payroll-ledger'],
        ['module', 'payroll'],
        ['payroll-run'],
        ['proofs', 'payroll-entry', id],
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    )
  }
  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={entry ? `${entry.employeeName} · Payroll` : 'Employee payroll'}
      description={
        entry ? `${entry.periodStart} to ${entry.periodEnd} · ${entry.branchName}` : undefined
      }
      size="lg"
    >
      <QueryState
        loading={detail.isPending}
        error={detail.error}
        onRetry={() => void detail.refetch()}
      >
        {entry && (
          <>
            <PayrollEntryCard
              entry={entry}
              runStatus={entry.runStatus}
              period={`${entry.periodStart} to ${entry.periodEnd}`}
              permissions={permissions}
              onChanged={refresh}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => onRun(entry.runId)}
              >
                View pay run {entry.runReference}
              </button>
            </div>
          </>
        )}
      </QueryState>
    </AppDialog>
  )
}
