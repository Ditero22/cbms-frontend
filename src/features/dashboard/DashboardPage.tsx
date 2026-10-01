import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileBarChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeading } from '@/components/common/PageHeading'
import { QueryState } from '@/components/common/QueryState'
import type { AuthenticatedUser } from '@/features/auth/types'
import { getDashboardSummary } from './dashboard.api'
import type { DashboardSummary } from './dashboard.schema'
import { BranchSalesPanel } from './components/BranchSalesPanel'
import { PriorityTasksPanel } from './components/PriorityTasksPanel'
import { RecentOrdersPanel } from './components/RecentOrdersPanel'
import { StatsGrid } from './components/StatsGrid'
import { OperationsSnapshot } from './components/OperationsSnapshot'
import { getBranchSales, getDashboardStats, getPriorityTasks } from './dashboard.utils'

type DashboardPageProps = { user: AuthenticatedUser }

export function DashboardPage({ user }: DashboardPageProps) {
  const navigate = useNavigate()
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  })

  const summary = summaryQuery.data ?? emptySummary
  const orders = summary.recentOrders
  const branchSales = getBranchSales(summary)
  const priorityTasks = getPriorityTasks(summary).filter((task) =>
    user.permissions.includes(task.path === '/inventory' ? 'inventory.read' : 'expenses.read'),
  )
  const stats = getDashboardStats(summary)
  const isLoading = summaryQuery.isPending
  const today = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  return (
    <>
      <PageHeading
        eyebrow={today.toUpperCase()}
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description={
          user.isCrossBranch
            ? 'Company-wide snapshot across all branches.'
            : `Live snapshot for ${user.branch ?? 'your assigned branch'}.`
        }
      >
        {user.permissions.includes('reports.view') && (
          <button className="button button-outline" onClick={() => navigate('/reports')}>
            <FileBarChart size={16} />
            View reports
          </button>
        )}
        {user.permissions.includes('orders.create') && user.permissions.includes('sales.read') && (
          <button className="button button-primary" onClick={() => navigate('/orders')}>
            <ArrowRight size={17} />
            Open orders
          </button>
        )}
      </PageHeading>

      <QueryState
        error={summaryQuery.error}
        errorTitle="We couldn’t load the dashboard."
        className="dashboard-error"
        onRetry={() => void summaryQuery.refetch()}
      >
        <>
          <StatsGrid stats={stats} isLoading={isLoading} />
          {!isLoading && (
            <OperationsSnapshot
              operations={summary.operations}
              canViewReports={user.permissions.includes('reports.view')}
              scopeLabel={
                user.isCrossBranch
                  ? 'Company-wide · all branches'
                  : `Assigned branch · ${user.branch ?? 'your branch'}`
              }
            />
          )}
          <section className="dashboard-grid">
            <RecentOrdersPanel
              orders={orders}
              isLoading={isLoading}
              canViewAll={user.permissions.includes('sales.read')}
              onViewAll={() => navigate('/orders')}
            />
            <BranchSalesPanel
              branchSales={branchSales}
              isLoading={isLoading}
              canViewBranches={user.permissions.includes('branches.read')}
              onViewBranches={() => navigate('/branches')}
            />
          </section>
          <section className="dashboard-lower">
            <PriorityTasksPanel
              tasks={priorityTasks}
              isLoading={isLoading}
              onOpenTask={(path) => navigate(path)}
            />
          </section>
        </>
      </QueryState>
    </>
  )
}

const emptySummary: DashboardSummary = {
  stats: { salesTotal: '0', openOrders: 0, stockAlerts: 0, activeEmployees: 0 },
  branchSales: [],
  recentOrders: [],
  priorityTasks: [],
}
