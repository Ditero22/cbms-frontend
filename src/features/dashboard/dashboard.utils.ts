import { Boxes, CircleDollarSign, ShoppingCart, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardSummary } from './dashboard.schema'

export type DashboardTask = {
  icon: LucideIcon
  tone: string
  title: string
  text: string
  meta: string
  path: string
}

export type DashboardStat = {
  title: string
  value: string
  note: string
  icon: LucideIcon
  tone: string
}

function parseCurrency(value: string | undefined) {
  return Number((value ?? '').replace(/[^\d.-]/g, '')) || 0
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getDashboardStats(summary: DashboardSummary): DashboardStat[] {
  return [
    {
      title: 'Recorded order value',
      value: formatCurrency(parseCurrency(summary.stats.salesTotal)),
      note: 'After cancelled quantities',
      icon: Wallet,
      tone: 'blue',
    },
    {
      title: 'Open orders',
      value: String(summary.stats.openOrders),
      note: 'Awaiting completion',
      icon: ShoppingCart,
      tone: 'orange',
    },
    {
      title: 'Stock alerts',
      value: String(summary.stats.stockAlerts),
      note: 'At or below reorder level',
      icon: Boxes,
      tone: 'purple',
    },
    {
      title: 'Active employees',
      value: String(summary.stats.activeEmployees),
      note: 'Active on record',
      icon: Users,
      tone: 'green',
    },
  ]
}

export function getBranchSales(summary: DashboardSummary) {
  return summary.branchSales.map(
    ({ name, total }) => [name, parseCurrency(total)] as [string, number],
  )
}

export function getPriorityTasks(summary: DashboardSummary): DashboardTask[] {
  return summary.priorityTasks.map((task) => ({
    icon: task.type === 'inventory' ? Boxes : CircleDollarSign,
    tone: task.type === 'inventory' ? 'orange' : 'purple',
    title: task.title,
    text: task.text,
    meta: task.meta,
    path: task.type === 'inventory' ? '/inventory' : '/expenses',
  }))
}
