import { apiRequest } from '@/services/api/client'
import type { ExpenseDetail, ExpenseOptions, ExpenseValues } from './types'

export const getExpenseOptions = () => apiRequest<ExpenseOptions>('/expenses/options')
export const getExpenseDetail = (id: string, historyPage = 1) =>
  apiRequest<ExpenseDetail>(`/expenses/${id}?historyPage=${historyPage}`)
export const createExpense = (values: ExpenseValues) =>
  apiRequest<{ id: string }>('/expenses', { method: 'POST', body: JSON.stringify(values) })
export const reviewExpense = (id: string, decision: 'Approved' | 'Rejected', note: string) =>
  apiRequest<{ id: string; status: string }>(`/expenses/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, note: note.trim() || undefined }),
  })
