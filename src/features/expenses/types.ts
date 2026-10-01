import type { RecordHistoryEntry, SelectOption } from '@/features/modules/types'

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected'
export type ExpenseRecord = {
  id: string
  description: string
  category: string
  branchId: string
  branchName: string
  branchStatus: string
  amount: string
  status: ExpenseStatus
  submittedBy: string
  submittedByName: string
  createdAt: string
  updatedAt: string
  approvedBy: string | null
  approvedByName: string | null
  approvedAt: string | null
}
export type ExpenseReview = {
  decision: 'Approved' | 'Rejected'
  note: string | null
  reviewerId: string | null
  reviewerName: string | null
  reviewedAt: string | null
}
export type ExpenseSource = {
  entityType: 'vehicle-maintenance' | 'driver-allowance'
  id: string
  title: string
  status: string
  reference: string
  vehicleName?: string | null
  plateNumber?: string | null
  workerName?: string | null
  paymentType?: string | null
  method?: string | null
}
export type ExpenseDetail = {
  expense: ExpenseRecord
  review: ExpenseReview | null
  source: ExpenseSource | null
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}
export type ExpenseOptions = { branches: SelectOption[]; categories: string[] }
export type ExpenseValues = {
  description: string
  category: string
  branchId: string
  amount: string
  requestKey?: string
}
