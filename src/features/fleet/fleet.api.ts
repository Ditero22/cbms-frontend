import { apiRequest } from '@/services/api/client'
import type {
  AssignmentRecord,
  AssignmentValues,
  FleetOptions,
  FleetHistory,
  MaintenanceRecord,
  MaintenanceValues,
  VehicleDetail,
  VehicleValues,
} from './types'

const send = <T = { id: string }>(path: string, method: 'POST' | 'PATCH', input: unknown = {}) =>
  apiRequest<T>(path, { method, body: JSON.stringify(input) })
export const getFleetOptions = () => apiRequest<FleetOptions>('/vehicles/options')
export const getVehicleDetail = (
  id: string,
  historyPage = 1,
  maintenancePage = 1,
  assignmentPage = 1,
) =>
  apiRequest<VehicleDetail>(
    `/vehicles/${id}?historyPage=${historyPage}&maintenancePage=${maintenancePage}&assignmentPage=${assignmentPage}`,
  )
export const saveVehicle = (id: string | null, values: VehicleValues) => {
  const input: Partial<VehicleValues> = { ...values }
  if (id) delete input.branchId
  return send(id ? `/vehicles/${id}` : '/vehicles', id ? 'PATCH' : 'POST', input)
}
export const changeVehicleStatus = (
  id: string,
  status: 'Available' | 'Under Maintenance' | 'Unavailable',
) => send(`/vehicles/${id}/status`, 'PATCH', { status })
export const archiveVehicle = (id: string) => send(`/vehicles/${id}/archive`, 'PATCH')
export const getMaintenanceDetail = (id: string, historyPage = 1) =>
  apiRequest<{ maintenance: MaintenanceRecord } & FleetHistory>(
    `/vehicle-maintenance/${id}?historyPage=${historyPage}`,
  )
export const saveMaintenance = (
  vehicleId: string,
  id: string | null,
  values: MaintenanceValues,
) => {
  const input: Partial<MaintenanceValues> = { ...values }
  if (id) delete input.branchId
  return send(
    id ? `/vehicle-maintenance/${id}` : `/vehicles/${vehicleId}/maintenance`,
    id ? 'PATCH' : 'POST',
    input,
  )
}
export const transitionMaintenance = (id: string, action: 'start' | 'complete' | 'cancel') =>
  send(`/vehicle-maintenance/${id}/${action}`, 'POST')
export const saveAssignment = (values: AssignmentValues) =>
  send(
    '/vehicle-assignments',
    'POST',
    Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => key === 'notes' || (value !== null && value !== undefined),
      ),
    ),
  )
export const transitionAssignment = (
  id: string,
  action: 'start' | 'complete' | 'cancel',
  input: { endOdometer?: string | null; notes?: string | null } = {},
) =>
  send(`/vehicle-assignments/${id}/${action}`, 'POST', {
    ...input,
    endOdometer: input.endOdometer || undefined,
  })
export const getAssignmentDetail = (id: string, historyPage = 1) =>
  apiRequest<{ assignment: AssignmentRecord } & FleetHistory>(
    `/vehicle-assignments/${id}?historyPage=${historyPage}`,
  )
