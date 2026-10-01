export type CreateField = {
  name: string
  label: string
  required?: boolean
  type?: string
  maxLength?: number
  minLength?: number
  hint?: string
  options?: { value: string; label: string }[]
}

export const createFieldsByModule: Record<string, CreateField[]> = {
  branches: [
    { name: 'name', label: 'Branch name', required: true, minLength: 2, maxLength: 120 },
    {
      name: 'code',
      label: 'Branch code',
      required: true,
      minLength: 2,
      maxLength: 24,
      hint: 'Use letters, numbers, or hyphens.',
    },
    { name: 'managerName', label: 'Manager', maxLength: 180 },
    { name: 'phone', label: 'Phone', type: 'tel', maxLength: 40 },
    { name: 'email', label: 'Email', type: 'email', maxLength: 254 },
    { name: 'address', label: 'Address', type: 'textarea', maxLength: 400 },
  ],
  employees: [
    { name: 'employeeNumber', label: 'Employee ID', required: true },
    { name: 'name', label: 'Full name', required: true },
    { name: 'position', label: 'Position', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone' },
  ],
  customers: [
    { name: 'name', label: 'Customer name', required: true, minLength: 2, maxLength: 180 },
    { name: 'contactName', label: 'Contact', maxLength: 180 },
    { name: 'email', label: 'Email', type: 'email', maxLength: 254 },
    { name: 'phone', label: 'Phone', type: 'tel', maxLength: 40 },
    { name: 'location', label: 'Location', maxLength: 240 },
  ],
  suppliers: [
    { name: 'name', label: 'Supplier name', required: true, minLength: 2, maxLength: 180 },
    { name: 'contactName', label: 'Contact', maxLength: 180 },
    { name: 'email', label: 'Email', type: 'email', maxLength: 254 },
    { name: 'phone', label: 'Phone', type: 'tel', maxLength: 40 },
    { name: 'category', label: 'Category', maxLength: 120 },
    { name: 'paymentTerms', label: 'Payment terms', maxLength: 120 },
  ],
  products: [
    { name: 'name', label: 'Product name', required: true, minLength: 2, maxLength: 180 },
    { name: 'sku', label: 'SKU', required: true, minLength: 2, maxLength: 80 },
    { name: 'category', label: 'Category', required: true, minLength: 2, maxLength: 120 },
    {
      name: 'unit',
      label: 'Unit',
      required: true,
      minLength: 1,
      maxLength: 40,
      hint: 'For example: bag, piece, kg, or m³. Stock uses this unit.',
    },
    { name: 'unitPrice', label: 'Unit price', required: true, type: 'number' },
    { name: 'supplierId', label: 'Supplier', type: 'select' },
    {
      name: 'description',
      label: 'Specifications / description',
      type: 'textarea',
      maxLength: 2000,
    },
  ],
  orders: [],
}

export function validateCreateField(field: CreateField, value: string) {
  const text = value.trim()
  if (!text) return field.required ? `${field.label} is required.` : true
  if (field.minLength && text.length < field.minLength)
    return `${field.label} must be at least ${field.minLength} characters.`
  if (field.maxLength && text.length > field.maxLength)
    return `${field.label} must be ${field.maxLength} characters or fewer.`
  if (field.name === 'code' && !/^[a-z0-9-]+$/i.test(text))
    return 'Use letters, numbers, or hyphens for the branch code.'
  if (field.name === 'unitPrice' && !/^\d{1,12}(?:\.\d{1,2})?$/.test(text))
    return 'Enter a non-negative price with up to 12 digits and 2 decimal places.'
  return true
}

export function canCreateModuleRecord(
  moduleId: string,
  permissions: string[],
  isCrossBranch = false,
) {
  const permissionByModule: Record<string, string> = {
    branches: 'branches.create',
    users: 'users.create',
    employees: 'employees.create',
    customers: 'customers.create',
    suppliers: 'suppliers.create',
    products: 'products.create',
    vehicles: 'vehicles.create',
    expenses: 'expenses.create',
    inventory: 'inventory.adjust',
    transfers: 'inventory.transfer',
    orders: 'orders.create',
    payments: 'payments.create',
    deliveries: 'deliveries.create',
  }
  const requiredPermission = permissionByModule[moduleId]
  const hasPermission = Boolean(requiredPermission && permissions.includes(requiredPermission))

  if (moduleId === 'transfers') {
    return hasPermission && isCrossBranch
  }

  return hasPermission
}
