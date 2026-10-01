import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../dashboard.schema'
import { formatPeso } from '@/features/modules/order-decimals'
import './operations-snapshot.css'

export function OperationsSnapshot({
  operations,
  canViewReports,
  scopeLabel,
}: Pick<DashboardSummary, 'operations'> & { canViewReports: boolean; scopeLabel: string }) {
  if (!operations || Object.values(operations).every((value) => value === null)) return null
  const { fleet, maintenanceMonthlyCost, pendingAllowances, customerBalances } = operations
  return (
    <section className="operations-snapshot table-card" aria-label="Fleet and finance overview">
      <h2>Operations & collections</h2>
      <p className="operations-scope">{scopeLabel}</p>
      <div className="operations-metrics">
        {fleet && (
          <div>
            <Link to="/vehicles">Fleet availability</Link>
            <strong>{fleet.available} available</strong>
            <span>
              {fleet.onService} on service · {fleet.underMaintenance} under maintenance
              {fleet.unavailable ? ` · ${fleet.unavailable} unavailable` : ''}
            </span>
          </div>
        )}
        {maintenanceMonthlyCost !== null && (
          <div>
            {canViewReports ? (
              <Link to="/reports">Maintenance this month</Link>
            ) : (
              <span>Maintenance this month</span>
            )}
            <strong>{formatPeso(maintenanceMonthlyCost)}</strong>
            <span>Completed repair costs; expense approval is separate</span>
          </div>
        )}
        {pendingAllowances && (
          <div>
            <Link to="/payroll?view=legacy">Legacy allowances awaiting release</Link>
            <strong>{formatPeso(pendingAllowances.amount)}</strong>
            <span>
              {pendingAllowances.count} pending or approved · {pendingAllowances.awaitingReceipt}{' '}
              released, awaiting receipt
            </span>
          </div>
        )}
        {customerBalances && (
          <div>
            <Link to="/payments">Outstanding customer balances</Link>
            <strong>{formatPeso(customerBalances.outstandingBalance)}</strong>
            <span>{customerBalances.outstandingOrders} orders with a positive balance</span>
          </div>
        )}
      </div>
    </section>
  )
}
