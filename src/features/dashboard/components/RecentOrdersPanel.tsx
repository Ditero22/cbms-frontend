import { ArrowUpRight } from 'lucide-react'
import { StatusInline } from '@/components/common/StatusInline'
import type { RecordRow } from '@/features/modules/types'

type RecentOrdersPanelProps = {
  orders: RecordRow[]
  isLoading: boolean
  canViewAll: boolean
  onViewAll: () => void
}

export function RecentOrdersPanel({
  orders,
  isLoading,
  canViewAll,
  onViewAll,
}: RecentOrdersPanelProps) {
  return (
    <article className="panel orders-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">RECENT ACTIVITY</div>
          <h2>Latest orders</h2>
          <p>Most recently recorded customer orders</p>
        </div>
        {canViewAll && (
          <button className="text-action" onClick={onViewAll}>
            View all <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      {orders.length === 0 ? (
        <div className="table-empty">
          <strong>{isLoading ? 'Loading orders…' : 'No orders recorded yet.'}</strong>
        </div>
      ) : (
        <>
          <div className="compact-table recent-orders-table">
            <table>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>CUSTOMER</th>
                  <th>DATE</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((row, index) => (
                  <tr key={`${row.Order}-${index}`}>
                    <td>
                      <strong>{row.Order}</strong>
                    </td>
                    <td>{row.Customer}</td>
                    <td>{row.Date}</td>
                    <td>
                      <b>{row.Amount}</b>
                    </td>
                    <td>{row.Status ? <StatusInline status={row.Status} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="recent-order-cards" aria-label="Latest orders">
            {orders.slice(0, 5).map((row, index) => (
              <article className="recent-order-card" key={`${row.Order}-card-${index}`}>
                <div className="recent-order-card-heading">
                  <strong>{row.Order}</strong>
                  {row.Status && <StatusInline status={row.Status} />}
                </div>
                <div className="recent-order-card-field">
                  <span>Customer</span>
                  <strong>{row.Customer || '—'}</strong>
                </div>
                <div className="recent-order-card-field">
                  <span>Date</span>
                  <strong>{row.Date || '—'}</strong>
                </div>
                <div className="recent-order-card-field">
                  <span>Amount</span>
                  <strong>{row.Amount || '—'}</strong>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </article>
  )
}
