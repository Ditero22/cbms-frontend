import type { ReportType } from './types'
export const reportOptions: {
  id: ReportType
  label: string
  description: string
  permission?: string
}[] = [
  {
    id: 'sales-by-branch',
    label: 'Completed sales by branch',
    description:
      'Completed orders created in the selected dates. Contractual value, receipts, refunds, and net collections are separate current totals.',
  },
  {
    id: 'approved-expenses',
    label: 'Approved expenses by category',
    description:
      'Approved expenses only. Linked maintenance and released allowances are counted once through their expense record.',
  },
  {
    id: 'inventory-health',
    label: 'Current inventory health',
    description: 'Current tracked products and stock alerts by branch.',
  },
  {
    id: 'fleet-status',
    label: 'Current fleet availability',
    description:
      'Available, On Service, and Under Maintenance vehicles. Existing legacy holds remain Unavailable.',
    permission: 'vehicles.read',
  },
  {
    id: 'fleet-assignments',
    label: 'Driver trips & fleet assignments',
    description:
      'Assignments by actual start date, or scheduled/creation date if not started. Includes driver, vehicle, customer, destination, and start/end times.',
    permission: 'vehicles.assign',
  },
  {
    id: 'fleet-maintenance',
    label: 'Maintenance & repair expenses',
    description:
      'Recorded repair costs by start date, or creation date if not started. Open estimates are separate from completed maintenance and expense approval.',
    permission: 'vehicles.maintenance',
  },
  {
    id: 'driver-allowances',
    label: 'Legacy allowance releases & receipts',
    description:
      'Historical allowances, including release, receipt status, and proof count. New employee allowances are recorded in payroll.',
    permission: 'driver-allowances.read',
  },
  {
    id: 'customer-balances',
    label: 'Current customer balances',
    description:
      'Every order’s current total, receipts, processed refunds, net paid, and balance. Includes unpaid, partially paid, and fully paid orders.',
    permission: 'payments.read',
  },
  {
    id: 'customer-payment-history',
    label: 'Customer receipt history',
    description:
      'Individual immutable receipts by their actual payment date. This receipt report is separate from contractual sales and refunds.',
    permission: 'payments.read',
  },
]
export const reportStatuses: Partial<Record<ReportType, string[]>> = {
  'fleet-status': ['Available', 'On Service', 'Under Maintenance', 'Unavailable'],
  'fleet-assignments': ['Scheduled', 'Active', 'Completed', 'Cancelled'],
  'fleet-maintenance': ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
  'driver-allowances': ['Pending', 'Approved', 'Released', 'Received', 'Cancelled'],
  'customer-balances': ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Overpaid'],
  'customer-payment-history': ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Overpaid'],
}
