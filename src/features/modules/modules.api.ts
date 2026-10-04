import { apiDownload, apiRequest } from '@/services/api/client'
import type { LegacyDeliveryReconciliation } from './types'
import type {
  CreateRecordPayload,
  DeliveryOptions,
  DeliveryDetailResponse,
  DeliveryStatus,
  InventoryOptions,
  ModuleRecordResponse,
  ModuleListQuery,
  OrderDetailResponse,
  EmployeeOptions,
  EmployeeDetailResponse,
  EmployeeValues,
  ManagedModuleId,
  ManagedRecord,
  OrderOptions,
  TransferOptions,
  TransferDetailResponse,
  RoleRecord,
  RoleValues,
  UserAccountValues,
  UserManagementOptions,
  UserDetailResponse,
  RoleDetailResponse,
  ReportData,
  ReportType,
  ReportFilters,
} from './types'

export function getModuleRecords(moduleId: string, query: ModuleListQuery) {
  const params = new URLSearchParams()
  params.set('page', query.page.toString())
  params.set('limit', query.limit.toString())
  if (query.search) params.set('search', query.search)
  if (query.branchId) params.set('branchId', query.branchId)
  if (query.status) params.set('status', query.status)
  if (query.sort) {
    params.set('sort', query.sort)
    params.set('order', query.order)
  }

  return apiRequest<ModuleRecordResponse>(`/${moduleId}?${params.toString()}`)
}

export function getReportData(
  report: ReportType,
  dateFrom: string,
  dateTo: string,
  filters: ReportFilters = {},
) {
  const params = new URLSearchParams({ report, dateFrom, dateTo })
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return apiRequest<ReportData>(`/reports/data?${params.toString()}`)
}

export function downloadReport(
  report: ReportType,
  dateFrom: string,
  dateTo: string,
  filters: ReportFilters = {},
) {
  const params = new URLSearchParams({ report, dateFrom, dateTo })
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const period = ['inventory-health', 'customer-balances', 'fleet-status'].includes(report)
    ? 'current'
    : `${dateFrom}-to-${dateTo}`
  return apiDownload(
    `/reports/export?${params.toString()}`,
    `materials-supply-operations-finance-${report}-${period}.csv`,
  )
}

export function getEmployeeOptions() {
  return apiRequest<EmployeeOptions>('/employees/options')
}

export function getEmployeeDetail(employeeId: string, historyPage = 1) {
  return apiRequest<EmployeeDetailResponse>(`/employees/${employeeId}?historyPage=${historyPage}`)
}

