import type { RecordHistoryEntry } from '@/features/modules/types'

export type InventoryRecord = {
  id: string
  productId: string
  productName: string
  sku: string
  unit: string
  productStatus: string
  branchId: string
  branchName: string
  branchStatus: string
  quantity: string
  reservedQuantity: string
  availableQuantity: string
  reorderLevel: string
  status: string
  updatedAt: string
}

export type StockMovement = {
  id: string
  transactionType: string
  quantityDelta: string
  stockDelta: string | null
  reservedDelta: string | null
  referenceType: string | null
  referenceId: string | null
  referenceLabel: string | null
  note: string | null
  performedByName: string | null
  createdAt: string
}

export type InventoryDetailFilters = {
  movementPage: number
  movementType: string
  dateFrom: string
  dateTo: string
  historyPage: number
}

export type InventoryDetail = {
  inventory: InventoryRecord
  latestAddition: { id: string; quantity: string } | null
  movements: StockMovement[]
  movementPage: number
  movementPageSize: number
  movementTotal: number
  movementTypes: string[]
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}

export type StockCorrectionValues = {
  transactionId: string
  correctedQuantity: string
  reason: string
  requestKey: string
}

export type StockAdjustmentValues = {
  productId: string
  branchId: string
  quantityDelta: string
  note: string
  requestKey?: string
}
