import { apiRequest } from '@/services/api/client'
import type {
  PayrollLedger,
  PayrollLedgerEntry,
  PayrollLedgerQuery,
  PayrollOptions,
  PayrollRunDetail,
  PayrollRunInput,
} from './types'

export const getPayrollOptions = (branchId?: string) => {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
  return apiRequest<PayrollOptions>(`/payroll/options${query}`)
}

export const getPayrollRunDetail = (id: string, page = 1) =>
  apiRequest<PayrollRunDetail>(`/payroll/${encodeURIComponent(id)}?page=${page}&limit=25`)

export async function getPayrollRunForEdit(id: string) {
  const firstPage = await getPayrollRunDetail(id)
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      getPayrollRunDetail(id, index + 2),
    ),
  )
  return {
    ...firstPage,
    entries: [...firstPage.entries, ...remainingPages.flatMap((page) => page.entries)],
  }
}

export const savePayrollRun = (id: string | null, values: PayrollRunInput, requestKey?: string) =>
  apiRequest<{ id: string; reference: string; status: string }>(
    id ? `/payroll/${encodeURIComponent(id)}` : '/payroll',
    {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(id ? values : { ...values, requestKey }),
    },
  )

export const processPayrollRun = (id: string) =>
  apiRequest(`/payroll/${encodeURIComponent(id)}/process`, {
    method: 'POST',
    body: '{}',
  })

export const markPayrollEntryPaid = (
  entryId: string,
  values: {
    paymentDate: string
    paymentMethod: string
    paymentReference: string
    paymentNotes: string
    requestKey: string
  },
  proofFile: File,
) => {
  const body = new FormData()
  body.set('data', JSON.stringify(values))
  body.set('proofFile', proofFile)
  return apiRequest<{ id: string; status: 'Paid'; proofAttachmentId: string }>(
    `/payroll/entries/${encodeURIComponent(entryId)}/pay-with-proof`,
    {
      method: 'POST',
      body,
    },
  )
}

export function getPayrollLedger(query: PayrollLedgerQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, String(value))
  return apiRequest<PayrollLedger>(`/payroll/entries?${params}`)
}

export const getPayrollEntry = (id: string) =>
  apiRequest<{ entry: PayrollLedgerEntry }>(`/payroll/entries/${encodeURIComponent(id)}`)

export const confirmPayrollEntryReceived = (
  entryId: string,
  values: { receivedAt: string; acknowledgement: string; proofAttachmentId?: string },
) =>
  apiRequest(`/payroll/entries/${encodeURIComponent(entryId)}/receive`, {
    method: 'POST',
    body: JSON.stringify(values),
  })