export function createEmployee(values: EmployeeValues) {
  return apiRequest<{ id: string }>('/employees', {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export function updateEmployee(employeeId: string, values: Partial<EmployeeValues>) {
  return apiRequest<{ id: string; status: string }>(`/employees/${employeeId}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

export function archiveEmployee(employeeId: string) {
  return apiRequest<{ id: string; archivedAt: string }>(`/employees/${employeeId}/archive`, {
    method: 'PATCH',
  })
}

export function getManagedRecord(moduleId: ManagedModuleId, recordId: string) {
  return apiRequest<ManagedRecord>(`/${moduleId}/${recordId}`)
}

export function updateManagedRecord(
  moduleId: ManagedModuleId,
  recordId: string,
  values: Record<string, string>,
) {
  return apiRequest<ManagedRecord>(`/${moduleId}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

export function archiveManagedRecord(moduleId: ManagedModuleId, recordId: string) {
  return apiRequest<{ id: string; archivedAt: string }>(`/${moduleId}/${recordId}/archive`, {
    method: 'PATCH',
  })
}

export function getInventoryOptions() {
  return apiRequest<InventoryOptions>('/inventory/options')
}

export function getOrderOptions() {
  return apiRequest<OrderOptions>('/orders/options')
}

export function getOrderDetail(orderId: string) {
  return apiRequest<OrderDetailResponse>(`/orders/${orderId}`)
}

export function getLegacyDeliveryReconciliation(orderId: string) {
  return apiRequest<LegacyDeliveryReconciliation>(
    `/orders/${orderId}/legacy-delivery-reconciliation`,
  )
}

export function reconcileLegacyDelivery(
  orderId: string,
  deliveryId: string,
  input: { note: string; items: { orderItemId: string; quantity: string }[] },
) {
  return apiRequest(`/orders/${orderId}/legacy-deliveries/${deliveryId}/reconcile`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function completeOrder(orderId: string) {
  return apiRequest<{ id: string; status: string }>(`/orders/${orderId}/complete`, {
    method: 'POST',
  })
}

export function cancelOrder(
  orderId: string,
  input: { reason: string; notes?: string; items: { orderItemId: string; quantity: string }[] },
) {
  return apiRequest<{ id: string; status: string }>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function requestOrderRefund(
  orderId: string,
  input: {
    requestKey: string
    paymentId: string
    amount: string
    method: string
    reason: string
    notes?: string
  },
) {
  return apiRequest<{ id: string; reference: string; status: string }>(
    `/orders/${orderId}/refunds`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function approveRefund(refundId: string) {
  return apiRequest<{ id: string; status: string }>(`/refunds/${refundId}/approve`, {
    method: 'PATCH',
  })
}

export function rejectRefund(refundId: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(`/refunds/${refundId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })
}

export function processRefund(refundId: string, reference?: string) {
  return apiRequest<{ id: string; status: string }>(`/refunds/${refundId}/process`, {
    method: 'PATCH',
    body: JSON.stringify({ reference }),
  })
}

export function requestOrderReturn(
  orderId: string,
  input: {
    requestKey: string
    deliveryId: string
    reason: string
    notes?: string
    items: { orderItemId: string; quantity: string }[]
  },
) {
  return apiRequest<{ id: string; reference: string; status: string }>(
    `/orders/${orderId}/returns`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function approveReturn(returnId: string) {
  return apiRequest<{ id: string; status: string }>(`/returns/${returnId}/approve`, {
    method: 'PATCH',
  })
}

export function rejectReturn(returnId: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(`/returns/${returnId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })
}

export function receiveReturn(
  returnId: string,
  items: {
    orderItemId: string
    condition: string
    acceptedQuantity: string
    remainderCondition?: string
  }[],
) {
  return apiRequest<{ id: string; status: string }>(`/returns/${returnId}/receive`, {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  })
}

export function getDeliveryOptions() {
  return apiRequest<DeliveryOptions>('/deliveries/options')
}

export function getDeliveryDetail(deliveryId: string, historyPage = 1) {
  return apiRequest<DeliveryDetailResponse>(
    `/deliveries/${encodeURIComponent(deliveryId)}?historyPage=${historyPage}`,
  )
}

export function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  input: { endOdometer?: string; notes?: string } = {},
) {
  return apiRequest<{ id: string; status: DeliveryStatus }>(`/deliveries/${deliveryId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...input }),
  })
}

export function getTransferOptions() {
  return apiRequest<TransferOptions>('/transfers/options')
}

export function getTransferDetail(transferId: string, historyPage = 1) {
  return apiRequest<TransferDetailResponse>(
    `/transfers/${encodeURIComponent(transferId)}?historyPage=${historyPage}`,
  )
}

export function getUserManagementOptions() {
  return apiRequest<UserManagementOptions>('/users/options')
}

export function getRoles() {
  return apiRequest<RoleRecord[]>('/roles')
}

export function getUserDetail(userId: string, historyPage = 1) {
  return apiRequest<UserDetailResponse>(`/users/${userId}?historyPage=${historyPage}`)
}

export function getRoleDetail(roleId: string, historyPage = 1) {
  return apiRequest<RoleDetailResponse>(`/roles/${roleId}?historyPage=${historyPage}`)
}

export function getRolePermissionOptions() {
  return apiRequest<string[]>('/roles/options')
}

export function createUser(values: UserAccountValues) {
  return apiRequest<{ id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export function resetUserPassword(userId: string, password: string) {
  return apiRequest<{ id: string }>(`/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function deleteUser(userId: string) {
  return apiRequest<{ id: string }>(`/users/${userId}`, { method: 'DELETE' })
}

export function updateUser(
  userId: string,
  values: Partial<Pick<UserAccountValues, 'name' | 'roleId' | 'branchId' | 'isCrossBranch'>> & {
    status?: 'Active' | 'Inactive'
  },
) {
  return apiRequest<{ id: string }>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

export function saveRole(roleId: string | null, values: RoleValues) {
  return apiRequest<{ id: string }>(roleId ? `/roles/${roleId}` : '/roles', {
    method: roleId ? 'PATCH' : 'POST',
    body: JSON.stringify(values),
  })
}

export function deleteRole(roleId: string) {
  return apiRequest<{ id: string }>(`/roles/${roleId}`, { method: 'DELETE' })
}

export function createModuleRecord(moduleId: string, values: CreateRecordPayload) {
  const endpoint =
    moduleId === 'inventory'
      ? '/inventory/adjustments'
      : moduleId === 'transfers'
        ? '/transfers'
        : `/${moduleId}`
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(values),
  })
}
