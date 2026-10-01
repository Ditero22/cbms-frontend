import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/services/api/client'
import type { ReportFilters as Filters, ReportType, SelectOption } from './types'
import { reportStatuses } from './report-options'
import './report-filters.css'

export function ReportFilters({
  report,
  values,
  onChange,
  isCrossBranch,
  canReadBranches,
}: {
  report: ReportType
  values: Filters
  onChange: (values: Filters) => void
  isCrossBranch: boolean
  canReadBranches: boolean
}) {
  const hasVehicle = report.startsWith('fleet-') || report === 'driver-allowances'
  const hasDriver =
    report === 'fleet-status' || report === 'fleet-assignments' || report === 'driver-allowances'
  const hasCustomer =
    report.startsWith('customer-') ||
    report === 'fleet-assignments' ||
    report === 'driver-allowances'
  const query = useQuery({
    queryKey: ['report-options', values.branchId],
    queryFn: () =>
      apiRequest<{
        branches: SelectOption[]
        vehicles: SelectOption[]
        drivers: SelectOption[]
        customers: SelectOption[]
      }>(
        `/reports/options${values.branchId ? `?branchId=${encodeURIComponent(values.branchId)}` : ''}`,
      ),
  })
  function select(field: keyof Filters, label: string, options: SelectOption[]) {
    return (
      <label className="field-label">
        {label}
        <select
          aria-label={label}
          className="form-input"
          value={values[field] ?? ''}
          disabled={query.isPending || query.isError}
          onChange={(event) => {
            const value = event.target.value || undefined
            onChange(
              field === 'branchId'
                ? {
                    ...values,
                    branchId: value,
                    vehicleId: undefined,
                    driverId: undefined,
                    customerId: undefined,
                  }
                : { ...values, [field]: value },
            )
          }}
        >
          <option value="">All {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <div className="report-filter-grid">
      {isCrossBranch && canReadBranches && select('branchId', 'Branch', query.data?.branches ?? [])}
      {hasVehicle && select('vehicleId', 'Vehicles', query.data?.vehicles ?? [])}
      {hasDriver && select('driverId', 'Drivers', query.data?.drivers ?? [])}
      {hasCustomer && select('customerId', 'Customers', query.data?.customers ?? [])}
      {reportStatuses[report] && (
        <label className="field-label">
          Status
          <select
            aria-label="Status"
            className="form-input"
            value={values.status ?? ''}
            onChange={(event) => onChange({ ...values, status: event.target.value })}
          >
            <option value="">All statuses</option>
            {reportStatuses[report]?.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      )}
      {query.isError && (
        <p role="alert" className="field-error">
          Could not load filter options.{' '}
          <button
            type="button"
            className="button button-outline"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  )
}
