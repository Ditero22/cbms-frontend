import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPeso } from '@/features/modules/order-decimals'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { serializeCsv } from '@/utils/csv'
import { StatusBadge } from '@/components/common/StatusBadge'
import { getPayrollLedger } from './payroll.api'
import type { PayrollLedger } from './types'

const sortKeys: Record<string, string> = {
  Employee: 'employee',
  'Payroll period': 'period',
  'Net pay': 'netPay',
  'Payment status': 'paymentStatus',
}
const columns = [
  'Employee',
  'Branch',
  'Payroll period',
  'Gross pay',
  'Deductions',
  'Net pay',
  'Payment status',
]
const statusOptions = ['Pending', 'Paid', 'Received']

function displayAmount(value: string) {
  return formatPeso(value).replace(/\.00$/, '')
}

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function displayPeriod(start: string, end: string) {
  return `${displayDate(start)} – ${displayDate(end)}`
}

function PayrollLedgerSkeleton() {
  return (
    <div className="payroll-ledger-skeleton" role="status" aria-label="Loading employee payroll">
      <span className="sr-only">Loading employee payroll…</span>
      <div className="payroll-ledger-skeleton-table" aria-hidden="true">
        <span className="payroll-ledger-skeleton-head" />
        {Array.from({ length: 5 }, (_, index) => (
          <span className="payroll-ledger-skeleton-row" key={index} />
        ))}
      </div>
      <div className="payroll-ledger-skeleton-cards" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span className="payroll-ledger-skeleton-card" key={index} />
        ))}
      </div>
    </div>
  )
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
  const [searchInput, setSearchInput] = useState('')
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
        sort: sortKeys[query.sort],
        order: query.order,
      }),
    enabled: !invalidPeriod,
    placeholderData: (previous) => previous,
  })
  const lastSuccessfulLedger = useRef<PayrollLedger | undefined>(undefined)
  useEffect(() => {
    if (ledger.data && !ledger.isPlaceholderData) lastSuccessfulLedger.current = ledger.data
  }, [ledger.data, ledger.isPlaceholderData])
  const displayData = invalidPeriod ? undefined : (ledger.data ?? lastSuccessfulLedger.current)
  const totalPages = Math.max(1, Math.ceil((displayData?.total ?? 0) / query.limit))
  const hasFilters = Boolean(
    query.search || query.branchId || query.status || periodStart || periodEnd,
  )

  useEffect(() => {
    setSearchInput(query.search)
  }, [query.search])

  useEffect(() => {
    if (searchInput === query.search) return
    const timeout = window.setTimeout(
      () => setQuery((current) => ({ ...current, page: 1, search: searchInput })),
      250,
    )
    return () => window.clearTimeout(timeout)
  }, [query.search, searchInput])

  function updateQuery(patch: Partial<ModuleListQuery>) {
    setQuery((current) => ({ ...current, page: 1, ...patch }))
  }

  function clearFilters() {
    setSearchInput('')
    setPeriodStart('')
    setPeriodEnd('')
    updateQuery({ search: '', branchId: undefined, status: '' })
  }

  function toggleSort(column: string) {
    setQuery((current) => ({
      ...current,
      page: 1,
      sort: column,
      order: current.sort === column && current.order === 'asc' ? 'desc' : 'asc',
    }))
  }

  function exportCsv() {
    const rows = ledger.data?.items ?? []
    const csv = serializeCsv([
      columns,
      ...rows.map((entry) => [
        `${entry.employeeName} (${entry.employeeNumber})`,
        entry.branchName,
        displayPeriod(entry.periodStart, entry.periodEnd),
        displayAmount(entry.grossPay),
        displayAmount(entry.deductions),
        displayAmount(entry.netPay),
        entry.paymentStatus,
      ]),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'employee-payroll.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success('Your payroll page export is ready.')
  }

  if (ledger.isPending && !invalidPeriod) return <PayrollLedgerSkeleton />
  if (ledger.isError && !displayData)
    return (
      <div className="payroll-ledger-state" role="alert">
        <strong>Could not load employee payroll.</strong>
        <span>{ledger.error.message}</span>
        <button
          type="button"
          className="button button-outline"
          onClick={() => void ledger.refetch()}
        >
          Try again
        </button>
      </div>
    )

  const items = displayData?.items ?? []
  const branches = displayData?.branches ?? []

  return (
    <section className="payroll-ledger" aria-label="Employee payroll" aria-busy={ledger.isFetching}>
      {ledger.isFetching && (
        <span className="sr-only" role="status" aria-live="polite">
          Updating employee payroll…
        </span>
      )}
      <div
        className={`payroll-ledger-filters${runtime.isCrossBranch && branches.length > 0 ? ' has-branch-filter' : ''}`}
      >
        <label className="payroll-ledger-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search employees</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search employees"
            aria-label="Search employees"
          />
        </label>
        {runtime.isCrossBranch && branches.length > 0 && (
          <label className="payroll-ledger-select">
            <span className="sr-only">Branch</span>
            <select
              value={query.branchId ?? ''}
              onChange={(event) => updateQuery({ branchId: event.target.value || undefined })}
              aria-label="Filter payroll by branch"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="payroll-ledger-select">
          <span className="sr-only">Payment status</span>
          <select
            value={query.status}
            onChange={(event) => updateQuery({ status: event.target.value })}
            aria-label="Filter payroll by payment status"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="payroll-ledger-date">
          <span className="sr-only">Period from</span>
          <input
            type="date"
            value={periodStart}
            max={periodEnd || undefined}
            onChange={(event) => {
              setPeriodStart(event.target.value)
              updateQuery({})
            }}
            aria-label="Period from"
          />
        </label>
        <label className="payroll-ledger-date">
          <span className="sr-only">Period through</span>
          <input
            type="date"
            value={periodEnd}
            min={periodStart || undefined}
            onChange={(event) => {
              setPeriodEnd(event.target.value)
              updateQuery({})
            }}
            aria-label="Period through"
          />
        </label>
        <div className="payroll-ledger-actions">
          <button
            type="button"
            className="button button-outline payroll-ledger-export"
            disabled={!items.length}
            onClick={exportCsv}
          >
            <Download size={16} aria-hidden="true" /> Export page
          </button>
          {hasFilters && (
            <button
              type="button"
              className="button button-quiet payroll-ledger-clear"
              onClick={clearFilters}
            >
              <X size={16} aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
      </div>
      {invalidPeriod && (
        <p className="field-error" role="alert">
          The period end must be on or after the period start.
        </p>
      )}
      {ledger.isError && displayData && !invalidPeriod && (
        <div className="payroll-ledger-refresh-error" role="alert">
          <span>Could not refresh payroll. Showing the last loaded results.</span>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void ledger.refetch()}
          >
            Try again
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="payroll-ledger-state" role="status" aria-live="polite">
          <strong>
            {hasFilters || invalidPeriod
              ? 'No matching payroll records'
              : 'No employee payroll yet'}
          </strong>
          <span>
            {invalidPeriod
              ? 'Choose an end date on or after the start date.'
              : hasFilters
                ? 'Try adjusting the search or filters.'
                : 'Processed pay run entries will appear here.'}
          </span>
        </div>
      ) : (
        <>
          <div
            className="payroll-ledger-table-wrap"
            role="region"
            aria-label="Employee payroll table"
            tabIndex={0}
          >
            <table className="payroll-ledger-table">
              <thead>
                <tr>
                  {columns.map((column) => {
                    const sortable = Boolean(sortKeys[column])
                    const isActive = query.sort === column
                    return (
                      <th
                        key={column}
                        scope="col"
                        className={
                          ['Gross pay', 'Deductions', 'Net pay'].includes(column)
                            ? 'is-amount'
                            : undefined
                        }
                        aria-sort={
                          sortable
                            ? isActive
                              ? query.order === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                            : undefined
                        }
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className="payroll-ledger-th-sort"
                            onClick={() => toggleSort(column)}
                          >
                            {column}
                            {isActive ? (
                              query.order === 'asc' ? (
                                <ArrowUp size={14} aria-hidden="true" />
                              ) : (
                                <ArrowDown size={14} aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown size={14} aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          column
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr
                    key={entry.id}
                    tabIndex={0}
                    aria-label={`Open ${entry.employeeName} payroll record`}
                    onClick={() => onOpen(entry.id)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault()
                        onOpen(entry.id)
                      }
                    }}
                  >
                    <td>
                      <strong className="payroll-ledger-employee">{entry.employeeName}</strong>
                      <span className="payroll-ledger-secondary">
                        {entry.position} · {entry.employeeNumber}
                      </span>
                    </td>
                    <td>
                      <span className="payroll-ledger-branch">{entry.branchName}</span>
                    </td>
                    <td>
                      <span className="payroll-ledger-period">
                        {displayPeriod(entry.periodStart, entry.periodEnd)}
                      </span>
                    </td>
                    <td className="is-amount">
                      <span>{displayAmount(entry.grossPay)}</span>
                    </td>
                    <td className="is-amount">
                      <span>{displayAmount(entry.deductions)}</span>
                    </td>
                    <td className="is-amount">
                      <strong className="payroll-ledger-net">{displayAmount(entry.netPay)}</strong>
                    </td>
                    <td>
                      <StatusBadge value={entry.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="payroll-ledger-cards" aria-label="Employee payroll cards">
            {items.map((entry) => (
              <button
                type="button"
                className="payroll-ledger-card"
                key={entry.id}
                onClick={() => onOpen(entry.id)}
                aria-label={`View details for ${entry.employeeName}`}
              >
                <span className="payroll-ledger-card-top">
                  <span className="payroll-ledger-card-person">
                    <strong>{entry.employeeName}</strong>
                    <span>
                      {entry.position} · {entry.employeeNumber}
                    </span>
                  </span>
                  <StatusBadge value={entry.paymentStatus} />
                </span>
                <span className="payroll-ledger-card-net">
                  <span>Net pay</span>
                  <strong>{displayAmount(entry.netPay)}</strong>
                </span>
                <span className="payroll-ledger-card-details">
                  <span>
                    <span>Branch</span>
                    <strong>{entry.branchName}</strong>
                  </span>
                  <span>
                    <span>Payroll period</span>
                    <strong>{displayPeriod(entry.periodStart, entry.periodEnd)}</strong>
                  </span>
                  <span>
                    <span>Gross pay</span>
                    <strong>{displayAmount(entry.grossPay)}</strong>
                  </span>
                  <span>
                    <span>Deductions</span>
                    <strong>{displayAmount(entry.deductions)}</strong>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <footer className="payroll-ledger-footer">
        <span>
          Showing{' '}
          <strong>
            {displayData?.total ? (query.page - 1) * query.limit + 1 : 0}–
            {Math.min((query.page - 1) * query.limit + items.length, displayData?.total ?? 0)}
          </strong>{' '}
          of <strong>{displayData?.total ?? 0}</strong> payroll entries
        </span>
        <div className="payroll-ledger-pagination">
          <label>
            <span className="sr-only">Entries per page</span>
            <select
              aria-label="Payroll entries per page"
              value={query.limit}
              onChange={(event) => updateQuery({ limit: Number(event.target.value) })}
            >
              {[10, 25, 50, 100].map((limit) => (
                <option key={limit} value={limit}>
                  {limit} per page
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Previous page"
            disabled={ledger.isFetching || query.page <= 1}
            onClick={() =>
              setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
            }
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span>
            Page {query.page} of {totalPages}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Next page"
            disabled={ledger.isFetching || query.page >= totalPages}
            onClick={() =>
              setQuery((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))
            }
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  )
}
