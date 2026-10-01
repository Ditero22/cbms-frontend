import { useQuery } from '@tanstack/react-query'
import type { ModuleListQuery } from '../types'
import {
  getDeliveryOptions,
  getEmployeeOptions,
  getModuleRecords,
  getOrderOptions,
  getTransferOptions,
} from '../modules.api'

type UseModulePageQueriesInput = {
  moduleId: string
  canReadModule: boolean
  listQuery: ModuleListQuery
  permissions: string[]
  isCrossBranch: boolean
}

export function useModulePageQueries({
  moduleId,
  canReadModule,
  listQuery,
  permissions,
  isCrossBranch,
}: UseModulePageQueriesInput) {
  const moduleQuery = useQuery({
    queryKey: ['module', moduleId, listQuery],
    queryFn: () => getModuleRecords(moduleId, listQuery),
    enabled:
      canReadModule &&
      ![
        'reports',
        'users',
        'payments',
        'vehicles',
        'driver-allowances',
        'inventory',
        'expenses',
        'payroll',
      ].includes(moduleId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === moduleId ? previousData : undefined,
  })
  const orderOptionsQuery = useQuery({
    queryKey: ['order-options'],
    queryFn: getOrderOptions,
    enabled: canReadModule && moduleId === 'orders' && permissions.includes('orders.create'),
  })
  const deliveryOptionsQuery = useQuery({
    queryKey: ['delivery-options'],
    queryFn: getDeliveryOptions,
    enabled:
      canReadModule && moduleId === 'deliveries' && permissions.includes('deliveries.create'),
  })
  const transferOptionsQuery = useQuery({
    queryKey: ['transfer-options'],
    queryFn: getTransferOptions,
    enabled:
      canReadModule &&
      moduleId === 'transfers' &&
      permissions.includes('inventory.transfer') &&
      isCrossBranch,
  })
  const employeeOptionsQuery = useQuery({
    queryKey: ['employee-options'],
    queryFn: getEmployeeOptions,
    enabled:
      canReadModule &&
      moduleId === 'employees' &&
      (permissions.includes('employees.create') || permissions.includes('employees.update')),
  })

  return {
    moduleQuery,
    orderOptionsQuery,
    deliveryOptionsQuery,
    transferOptionsQuery,
    employeeOptionsQuery,
  }
}
