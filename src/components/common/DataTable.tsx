import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ModuleListQuery, RecordRow as Row } from '@/contracts/records'
import { serializeCsv } from '@/utils/csv'
import type { DataTableDefinition } from './DataTable.types'
import { StatusBadge } from './StatusBadge'

export function DataTable({
  module,
  rows,
  total,
  statusOptions,
  query,
  onQueryChange,
  onRowClick,
  branchOptions = [],
  isCrossBranch = false,
  busy = false,
}: {
  module: DataTableDefinition
  rows: Row[]
  total: number
  statusOptions: string[]
  query: ModuleListQuery
  onQueryChange: (query: ModuleListQuery) => void
  onRowClick: (row: Row) => void
  branchOptions?: { value: string; label: string }[]
  isCrossBranch?: boolean
  busy?: boolean
}) {
  const [searchInput, setSearchInput] = useState(query.search)
  const pendingSearch = searchInput !== query.search
  const totalPages = Math.max(1, Math.ceil(total / query.limit))
  const hasActiveFilters = Boolean(query.search || query.status || query.branchId)
  const emptyTitle =
    module.id === 'deliveries'
      ? hasActiveFilters
        ? 'No matching deliveries'
        : 'No deliveries found'
      : hasActiveFilters
        ? 'No matching records'
        : 'No records yet'
  const emptyDescription = hasActiveFilters
    ? `Try adjusting the search or filters${module.id === 'deliveries' ? ' to find a delivery' : ''}.`
    : module.id === 'deliveries'
      ? 'Scheduled deliveries will appear here.'
      : `Records for ${module.title.toLowerCase()} will appear here.`
  const sortableColumns = module.sortableColumns ?? module.columns
  const initialSortColumn = sortableColumns[0] ?? ''
  const mobileSortColumn = sortableColumns.includes(query.sort) ? query.sort : initialSortColumn
  const statusColumn = module.columns.find((column) => /status$/i.test(column))
  const primaryColumn = module.columns[0] ?? ''
  const mobileDetailColumns =
    module.mobileColumns ??
    module.columns
      .filter((column) => column !== primaryColumn && column !== statusColumn)
      .slice(0, 2)

  useEffect(() => {
    setSearchInput(query.search)
  }, [query.search])

  useEffect(() => {
    if (searchInput === query.search) return
    const timeout = window.setTimeout(() => {
      onQueryChange({ ...query, page: 1, search: searchInput })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [onQueryChange, query, searchInput])

  const toggleSort = (column: string) => {
    const order = query.sort === column && query.order === 'asc' ? 'desc' : 'asc'
    onQueryChange({ ...query, page: 1, sort: column, order })
  }

  const exportCsv = () => {
    const csv = serializeCsv([
      module.columns,
      ...rows.map((row) => module.columns.map((column) => row[column] ?? '')),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${module.id}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success('Your CSV export is ready.')
  }

  return (
    <section className="table-card" aria-label={`${module.title} records`} aria-busy={busy}>
      {busy && (
        <span className="sr-only" role="status">
          Updating records…
        </span>
      )}
      <div className="table-tools">
        <label className="table-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label={`Search ${module.title}`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${module.title.toLowerCase()}...`}
          />
        </label>
        <div className="table-actions">
          {isCrossBranch && branchOptions.length > 0 && module.columns.includes('Branch') && (
            <label className="select-control">
              <span className="sr-only">Filter by branch</span>
              <select
                value={query.branchId ?? ''}
                onChange={(event) =>
                  onQueryChange({
                    ...query,
                    page: 1,
                    branchId: event.target.value || undefined,
                  })
                }
                aria-label="Filter by branch"
              >
                <option value="">All branches</option>
                {branchOptions.map((branch) => (
                  <option key={branch.value} value={branch.value}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {statusColumn && (
            <label className="select-control">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <select
                value={query.status || 'All status'}
                onChange={(event) =>
                  onQueryChange({
                    ...query,
                    page: 1,
                    status: event.target.value === 'All status' ? '' : event.target.value,
                  })
                }
                aria-label="Filter by status"
              >
                <option>All status</option>
                {[...new Set([...statusOptions, query.status].filter(Boolean))].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
          <label className="mobile-sort-control">
            <span>Sort</span>
            <select
              aria-label={`Sort ${module.title} by`}
              value={mobileSortColumn}
              onChange={(event) => onQueryChange({ ...query, page: 1, sort: event.target.value })}
            >
              {sortableColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              aria-label={`Sort ${query.order === 'asc' ? 'descending' : 'ascending'}`}
              onClick={() =>
                onQueryChange({
                  ...query,
                  page: 1,
                  sort: mobileSortColumn,
                  order: query.order === 'asc' ? 'desc' : 'asc',
                })
              }
            >
              {query.order === 'asc' ? (
                <ArrowUp size={16} aria-hidden="true" />
              ) : (
                <ArrowDown size={16} aria-hidden="true" />
              )}
            </button>
          </label>
          <button
            type="button"
            className="button button-quiet"
            disabled={busy || pendingSearch}
            onClick={exportCsv}
          >
            Export page
          </button>
        </div>
      </div>

      <div
        className="table-scroll"
        role="region"
        aria-label={`${module.title} records table`}
        tabIndex={0}
      >
        <table aria-label={`${module.title} records`}>
          <thead>
            <tr>
              {module.columns.map((column) => (
                <th
                  key={column}
                  aria-sort={
                    sortableColumns.includes(column)
                      ? query.sort === column
                        ? query.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  {sortableColumns.includes(column) ? (
                    <button type="button" className="th-sort" onClick={() => toggleSort(column)}>
                      {column}
                      {query.sort === column ? (
                        query.order === 'asc' ? (
                          <ArrowUp size={13} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={13} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={13} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id ?? `${row[primaryColumn]}-${index}`}
                onClick={() => onRowClick(row)}
                aria-label={`Open ${row[primaryColumn]} record`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault()
                    onRowClick(row)
                  }
                }}
              >
                {module.columns.map((column, cellIndex) => (
                  <td key={column}>
                    {column === statusColumn ? (
                      <StatusBadge value={row[column]} />
                    ) : cellIndex === 0 ? (
                      <strong className="cell-primary">{row[column]}</strong>
                    ) : (
                      <span className="cell-secondary">{row[column]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="record-grid" aria-label={`${module.title} record cards`}>
        {rows.map((row, index) => (
          <button
            type="button"
            className={`record-card${module.id === 'deliveries' ? ' record-card--delivery' : ''}`}
            key={row.id ?? `${row[primaryColumn]}-card-${index}`}
            onClick={() => onRowClick(row)}
            aria-label={`View details for ${row[primaryColumn]}`}
          >
            <span className="record-card-heading">
              <strong>{row[primaryColumn] || 'Untitled record'}</strong>
              {statusColumn && row[statusColumn] ? <StatusBadge value={row[statusColumn]} /> : null}
            </span>
            {mobileDetailColumns.length > 0 && (
              <span className="record-card-fields">
                {mobileDetailColumns.map((column) => (
                  <span className="record-card-field" key={column}>
                    <span>{column}</span>
                    <strong>{row[column] || '—'}</strong>
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="table-empty" role="status" aria-live="polite">
          <div className="empty-icon">
            <Search size={20} aria-hidden="true" />
          </div>
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      )}

      <footer className="table-footer">
        <span>
          Showing{' '}
          <b>
            {total ? (query.page - 1) * query.limit + 1 : 0}–
            {Math.min((query.page - 1) * query.limit + rows.length, total)}
          </b>{' '}
          of <b>{total}</b> {module.title.toLowerCase()}
        </span>
        <div className="pagination">
          <label className="page-size-control">
            <span className="sr-only">Rows per page</span>
            <select
              aria-label="Rows per page"
              value={query.limit}
              onChange={(event) =>
                onQueryChange({ ...query, page: 1, limit: Number(event.target.value) })
              }
            >
              {[10, 25, 50, 100].map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Previous page"
            disabled={busy || query.page <= 1}
            onClick={() => onQueryChange({ ...query, page: Math.max(1, query.page - 1) })}
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span>
            Page {query.page} of {totalPages}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Next page"
            disabled={busy || query.page >= totalPages}
            onClick={() => onQueryChange({ ...query, page: Math.min(totalPages, query.page + 1) })}
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  )
}
