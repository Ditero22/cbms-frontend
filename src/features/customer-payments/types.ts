import type { PaymentOptions, RecordHistoryEntry } from '@/features/modules/types'

export type CustomerPaymentMethod = 'Cash' | 'GCash' | 'Bank transfer' | 'Card' | 'Cheque' | 'Other'
export type CustomerPaymentValues = {
  orderId: string
  amount: string
  method: CustomerPaymentMethod
  paymentDate: string
  externalReference: string
  notes: string
}
export type CustomerReceipt = {
  id: string
  reference: string
  amount: string
  method: CustomerPaymentMethod
  status: string
  paymentDate: string
  externalReference: string | null
  notes: string | null
  recordedByName: string
  createdAt: string
}
export type CustomerPaymentDetail = {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  branchId: string
  branchName: string
  originalTotal: string
  payableAmount: string
  paymentsAmount: string
  refundedAmount: string
  netPaidAmount: string
  balance: string
  pendingRefundAmount: string
  paymentStatus: string
  orderStatus: string
  lastPaymentDate: string | null
  canRecordPayment: boolean
  recordingBlocker: string | null
  payments: CustomerReceipt[]
  refunds: {
    id: string
    reference: string
    paymentId: string
    amount: string
    status: string
    processedAt: string | null
    processedReference: string | null
  }[]
  history: RecordHistoryEntry[]
}
export type CustomerPaymentOptions = PaymentOptions
