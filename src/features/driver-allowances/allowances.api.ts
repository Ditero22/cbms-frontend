import { apiRequest } from '@/services/api/client'
import type { AllowanceDetail } from './types'
export const getAllowanceDetail = (id: string, historyPage = 1) =>
  apiRequest<AllowanceDetail>(`/driver-allowances/${id}?historyPage=${historyPage}`)
export const transitionAllowance = (id: string, action: 'approve' | 'release' | 'cancel') =>
  apiRequest(`/driver-allowances/${id}/${action}`, { method: 'POST', body: '{}' })
export const receiveAllowance = (
  id: string,
  values: { receivedAt: string; acknowledgement?: string; proofAttachmentId?: string },
) =>
  apiRequest(`/driver-allowances/${id}/receive`, { method: 'POST', body: JSON.stringify(values) })
