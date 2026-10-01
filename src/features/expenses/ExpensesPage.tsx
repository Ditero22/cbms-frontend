import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { getModuleRecords } from '@/features/modules/modules.api'
import { modules } from '@/features/modules/modules'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { createExpense, reviewExpense } from './expenses.api'
import { CreateExpenseDialog } from './CreateExpenseDialog'
import { ExpenseDetailDialog } from './ExpenseDetailDialog'
import { ExpenseReviewDialog } from './ExpenseReviewDialog'
import { QueryState } from '@/components/common/QueryState'
import { useExpenseMutation } from './useExpenseMutation'
import type { ExpenseRecord } from './types'
import './expenses.css'

const module = modules.find((candidate) => candidate.id === 'expenses')!
export function ExpensesPage() {
  const runtime = useModuleRuntime()
  const mutation = useExpenseMutation()
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [review, setReview] = useState<{
    expense: ExpenseRecord
    decision: 'Approved' | 'Rejected'
  } | null>(null)
  const records = useQuery({
    queryKey: ['module', 'expenses', query],
    queryFn: () => getModuleRecords('expenses', query),
    placeholderData: (previous) => previous,
  })
  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: module.group },
          { label: 'Expenses' },
        ]}
      />
      <PageHeading title={module.title} description={module.description}>
        {runtime.permissions.includes('expenses.create') && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              mutation.clearError()
              setCreateOpen(true)
            }}
          >
            <Plus size={16} aria-hidden="true" />
            New expense
          </button>
        )}
      </PageHeading>
      <QueryState
        loadingMessage="Loading expenses…"
        errorTitle="Could not load expenses."
        loading={records.isPending}
        error={records.error}
        onRetry={() => void records.refetch()}
      >
        <DataTable
          module={module}
          rows={records.data?.data ?? []}
          total={records.data?.total ?? 0}
          statusOptions={records.data?.statusOptions ?? []}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => setSelectedId(row.id)}
          busy={records.isFetching}
        />
      </QueryState>
      {selectedId && (
        <ExpenseDetailDialog
          key={selectedId}
          id={selectedId}
          open={!review && !createOpen}
          permissions={runtime.permissions}
          onClose={() => setSelectedId(null)}
          onReview={(expense, decision) => {
            mutation.clearError()
            setReview({ expense, decision })
          }}
        />
      )}
      <CreateExpenseDialog
        open={createOpen}
        busy={mutation.busy}
        error={mutation.error}
        onClose={() => setCreateOpen(false)}
        onSave={(values) =>
          mutation.run(() => createExpense(values), 'Expense recorded for review.')
        }
      />
      {review && (
        <ExpenseReviewDialog
          expense={review.expense}
          decision={review.decision}
          busy={mutation.busy}
          error={mutation.error}
          alreadyReviewed={mutation.alreadyReviewed}
          onClose={() => setReview(null)}
          onSave={(note) =>
            mutation.run(
              () => reviewExpense(review.expense.id, review.decision, note),
              `Expense ${review.decision.toLowerCase()}.`,
            )
          }
        />
      )}
    </>
  )
}
