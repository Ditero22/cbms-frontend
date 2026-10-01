import type { QueryClient } from '@tanstack/react-query'

/** Master records appear in options, related details, and operational lists. */
export async function invalidateMasterData(client: QueryClient, moduleId: string) {
  const keys: string[][] = [
    ['module', moduleId],
    ['managed-record', moduleId],
    ['dashboard-summary'],
    ['report'],
  ]
  if (moduleId === 'branches')
    keys.push(
      ['session'],
      ['module', 'employees'],
      ['employee-detail'],
      ['user-management-options'],
      ['payroll-branch-options'],
      ['transfer-options'],
      ['expense-options'],
      ['module', 'users'],
      ['module', 'orders'],
      ['module', 'deliveries'],
      ['module', 'vehicles'],
      ['module', 'expenses'],
      ['module', 'payroll'],
      ['vehicle-detail'],
      ['assignment-detail'],
      ['expense-detail'],
      ['payroll-run'],
    )
  if (moduleId === 'branches' || moduleId === 'employees')
    keys.push(['employee-options'], ['fleet-options'], ['payroll-options'], ['allowance-options'])
  if (moduleId === 'employees') keys.push(['employee-detail'])
  if (moduleId === 'branches' || moduleId === 'products')
    keys.push(
      ['module', 'inventory'],
      ['inventory-detail'],
      ['inventory-options'],
      ['transfer-options'],
    )
  if (['branches', 'products', 'customers'].includes(moduleId))
    keys.push(
      ['order-options'],
      ['delivery-options'],
      ['payment-options'],
      ['module', 'orders'],
      ['order-detail'],
      ['module', 'payments'],
      ['customer-payment-detail'],
    )
  if (moduleId === 'suppliers') keys.push(['product-form-options'], ['managed-record', 'products'])
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}
