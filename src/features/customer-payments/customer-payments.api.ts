import { apiRequest } from '@/services/api/client'
import type { CustomerPaymentDetail, CustomerPaymentOptions, CustomerPaymentValues } from './types'

export function getCustomerPaymentDetail(orderId: string) {
  return apiRequest<CustomerPaymentDetail>(`/payments/orders/${orderId}`)
}

export function getCustomerPaymentOptions() {
  return apiRequest<CustomerPaymentOptions>('/payments/options')
}

export function recordCustomerPayment(
  values: CustomerPaymentValues,
  requestKey: string,
  proofFile: File,
) {
  const body = new FormData()
  body.set('data', JSON.stringify({ ...values, requestKey }))
  body.set('proofFile', proofFile)
  return apiRequest<{
    id: string
    reference: string
    orderId: string
    amount: string
    remainingBalance: string
    proofAttachmentId: string
  }>('/payments/with-proof', {
    method: 'POST',
    body,
  })
}
