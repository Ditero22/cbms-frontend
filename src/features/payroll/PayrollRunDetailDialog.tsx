import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { QueryState } from '@/components/common/QueryState'
import { RecordPagination } from '@/components/common/RecordPagination'
import { StatusInline } from '@/components/common/StatusInline'
import { formatPeso } from '@/features/modules/order-decimals'
import { getPayrollRunDetail, processPayrollRun } from './payroll.api'
import { PayrollEntryCard } from './PayrollEntryCard'
import { invalidatePayrollRun } from './payroll-cache'

export function PayrollRunDetailDialog({
  runId,
  permissions,
  onClose,
  onEdit,
  onChanged,
}: {
  runId: string
  permissions: string[]
  onClose: () => void
  onEdit: (runId: string) => void
  onChanged: () => void
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const detail = useQuery({
    queryKey: ['payroll-run', runId, page],
    queryFn: () => getPayrollRunDetail(runId, page),
  })
  const run = detail.data?.run
  async function refresh() {
    await Promise.all([
      invalidatePayrollRun(client, runId),
      client.invalidateQueries({ queryKey: ['proofs', 'payroll-entry'] }),
    ])
    onChanged()
  }
  async function process() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await processPayrollRun(runId)
      await refresh()
      setConfirming(false)
      toast.success('Pay run processed and locked.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The pay run could not be processed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AppDialog
        open
        onOpenChange={(open) => !open && !busy && onClose()}
        title={run ? `${run.reference} · Payroll` : 'Payroll details'}
        description={
          run
            ? `${run.periodStart} to ${run.periodEnd}${run.branchName ? ` · ${run.branchName}` : ''}`
            : undefined
        }
        size="lg"
      >
        <QueryState
          loading={detail.isPending}
          loadingMessage="Loading pay run…"
          error={detail.error}
          errorTitle="Could not load this pay run."
          onRetry={() => void detail.refetch()}
        >
          {run && detail.data && (
            <div className="payroll-detail">
              <div className="payroll-run-summary">
                <div>
                  <span>Employees</span>
                  <strong>{run.employeeCount}</strong>
                </div>
                <div>
                  <span>Gross pay</span>
                  <strong>{formatPeso(run.grossPay)}</strong>
                </div>
                <div>
                  <span>Run status</span>
                  <StatusInline status={run.status} />
                </div>
                <div>
                  <span>Processed</span>
                  <strong>
                    {run.processedAt
                      ? new Date(run.processedAt).toLocaleString('en-PH')
                      : 'Not processed'}
                  </strong>
                </div>
              </div>
              <div className="payroll-section-heading">
                <div>
                  <h3>Employee pay</h3>
                  <p>Individual regular pay, adjustments, payment, and receipt status.</p>
                </div>
                <div className="payroll-entry-actions">
                  {run.status === 'Draft' &&
                    detail.data.totalEntries > 0 &&
                    permissions.includes('payroll.update') && (
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={busy}
                        onClick={() => onEdit(runId)}
                      >
                        Edit draft
                      </button>
                    )}
                  {run.status === 'Draft' &&
                    detail.data.totalEntries > 0 &&
                    permissions.includes('payroll.process') && (
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={busy}
                        onClick={() => {
                          setError('')
                          setConfirming(true)
                        }}
                      >
                        Process pay run
                      </button>
                    )}
                </div>
              </div>
              {detail.data.entries.length ? (
                <div className="payroll-entry-list">
                  {detail.data.entries.map((entry) => (
                    <PayrollEntryCard
                      key={entry.id}
                      entry={entry}
                      runStatus={run.status}
                      period={`${run.periodStart} to ${run.periodEnd}`}
                      permissions={permissions}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              ) : (
                <p className="payroll-inline-state">
                  {run.employeeCount > 0
                    ? 'This historical pay run has a summary header only; employee-level pay lines were not recorded. It is retained for reference and cannot be processed again.'
                    : 'No employee pay lines have been added.'}
                </p>
              )}
              <RecordPagination
                label="Payroll employee entries"
                page={detail.data.page}
                pageSize={detail.data.pageSize}
                total={detail.data.totalEntries}
                busy={detail.isFetching}
                onPageChange={setPage}
              />
            </div>
          )}
        </QueryState>
      </AppDialog>
      <AppDialog
        open={confirming}
        onOpenChange={(open) => !busy && setConfirming(open)}
        title="Process and lock this pay run?"
        description="Processing freezes the listed pay and adjustments. Individual payments can then be recorded against these entries."
      >
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button
            type="button"
            className="button button-primary"
            disabled={busy}
            onClick={() => void process()}
          >
            {busy ? 'Processing…' : 'Process pay run'}
          </button>
        </div>
      </AppDialog>
    </>
  )
}
