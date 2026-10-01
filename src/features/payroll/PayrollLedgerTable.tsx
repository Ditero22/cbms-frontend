import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/common/DataTable'
import { QueryState } from '@/components/common/QueryState'
import { modules, type ModuleDefinition } from '@/features/modules/modules'
import { formatPeso } from '@/features/modules/order-decimals'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { getPayrollLedger } from './payroll.api'

const ledgerModule: ModuleDefinition = {
  ...modules.find((module) => module.id === 'payroll')!,
  title: 'Employee payroll',
  columns: [
    'Employee',
    'Employee ID',
    'Branch',
    'Position',
    'Period',
    'Regular pay',
    'Allowance',
    'Deductions',
    'Net pay',
    'Payment status',
  ],
  mobileColumns: [
    'Employee ID',
    'Branch',
    'Period',
    'Regular pay',
    'Allowance',
    'Deductions',
    'Net pay',
  ],
  sortableColumns: ['Employee', 'Period', 'Net pay', 'Payment status'],
}
const sorting: Record<string, string> = {
  Employee: 'employee',
  Period: 'period',
  'Net pay': 'netPay',
  'Payment status': 'paymentStatus',
}

export function PayrollLedgerTable({ onOpen }: { onOpen: (id: string) => void }) {
  const runtime = useModuleRuntime()
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: 'Employee',
    order: 'asc',
  })
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const invalidPeriod = Boolean(periodStart && periodEnd && periodStart > periodEnd)
  const ledger = useQuery({
    queryKey: ['payroll-ledger', query, periodStart, periodEnd],
    queryFn: () =>
      getPayrollLedger({
        page: query.page,
        limit: query.limit,
        search: query.search,
        branchId: query.branchId,
        paymentStatus: query.status || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        sort: sorting[query.sort],
        order: query.order,
      }),
    enabled: !invalidPeriod,
    placeholderData: (previous) => previous,
  })
  return (
    <>
      <div className="payroll-period-filters" role="group" aria-label="Payroll period filters">
        <label className="field-label">
          <span>Period from</span>
          <input
            className="form-input"
            type="date"
            value={periodStart}
            max={periodEnd || undefined}
            onChange={(event) => {
              setPeriodStart(event.target.value)
              setQuery((current) => ({ ...current, page: 1 }))
            }}
          />
        </label>
        <label className="field-label">
          <span>Period through</span>
          <input
            className="form-input"
            type="date"
            value={periodEnd}
            min={periodStart || undefined}
            onChange={(event) => {
              setPeriodEnd(event.target.value)
              setQuery((current) => ({ ...current, page: 1 }))
            }}
          />
        </label>
        {(periodStart || periodEnd) && (
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setPeriodStart('')
              setPeriodEnd('')
              setQuery((current) => ({ ...current, page: 1 }))
            }}
          >
            Clear period
          </button>
        )}
      </div>
      {invalidPeriod && (
        <p className="field-error" role="alert">
          The period end must be on or after the period start.
        </p>
      )}
      <QueryState
        loading={ledger.isPending && !invalidPeriod}
        error={ledger.error}
        loadingMessage="Loading employee payroll…"
        onRetry={() => void ledger.refetch()}
      >
        <DataTable
          module={ledgerModule}
          rows={
            ledger.data?.items.map((entry) => ({
              id: entry.id,
              Employee: entry.employeeName,
              'Employee ID': entry.employeeNumber,
              Branch: entry.branchName,
              Position: entry.position,
              Period: `${entry.periodStart} to ${entry.periodEnd}`,
              'Regular pay': formatPeso(entry.regularPay),
              Allowance: formatPeso(entry.allowancePay),
              Deductions: formatPeso(entry.deductions),
              'Net pay': formatPeso(entry.netPay),
              'Payment status': entry.paymentStatus,
            })) ?? []
          }
          total={ledger.data?.total ?? 0}
          statusOptions={['Pending', 'Paid', 'Received']}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => onOpen(row.id)}
          branchOptions={
            ledger.data?.branches.map((branch) => ({ value: branch.id, label: branch.name })) ?? []
          }
          isCrossBranch={runtime.isCrossBranch}
          busy={ledger.isFetching}
        />
      </QueryState>
    </>
  )
}
