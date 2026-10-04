import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatPeso } from '@/features/modules/order-decimals'
import { getExpenseDetail } from './expenses.api'
import { formatExpenseDate } from './expense.utils'
import { ExpenseSourcePanel } from './ExpenseSourcePanel'
import { QueryState } from '@/components/common/QueryState'
import type { ExpenseRecord } from './types'

export function ExpenseDetailDialog({
  id,
  open,
  permissions,
  onClose,
  onReview,
}: {
  id: string
  open: boolean
  permissions: string[]
  onClose: () => void
  onReview: (expense: ExpenseRecord, decision: 'Approved' | 'Rejected') => void
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const query = useQuery({
    queryKey: ['expense-detail', id, historyPage],
    queryFn: () => getExpenseDetail(id, historyPage),
    placeholderData: (previous) => previous,
  })
  const expense = query.data?.expense
  const review = query.data?.review
  const canReview = expense?.status === 'Pending' && permissions.includes('expenses.approve')
  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={expense?.description ?? 'Expense details'}
      description="Recorded branch expense and its review decision."
      size="lg"
    >
      <QueryState
        loadingMessage="Loading expenses…"
        errorTitle="Could not load expenses."
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {expense && query.data && (
          <>
            <div className="expense-overview">
              <div>
                <span>Amount</span>
                <strong>{formatPeso(expense.amount)}</strong>
              </div>
              <StatusBadge value={expense.status} />
            </div>
            <dl className="expense-details">
              <div>
                <dt>Category</dt>
                <dd>{expense.category}</dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{expense.branchName}</dd>
              </div>
              <div>
                <dt>Submitted by</dt>
                <dd>{expense.submittedByName}</dd>
              </div>
              <div>
                <dt>Submitted on</dt>
                <dd>{formatExpenseDate(expense.createdAt)}</dd>
              </div>
            </dl>
            {review ? (
              <section className="expense-review" aria-label="Expense review">
                <div className="expense-section-heading">
                  <h3>Expense review</h3>
                </div>
                <dl className="expense-details">
                  <div>
                    <dt>Reviewed by</dt>
                    <dd>{review.reviewerName || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Reviewed on</dt>
                    <dd>{formatExpenseDate(review.reviewedAt)}</dd>
                  </div>
                  <div className="expense-detail-wide">
                    <dt>Review note</dt>
                    <dd>{review.note || 'No review note recorded.'}</dd>
                  </div>
                </dl>
              </section>
            ) : (
              <p className="form-helper">
                {expense.status === 'Pending'
                  ? 'This expense is awaiting review.'
                  : 'Review details were not recorded for this historical expense.'}
              </p>
            )}
            {query.data.source && <ExpenseSourcePanel source={query.data.source} />}
            {permissions.includes('audit.read') && (
              <RecordHistoryPanel
                entries={query.data.history}
                page={query.data.historyPage}
                pageSize={query.data.historyPageSize}
                total={query.data.historyTotal}
                busy={query.isFetching}
                onPageChange={setHistoryPage}
              />
            )}
            <div className="dialog-actions">
              {canReview && (
                <>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => onReview(expense, 'Rejected')}
                  >
                    Reject expense
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => onReview(expense, 'Approved')}
                  >
                    Approve expense
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </QueryState>
    </AppDialog>
  )
}
