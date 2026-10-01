import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileBarChart } from 'lucide-react'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { PageHeading } from '@/components/common/PageHeading'
import { downloadReport, getReportData } from './modules.api'
import type { ReportType, ReportFilters as ReportFilterValues } from './types'
import { useModuleRuntime } from './useModuleRuntime'
import { reportOptions } from './report-options'
import { ReportFilters } from './ReportFilters'
import { formatPeso } from './order-decimals'

function localDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function firstDayOfCurrentMonth() {
  const today = new Date()
  return localDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
}

function formatReportCurrency(value: string | undefined) {
  return formatPeso(value ?? '0')
}

function reportScope(isCrossBranch: boolean, branchName: string | null, branchId?: string) {
  if (isCrossBranch) return branchId ? 'selected branch' : 'company-wide · all branches'
  return `assigned branch · ${branchName ?? 'your branch'}`
}

export function ReportsPage() {
  const runtime = useModuleRuntime()
  const [reportType, setReportType] = useState<ReportType>('sales-by-branch')
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth)
  const [dateTo, setDateTo] = useState(() => localDateInput(new Date()))
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<ReportFilterValues>({})
  const visibleReports = reportOptions.filter(
    (option) =>
      (!option.permission || runtime.permissions.includes(option.permission)) &&
      (option.id !== 'fleet-maintenance' || runtime.permissions.includes('expenses.read')),
  )
  const isCurrentSnapshot = ['inventory-health', 'customer-balances', 'fleet-status'].includes(
    reportType,
  )
  const hasDomainFilters =
    reportType.startsWith('fleet-') ||
    reportType.startsWith('customer-') ||
    reportType === 'driver-allowances'
  const canExport = runtime.permissions.includes('reports.export')
  const rangeDays =
    (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000
  const rangeValid =
    isCurrentSnapshot || Boolean(dateFrom && dateTo && rangeDays >= 0 && rangeDays <= 366)
  const snapshotDate = localDateInput(new Date())
  const effectiveDateFrom = isCurrentSnapshot ? snapshotDate : dateFrom
  const effectiveDateTo = isCurrentSnapshot ? snapshotDate : dateTo
  const reportQuery = useQuery({
    queryKey: ['report', reportType, effectiveDateFrom, effectiveDateTo, filters],
    queryFn: () => getReportData(reportType, effectiveDateFrom, effectiveDateTo, filters),
    enabled: rangeValid,
  })

  async function handleExport() {
    setIsExporting(true)
    try {
      await downloadReport(reportType, effectiveDateFrom, effectiveDateTo, filters)
      toast.success('The report download is ready.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The report could not be downloaded.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Insights' },
          { label: 'Reports' },
        ]}
      />
      <PageHeading
        title="Reports"
        description="Run scoped operations and finance reports from recorded business data."
      >
        {canExport && (
          <button
            className="button button-primary"
            disabled={isExporting || !rangeValid}
            onClick={() => void handleExport()}
          >
            <Download size={15} />
            {isExporting ? 'Preparing…' : 'Download CSV'}
          </button>
        )}
      </PageHeading>

      <section className="report-controls table-card" aria-label="Report options">
        <label className="field-label">
          Report
          <select
            aria-label="Report"
            className="form-input"
            value={reportType}
            onChange={(event) => {
              setReportType(event.target.value as ReportType)
              setFilters((current) => ({ branchId: current.branchId }))
            }}
          >
            {visibleReports.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          From
          <input
            className="form-input"
            type="date"
            aria-label="From"
            value={dateFrom}
            max={dateTo || undefined}
            disabled={isCurrentSnapshot}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="field-label">
          To
          <input
            className="form-input"
            type="date"
            aria-label="To"
            value={dateTo}
            min={dateFrom || undefined}
            disabled={isCurrentSnapshot}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <p className="report-description">
          {reportOptions.find((option) => option.id === reportType)?.description}
          {isCurrentSnapshot && ' Date filters do not apply to this current snapshot.'}
        </p>
        {(hasDomainFilters ||
          (runtime.isCrossBranch && runtime.permissions.includes('branches.read'))) && (
          <ReportFilters
            report={reportType}
            values={filters}
            onChange={setFilters}
            isCrossBranch={runtime.isCrossBranch}
            canReadBranches={runtime.permissions.includes('branches.read')}
          />
        )}
      </section>

      <div className="table-section-heading report-result-heading">
        <div>
          <h2>{reportQuery.data?.title ?? 'Report results'}</h2>
          <p>
            {isCurrentSnapshot
              ? `Current recorded status · ${reportScope(runtime.isCrossBranch, runtime.branchName, filters.branchId)}`
              : `${dateFrom} through ${dateTo} · ${reportScope(runtime.isCrossBranch, runtime.branchName, filters.branchId)}`}
          </p>
        </div>
        {reportQuery.data && (
          <span className="report-row-count">{reportQuery.data.rows.length} rows</span>
        )}
      </div>

      <section className="table-card report-results" aria-live="polite">
        {!rangeValid ? (
          <div className="table-empty">
            <strong>Choose a valid date range.</strong>
            <span>The end date must follow the start date, within 367 days.</span>
          </div>
        ) : reportQuery.isPending ? (
          <div className="table-empty">
            <strong>Generating report…</strong>
          </div>
        ) : reportQuery.isError ? (
          <div className="table-empty">
            <strong>Could not generate this report.</strong>
            <span>{reportQuery.error.message}</span>
            <button className="button button-outline" onClick={() => void reportQuery.refetch()}>
              Try again
            </button>
          </div>
        ) : reportQuery.data.rows.length === 0 ? (
          <div className="table-empty">
            <FileBarChart size={22} />
            <strong>No report rows for this selection.</strong>
            <span>Choose another date range or report.</span>
          </div>
        ) : (
          <>
            <div className="table-scroll report-results-table">
              <table>
                <thead>
                  <tr>
                    {reportQuery.data.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportQuery.data.rows.map((row, rowIndex) => (
                    <tr key={`${row[reportQuery.data.columns[0]]}-${rowIndex}`}>
                      {reportQuery.data.columns.map((column) => (
                        <td key={column}>
                          {column.includes('(PHP)')
                            ? formatReportCurrency(row[column])
                            : row[column]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="report-record-list" aria-label="Report rows">
              {reportQuery.data.rows.map((row, rowIndex) => (
                <article className="report-record-card" key={`report-row-${rowIndex}`}>
                  {reportQuery.data.columns.map((column) => (
                    <div className="report-record-field" key={column}>
                      <span>{column}</span>
                      <strong>
                        {column.includes('(PHP)') ? formatReportCurrency(row[column]) : row[column]}
                      </strong>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      {!canExport && (
        <p className="report-permission-note">
          Your role can view reports but cannot download them.
        </p>
      )}
    </>
  )
}
