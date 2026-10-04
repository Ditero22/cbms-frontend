import type { RecordHistoryEntry } from '@/contracts/records'

// Existing feature consumers can migrate independently to the shared contracts.
export type {
  RecordRow,
  ModuleRecordResponse,
  ModuleListQuery,
  RecordHistoryEntry,
} from '@/contracts/records'

export type ReportType =
  | 'sales-by-branch'
  | 'approved-expenses'
  | 'inventory-health'
  | 'fleet-status'
  | 'fleet-assignments'
  | 'fleet-maintenance'
  | 'driver-allowances'
  | 'customer-balances'
  | 'customer-payment-history'
export type ReportFilters = {
  branchId?: string
  vehicleId?: string
  driverId?: string
  customerId?: string
  status?: string
}

export type ReportData = {
  title: string
  columns: string[]
  rows: Record<string, string>[]
  dateFrom: string
  dateTo: string
  generatedAt: string
}

export type SelectOption = { id: string; name: string }

export type EmployeeOptions = { branches: SelectOption[] }

export type EmployeeValues = {
  employeeNumber: string
  name: string
  position: string
  branchId: string
  email?: string
  phone?: string
  address?: string | null
  hiredAt?: string | null
  status?: 'Active' | 'Inactive'
  isDriver?: boolean
  licenseNumber?: string | null
  licenseClassification?: string | null
  licenseExpiresOn?: string | null
  driverAvailability?: 'Available' | 'Unavailable'
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  notes?: string | null
}

export type EmployeeRecord = {
  id: string
  employeeNumber: string
  name: string
  position: string
  branchId: string
  branchName: string
  email: string | null
  phone: string | null
  address: string | null
  archivedAt: string | null
  hiredAt: string | null
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
  isDriver: boolean
  licenseNumber: string | null
  licenseClassification: string | null
  licenseExpiresOn: string | null
  driverAvailability: 'Available' | 'Unavailable'
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  notes: string | null
}

export type EmployeeHistoryEntry = RecordHistoryEntry

export type EmployeeDetailResponse = {
  employee: EmployeeRecord
  history: EmployeeHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}

export type ManagedModuleId = 'branches' | 'customers' | 'suppliers' | 'products'

export type ManagedRecordArchivePolicy = {
  permanentDeletionAllowed: false
  canArchive: boolean
  dependencies: { key: string; label: string; count: number; blockingCount: number }[]
}

export type ManagedRecord = Record<string, unknown> & {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  related: {
    employeeCount?: number
    stockedProductCount?: number
    orderCount?: number
    productCount?: number
    inventory?: {
      branchId: string
      branchName: string
      quantity: string | number
      reorderLevel: string | number
    }[]
  }
  history: RecordHistoryEntry[]
  archivePolicy?: ManagedRecordArchivePolicy
}

export type ProductOption = SelectOption & {
  sku: string
  unit: string
  unitPrice?: string | number
}

export type InventoryOptions = {
  products: ProductOption[]
  branches: SelectOption[]
}

export type OrderOptions = InventoryOptions & {
  customers: SelectOption[]
}

export type PaymentOption = {
  id: string
  orderNumber: string
  customerName: string
  branchId: string
  totalAmount: string
  paidAmount: string
  balance: string
}

export type PaymentOptions = PaymentOption[]

export type DeliveryOption = {
  id: string
  orderNumber: string
  customerName: string
  defaultDestination: string | null
  branchId: string
  items: {
    orderItemId: string
    productName: string
    sku: string
    unit: string
    remainingQuantity: string
  }[]
}

export type DeliveryOptions = DeliveryOption[]

export type DeliveryDetailResponse = {
  id: string
  reference: string
  status: string
  destination: string
  driverName: string | null
  scheduledAt: string | null
  allocationOrigin: string
  allocationStatus: string
  allocationVerifiedAt: string | null
  allocationVerifiedByName: string | null
  orderId: string
  orderNumber: string
  orderStatus: string
  customerName: string
  branchId: string
  branchName: string
  vehicleName: string | null
  plateNumber: string | null
  assignmentReference: string | null
  assignmentStatus: string | null
  assignmentStartedAt: string | null
  assignmentEndedAt: string | null
  startOdometer: string | null
  endOdometer: string | null
  activityNotes: string | null
  createdAt: string
  updatedAt: string
  items: {
    id: string
    orderItemId: string
    productName: string
    sku: string
    unit: string
    quantity: string
    orderedQuantity: string
    inferredQuantity: string | null
  }[]
  history: RecordHistoryEntry[]
  historyTotal: number
  historyPage: number
  historyPageSize: number
}

export type DeliveryStatus = 'Scheduled' | 'In Transit' | 'Delivered' | 'Failed'

export type CreateRecordValues = Record<string, string>

export type CreateTransferValues = {
  fromBranchId: string
  toBranchId: string
  items: { productId: string; quantity: string }[]
  note?: string
  requestKey?: string
}

export type CreateOrderValues = {
  customerId: string
  branchId: string
  items: { productId: string; quantity: string }[]
  requestKey?: string
}

