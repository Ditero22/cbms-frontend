import type { RecordHistoryEntry, SelectOption } from '@/features/modules/types'

export type VehicleStatus = 'Available' | 'On Service' | 'Under Maintenance' | 'Unavailable'
export type VehicleRecord = {
  id: string
  branchId: string | null
  name: string
  plateNumber: string
  vehicleType: string
  brand: string | null
  model: string | null
  year: number | null
  color: string | null
  fuelType: string | null
  odometer: string | null
  capacityValue: string | null
  capacityUnit: string | null
  defaultDriverId: string | null
  defaultDriverName: string | null
  registrationExpiresOn: string | null
  insuranceProvider: string | null
  insuranceReference: string | null
  insuranceExpiresOn: string | null
  nextServiceAt: string | null
  notes: string | null
  assignedDriver: string | null
  status: VehicleStatus
  manualStatus?: 'Unavailable' | 'Under Maintenance' | null
  createdAt: string
  updatedAt: string
}
export type VehicleValues = Omit<
  VehicleRecord,
  | 'id'
  | 'defaultDriverName'
  | 'assignedDriver'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'manualStatus'
>
export type FleetOptions = {
  branches: SelectOption[]
  drivers: (SelectOption & { branchId: string; availability?: string })[]
  vehicles: (SelectOption & {
    branchId: string | null
    status: VehicleStatus
    plateNumber: string
    capacityValue: string | null
    capacityUnit: string | null
  })[]
  deliveries: { id: string; reference: string; branchId: string; destination: string }[]
  assignments: {
    id: string
    reference: string
    driverId: string
    branchId: string
    deliveryId: string | null
  }[]
  vehicleTypes: string[]
  capacityUnits: string[]
  maintenanceTypes: string[]
}
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
export type MaintenanceRecord = {
  id: string
  reference: string
  vehicleId: string
  branchId: string
  maintenanceType: string
  description: string
  problemReported: string | null
  startedOn: string | null
  completedOn: string | null
  serviceProvider: string | null
  contactPerson: string | null
  laborCost: string
  partsCost: string
  otherCost: string
  totalCost: string
  receiptReference: string | null
  notes: string | null
  expenseId: string | null
  status: MaintenanceStatus
  createdAt: string
  updatedAt: string
}
export type MaintenanceValues = Omit<
  MaintenanceRecord,
  | 'id'
  | 'reference'
  | 'vehicleId'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'totalCost'
  | 'expenseId'
  | 'completedOn'
>
export type AssignmentStatus = 'Scheduled' | 'Active' | 'Completed' | 'Cancelled'
export type AssignmentRecord = {
  id: string
  reference: string
  vehicleId: string
  vehicleName: string
  plateNumber: string
  driverId: string
  driverName: string
  branchId: string
  deliveryId: string | null
  destination: string
  purpose: string
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  startOdometer: string | null
  endOdometer: string | null
  status: AssignmentStatus
  notes: string | null
  createdAt: string
}
export type AssignmentValues = {
  vehicleId: string
  driverId: string
  branchId: string
  deliveryId?: string | null
  destination: string
  purpose: string
  scheduledAt?: string | null
  startOdometer?: string | null
  notes?: string | null
}
export type VehicleDetail = {
  vehicle: VehicleRecord
  maintenance: MaintenanceRecord[]
  assignments: AssignmentRecord[]
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
  totalMaintenanceCost: string
  currentMaintenance: MaintenanceRecord | null
  maintenancePage: number
  maintenanceTotal: number
  assignmentPage: number
  assignmentTotal: number
  activityPageSize: number
}
export type FleetHistory = {
  history: RecordHistoryEntry[]
  historyPage: number
  historyPageSize: number
  historyTotal: number
}
