export type PayrollPayBasis = 'Salary' | 'Daily wage' | 'Weekly wage' | 'Per-trip pay' | 'Other'
export type PayrollAdjustmentKind = 'earning' | 'deduction'
export type PayrollEarningType =
  'Overtime' | 'Bonus' | 'Allowance' | 'Reimbursement' | 'Other compensation'
export type PayrollDeductionType = 'Deduction' | 'Cash advance recovery'

export type PayrollAdjustmentInput = {
  kind: PayrollAdjustmentKind
  type: PayrollEarningType | PayrollDeductionType
  amount: string
  notes: string
}

export type PayrollEntryInput = {
  employeeId: string
  payBasis: PayrollPayBasis
  units: string
  rate: string
  adjustments: PayrollAdjustmentInput[]
}

export type PayrollRunInput = {
  branchId: string
  periodStart: string
  periodEnd: string
  entries: PayrollEntryInput[]
}

export type PayrollBranch = { id: string; name: string }
export type PayrollEmployee = {
  id: string
  employeeNumber: string
  name: string
  position: string
}
export type PayrollOptions = {
  branches: PayrollBranch[]
  selectedBranchId: string | null
  employees: PayrollEmployee[]
}

export type PayrollEntryAdjustment = {
  id: string
  kind: PayrollAdjustmentKind
  type: string
  amount: string
  notes: string | null
}

export type PayrollEntry = {
  id: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  position: string
  payBasis: PayrollPayBasis
  units: string
  rate: string
  regularPay: string
  additionalPay: string
  deductions: string
  grossPay: string
  netPay: string
  paymentStatus: 'Pending' | 'Paid' | 'Received'
  paymentDate: string | null
  paymentMethod: string | null
  paymentReference: string | null
  paymentNotes?: string | null
  paidBy: string | null
  paidByName: string | null
  paidAt: string | null
  receivedAt: string | null
  confirmedBy: string | null
  confirmedByName: string | null
  acknowledgement: string | null
  adjustments: PayrollEntryAdjustment[]
}

export type PayrollRun = {
  id: string
  reference: string
  periodStart: string
  periodEnd: string
  employeeCount: number
  grossPay: string
  branchId: string | null
  branchName: string | null
  status: 'Draft' | 'Processed'
  processedBy: string | null
  processedByName: string | null
  processedAt: string | null
  createdAt: string
}

export type PayrollRunDetail = {
  run: PayrollRun
  entries: PayrollEntry[]
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

export type PayrollLedgerEntry = PayrollEntry & {
  runId: string
  runReference: string
  runStatus: 'Draft' | 'Processed'
  periodStart: string
  periodEnd: string
  branchId: string
  branchName: string
  allowancePay: string
  proofAttachmentId: string | null
}
export type PayrollLedgerQuery = {
  page: number
  limit: number
  search: string
  branchId?: string
  paymentStatus?: string
  periodStart?: string
  periodEnd?: string
  sort?: string
  order?: 'asc' | 'desc'
}
export type PayrollLedger = {
  items: PayrollLedgerEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  branches: PayrollBranch[]
}
