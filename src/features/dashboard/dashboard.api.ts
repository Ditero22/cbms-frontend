import { apiRequest } from '@/services/api/client'
import { invalidApiResponse } from '@/services/api/errors'
import { dashboardSummarySchema } from './dashboard.schema'

export async function getDashboardSummary() {
  const payload = await apiRequest<unknown>('/dashboard/summary')
  const result = dashboardSummarySchema.safeParse(payload)
  if (!result.success) throw invalidApiResponse()
  return result.data
}
