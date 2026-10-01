import { apiRequest } from '@/services/api/client'
import type {
  InventoryDetail,
  InventoryDetailFilters,
  InventoryRecord,
  StockAdjustmentValues,
  StockCorrectionValues,
} from './types'

export function getInventoryDetail(id: string, filters: InventoryDetailFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '') params.set(key, String(value))
  })
  return apiRequest<InventoryDetail>(`/inventory/${id}?${params.toString()}`)
}

export const adjustStock = (values: StockAdjustmentValues) =>
  apiRequest<{ id: string }>('/inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(values),
  })

export const updateReorderPoint = (id: string, reorderLevel: string) =>
  apiRequest<InventoryRecord>(`/inventory/${id}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ reorderLevel }),
  })

export const correctStockAddition = (id: string, values: StockCorrectionValues) =>
  apiRequest<{ id: string; quantity: string }>(`/inventory/${id}/corrections`, {
    method: 'POST',
    body: JSON.stringify(values),
  })
