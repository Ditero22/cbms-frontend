import { ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '../dashboard.utils'

type BranchSalesPanelProps = {
  branchSales: [string, number][]
  isLoading: boolean
  canViewBranches: boolean
  onViewBranches: () => void
}

const barColors = ['navy', 'orange', 'blue', 'gray']

export function BranchSalesPanel({
  branchSales,
  isLoading,
  canViewBranches,
  onViewBranches,
}: BranchSalesPanelProps) {
  const topBranchSales = branchSales[0]?.[1] || 1

  return (
    <article className="panel branch-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">BRANCHES</div>
          <h2>Order value by branch</h2>
          <p>Recorded orders after cancelled quantities</p>
        </div>
      </div>
      {branchSales.length === 0 ? (
        <div className="table-empty">
          <strong>
            {isLoading ? 'Loading branch totals…' : 'No branch order value recorded yet.'}
          </strong>
        </div>
      ) : (
        <div className="branch-list">
          {branchSales.map(([name, total], index) => (
            <div className="branch-row" key={name}>
              <span className="branch-rank">{String(index + 1).padStart(2, '0')}</span>
              <div className="branch-main">
                <div>
                  <strong>{name}</strong>
                  <b>{formatCurrency(total)}</b>
                </div>
                <div className="progress-track">
                  <span
                    className={barColors[index]}
                    style={{
                      width: `${Math.max(3, (total / topBranchSales) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {canViewBranches && (
        <button className="panel-footer-action" onClick={onViewBranches}>
          View all branches <ArrowUpRight size={15} />
        </button>
      )}
    </article>
  )
}