export type OrderDetailResponse = {
  id: string
  orderNumber: string
  customerName: string
  branchId: string
  branchName: string
  totalAmount: string
  paidAmount: string
  balance: string
  status: string
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  cancellationNotes: string | null
  completedAt: string | null
  payableAmount: string
  items: {
    id: string
    productId: string
    productName: string
    sku: string
    unit: string
    quantity: string
    cancelledQuantity: string
    deliveredQuantity: string
    returnedQuantity: string
    unitPrice: string
    lineTotal: string
  }[]
  payments: {
    id: string
    reference: string
    method: string
    amount: string
    status: string
    createdAt: string
    recordedByName: string
    paymentDate: string
    externalReference: string | null
    notes: string | null
  }[]
  refunds: {
    id: string
    reference: string
    paymentId: string
    paymentReference: string
    amount: string
    method: string
    reason: string
    notes: string | null
    status: 'Requested' | 'Approved' | 'Processed' | 'Rejected'
    processedReference: string | null
    requestedAt: string
    approvedAt: string | null
    processedAt: string | null
    requestedByName: string
    approvedByName: string | null
    processedByName: string | null
  }[]
  returns: {
    id: string
    reference: string
    deliveryId: string
    deliveryReference: string
    reason: string
    notes: string | null
    status: 'Requested' | 'Approved' | 'Received' | 'Rejected'
    requestedAt: string
    approvedAt: string | null
    receivedAt: string | null
    rejectionNotes: string | null
    requestedByName: string
    approvedByName: string | null
    receivedByName: string | null
    items: {
      orderItemId: string
      productName: string
      sku: string
      quantity: string
      condition: string
      acceptedQuantity: string
      remainderCondition: string | null
    }[]
  }[]
  lifecycle: {
    requiresLegacyDeliveryReconciliation: boolean
    cancellation: {
      canCancel: boolean
      canCancelRemaining: boolean
      requiresRefund: boolean
      requiresReturn: boolean
      blockingReasons: { code: string; message: string }[]
    }
    completion: {
      canComplete: boolean
      blockingReasons: { code: string; message: string }[]
    }
    items: {
      id: string
      productName: string
      sku: string
      unit: string
      quantity: string
      cancellableQuantity: string
      netDeliveredQuantity: string
      fulfillmentComplete: boolean
    }[]
  }
  deliveries: {
    id: string
    reference: string
    destination: string
    driverName: string | null
    assignmentId: string | null
    vehicleName: string | null
    plateNumber: string | null
    scheduledAt: string | null
    status: string
    createdAt: string
    updatedAt: string
    items: {
      orderItemId: string
      productName: string
      sku: string
      unit: string
      quantity: string
    }[]
  }[]
  stockMovements: {
    id: string
    transactionType: string
    quantityDelta: string
    note: string
    createdAt: string
    productName: string
    sku: string
    performedByName: string
  }[]
  history: RecordHistoryEntry[]
}

export type ReturnReceiptClassification = {
  condition: string
  acceptedQuantity: string
  remainderCondition?: string
}

export type LegacyDeliveryReconciliation = {
  orderId: string
  stockMode: 'Reserved' | 'LegacyConsumed'
  requiresReconciliation: boolean
  deliveries: {
    id: string
    reference: string
    status: string
    allocationOrigin: string
    allocationStatus: 'Verified' | 'Unverified'
    allocationVerifiedAt: string | null
    allocationVerifiedBy: string | null
    items: {
      orderItemId: string
      productName: string
      sku: string
      unit: string
      orderedQuantity: string
      cancelledQuantity: string
      quantity: string
      inferredQuantity: string | null
    }[]
  }[]
}

export type CreateDeliveryValues = {
  orderId: string
  destination: string
  driverName?: string
  driverId?: string
  vehicleId?: string
  scheduledAt?: string
  items: { orderItemId: string; quantity: string }[]
}

export type CreateRecordPayload =
  CreateRecordValues | CreateTransferValues | CreateOrderValues | CreateDeliveryValues

export type TransferOptions = InventoryOptions

export type TransferDetailResponse = {
  id: string
  reference: string
  status: string
  note: string | null
  fromBranchId: string
  fromBranchName: string
  toBranchId: string
  toBranchName: string
  requestedBy: string
  requestedByName: string | null
  createdAt: string
  items: {
    id: string
    productId: string
    productName: string
    sku: string
    unit: string
    quantity: string
  }[]
  history: RecordHistoryEntry[]
  historyTotal: number
  historyPage: number
  historyPageSize: number
}

export type UserManagementOptions = {
  roles: {
    id: string
    name: string
    description?: string | null
    isSystem: number
    permissions: string[]
  }[]
  branches: SelectOption[]
  permissions: string[]
}

export type RoleRecord = {
  id: string
  name: string
  description: string | null
  isSystem: number
  permissions: string[]
  createdAt: string
  assignedUserCount: number
  canManage: boolean
  managementReason: string | null
}

export type UserAccountRecord = {
  id: string
  name: string
  email: string
  roleId: string
  roleName: string
  roleDescription: string | null
  branchId: string | null
  branchName: string | null
  isCrossBranch: boolean
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  permissions: string[]
  canManage: boolean
  managementReason: string | null
}

export type UserDetailResponse = {
  user: UserAccountRecord
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}

export type RoleDetailResponse = {
  role: RoleRecord
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}

export type UserAccountValues = {
  name: string
  email: string
  password?: string
  roleId: string
  branchId: string | null
  isCrossBranch: boolean
}

export type RoleValues = {
  name: string
  description: string
  permissions: string[]
}
