type PermissionDescription = { label: string; description: string }

const modules: Record<string, { title: string; records: string }> = {
  users: { title: 'Users', records: 'users' },
  roles: { title: 'Roles', records: 'roles' },
  branches: { title: 'Branches', records: 'branches' },
  employees: { title: 'Employees', records: 'employees' },
  customers: { title: 'Customers', records: 'customers' },
  suppliers: { title: 'Suppliers', records: 'suppliers' },
  products: { title: 'Products', records: 'products' },
  inventory: { title: 'Inventory', records: 'inventory' },
  transfers: { title: 'Transfers', records: 'transfers' },
  orders: { title: 'Orders', records: 'orders' },
  payments: { title: 'Payments & refunds', records: 'payments' },
  deliveries: { title: 'Deliveries', records: 'deliveries' },
  returns: { title: 'Returns', records: 'returns' },
  vehicles: { title: 'Vehicles', records: 'vehicles' },
  'driver-allowances': { title: 'Driver allowances', records: 'driver allowances' },
  expenses: { title: 'Expenses', records: 'expenses' },
  payroll: { title: 'Payroll', records: 'payroll records' },
  sales: { title: 'Sales', records: 'sales' },
  reports: { title: 'Reports', records: 'reports' },
  audit: { title: 'Audit history', records: 'audit history' },
}

const specificPermissions: Record<string, PermissionDescription> = {
  'vehicles.assign': {
    label: 'Manage vehicle assignments',
    description: 'Reserve eligible drivers and vehicles, and manage standalone trips.',
  },
  'vehicles.maintenance': {
    label: 'Manage vehicle maintenance',
    description: 'Record and complete maintenance. Reading expenses is also required.',
  },
  'driver-allowances.approve': {
    label: 'Approve driver allowances',
    description: 'Authorize pending driver payments within your branch access.',
  },
  'driver-allowances.release': {
    label: 'Release driver allowances',
    description: 'Record actual payment release and its business expense.',
  },
  'driver-allowances.receive': {
    label: 'Confirm driver receipt',
    description: 'Confirm receipt using transaction proof or an acknowledgement.',
  },
  'driver-allowances.cancel': {
    label: 'Cancel driver allowances',
    description: 'Cancel pending or approved allowances before money is released.',
  },
  'users.update': {
    label: 'Edit users',
    description: 'Change account assignments or status and reset passwords within your access.',
  },
  'roles.update': {
    label: 'Edit roles',
    description: 'Update custom role permissions and delete unused custom roles.',
  },
  'inventory.adjust': {
    label: 'Adjust stock',
    description: 'Record stock quantity adjustments with a reason.',
  },
  'inventory.reorder': {
    label: 'Set reorder points',
    description: 'Update branch stock thresholds used to identify low inventory.',
  },
  'inventory.transfer': {
    label: 'Transfer stock',
    description: 'Move stock between branches. Cross-branch access is also required.',
  },
  'orders.complete': {
    label: 'Complete orders',
    description: 'Complete orders after fulfillment, payment and outstanding workflow checks.',
  },
  'orders.cancel': {
    label: 'Cancel order quantities',
    description: 'Cancel eligible quantities after required refunds and returns are resolved.',
  },
  'payments.create': {
    label: 'Record payments',
    description: 'Record payments against orders within the outstanding balance.',
  },
  'payments.refund.request': {
    label: 'Request refunds',
    description: 'Submit a refund request against a recorded payment.',
  },
  'payments.refund.approve': {
    label: 'Review refunds',
    description: 'Approve or reject requested refunds.',
  },
  'payments.refund.process': {
    label: 'Process refunds',
    description: 'Record settlement of approved refunds after returning funds to the customer.',
  },
  'deliveries.update': {
    label: 'Update deliveries',
    description: 'Change delivery status and verify historical delivery quantities.',
  },
  'returns.create': {
    label: 'Request returns',
    description: 'Request the return of delivered order quantities.',
  },
  'returns.approve': {
    label: 'Review returns',
    description: 'Approve or reject requested returns.',
  },
  'returns.receive': {
    label: 'Receive returns',
    description: 'Classify received goods and restore accepted resalable quantities to stock.',
  },
  'expenses.approve': {
    label: 'Review expenses',
    description: 'Approve or reject submitted expenses.',
  },
  'payroll.update': {
    label: 'Edit draft payroll runs',
    description: 'Change employee pay lines before a run is processed.',
  },
  'payroll.process': {
    label: 'Process payroll runs',
    description: 'Freeze draft pay-run amounts before recording individual payments.',
  },
  'payroll.pay': {
    label: 'Record employee payments',
    description: 'Record the actual payment date, method and reference for a processed pay entry.',
  },
  'payroll.receive': {
    label: 'Confirm employee receipt',
    description: 'Confirm payment receipt with an employee acknowledgement or private proof.',
  },
  'reports.view': { label: 'View reports', description: 'Open available business reports.' },
  'reports.export': {
    label: 'Export reports',
    description: 'Download available business reports as CSV files.',
  },
  'sales.read': {
    label: 'Read sales details',
    description: 'View order details and linked payment, delivery, refund and return records.',
  },
  'audit.read': {
    label: 'Read audit history',
    description: 'View permitted record changes, actors and timestamps in the audit log.',
  },
}

export function describePermission(key: string) {
  const [module, action] = key.split('.')
  const context = modules[module]
  const group = context?.title ?? humanize(module)
  const records = context?.records ?? humanize(module).toLowerCase()
  const specific = specificPermissions[key]
  if (specific) return { key, group, ...specific }
  if (action === 'read')
    return {
      key,
      group,
      label: `Read ${records}`,
      description: `View ${records} within your access.`,
    }
  if (action === 'create')
    return {
      key,
      group,
      label: `Create ${records}`,
      description: `Add ${records} within your access.`,
    }
  if (action === 'update')
    return {
      key,
      group,
      label: `Edit ${records}`,
      description: `Update ${records} within your access.`,
    }
  return {
    key,
    group,
    label: humanize(key.replaceAll('.', ' ')),
    description: 'Subject to account access and workflow checks.',
  }
}

export const getPermissionLabel = (key: string) => describePermission(key).label

function humanize(value: string) {
  const text = value.replaceAll('-', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
