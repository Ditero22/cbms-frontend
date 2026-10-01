import type { FleetHistory } from '@/features/fleet/types'
export type AllowanceStatus = 'Pending' | 'Approved' | 'Released' | 'Received' | 'Cancelled'
export type AllowanceTiming = 'Immediate' | 'After trip' | 'Scheduled payday' | 'Pending release'
export type AllowanceMethod = 'Cash' | 'GCash' | 'Bank Transfer' | 'Payroll' | 'Other'
export type AllowanceValues = {
  workerId: string
  branchId: string
  assignmentId: string | null
  deliveryId: string | null
  paymentType: string
  amount: string
  paymentTiming: AllowanceTiming
  method: AllowanceMethod
  referenceNumber: string | null
  notes: string | null
}
export type AllowanceRecord = AllowanceValues & {
  id: string
  reference: string
  workerName: string
  status: AllowanceStatus
  authorizedAt: string | null
  authorizedBy: string | null
  authorizedByName?: string | null
  releasedAt: string | null
  releasedBy: string | null
  releasedByName?: string | null
  receivedAt: string | null
  confirmedBy: string | null
  confirmedByName?: string | null
  acknowledgement: string | null
  expenseId: string | null
  createdAt: string
  updatedAt: string
}
export type AllowanceDetail = { allowance: AllowanceRecord } & FleetHistory
