import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { getModuleRecords } from '@/features/modules/modules.api'
import { modules } from '@/features/modules/modules'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { QueryState } from '@/components/common/QueryState'
import { FleetConfirmDialog } from './FleetConfirmDialog'
import { VehicleRecordDialog } from './VehicleRecordDialog'
import { VehicleDetailDialog } from './VehicleDetailDialog'
import { MaintenanceRecordDialog } from './MaintenanceRecordDialog'
import { MaintenanceDetailDialog } from './MaintenanceDetailDialog'
import { FleetAssignmentDialog } from './FleetAssignmentDialog'
import { AssignmentDetailDialog } from './AssignmentDetailDialog'
import {
  archiveVehicle,
  changeVehicleStatus,
  getFleetOptions,
  saveAssignment,
  saveMaintenance,
  saveVehicle,
} from './fleet.api'
import { useFleetMutation } from './useFleetMutation'
import type { MaintenanceRecord, VehicleRecord } from './types'
import './fleet.css'

const module = modules.find((candidate) => candidate.id === 'vehicles')!
export function FleetPage() {
  const runtime = useModuleRuntime()
  const mutation = useFleetMutation()
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'vehicle' | 'maintenance' | 'assignment' | null>(null)
  const [vehicleEditor, setVehicleEditor] = useState<VehicleRecord | null>(null)
  const [maintenanceEditor, setMaintenanceEditor] = useState<MaintenanceRecord | null>(null)
  const [maintenanceId, setMaintenanceId] = useState<string | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{
    record: VehicleRecord
    status?: 'Available' | 'Under Maintenance' | 'Unavailable'
    archive?: boolean
  } | null>(null)
  const records = useQuery({
    queryKey: ['module', 'vehicles', query],
    queryFn: () => getModuleRecords('vehicles', query),
    placeholderData: (previous) => previous,
  })
  const options = useQuery({
    queryKey: ['fleet-options'],
    queryFn: getFleetOptions,
  })
  const canMaintain =
    runtime.permissions.includes('vehicles.maintenance') &&
    runtime.permissions.includes('expenses.read')
  function closeForm() {
    setMode(null)
    setVehicleEditor(null)
    setMaintenanceEditor(null)
  }
  async function confirm() {
    if (!confirmation) return
    const { record, status, archive } = confirmation
    const saved = await mutation.run(
      () => (archive ? archiveVehicle(record.id) : changeVehicleStatus(record.id, status!)),
      archive ? 'Vehicle archived.' : 'Vehicle availability updated.',
    )
    if (saved) {
      setConfirmation(null)
      if (archive) setSelectedId(null)
    }
  }
  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Operations' },
          { label: 'Vehicles' },
        ]}
      />
      <PageHeading title={module.title} description={module.description}>
        {runtime.permissions.includes('vehicles.create') && (
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setSelectedId(null)
              setVehicleEditor(null)
              setMode('vehicle')
            }}
          >
            <Plus size={16} />
            Add vehicle
          </button>
        )}
      </PageHeading>
      <QueryState
        className="fleet-state"
        loading={records.isPending}
        error={records.error}
        onRetry={() => void records.refetch()}
      >
        <DataTable
          module={module}
          rows={records.data?.data ?? []}
          total={records.data?.total ?? 0}
          statusOptions={records.data?.statusOptions ?? []}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => setSelectedId(row.id)}
          isCrossBranch={runtime.isCrossBranch && runtime.permissions.includes('branches.read')}
          branchOptions={options.data?.branches.map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
          busy={records.isFetching}
        />
      </QueryState>
      {selectedId && (
        <VehicleDetailDialog
          id={selectedId}
          open={!mode && !maintenanceId && !assignmentId && !confirmation}
          onClose={() => setSelectedId(null)}
          permissions={runtime.permissions}
          onEdit={(record) => {
            setVehicleEditor(record)
            setMode('vehicle')
          }}
          onStatus={(record, status) => {
            mutation.clearError()
            setConfirmation({ record, status })
          }}
          onArchive={(record) => {
            mutation.clearError()
            setConfirmation({ record, archive: true })
          }}
          onMaintenance={() => {
            setMaintenanceEditor(null)
            setMode('maintenance')
          }}
          onViewMaintenance={setMaintenanceId}
          onAssign={() => setMode('assignment')}
          onViewAssignment={setAssignmentId}
        />
      )}
      <VehicleRecordDialog
        serverFieldErrors={mutation.fieldErrors}
        submitError={mutation.error}
        open={mode === 'vehicle'}
        onClose={closeForm}
        record={vehicleEditor}
        options={options.data}
        loading={options.isPending}
        optionsError={options.error?.message}
        onRetry={() => void options.refetch()}
        onSave={(id, values) =>
          mutation.run(() => saveVehicle(id, values), id ? 'Vehicle updated.' : 'Vehicle created.')
        }
      />
      {selectedId && (
        <MaintenanceRecordDialog
          serverFieldErrors={mutation.fieldErrors}
          submitError={mutation.error}
          open={mode === 'maintenance'}
          onClose={closeForm}
          record={maintenanceEditor}
          options={options.data}
          loading={options.isPending}
          error={options.error?.message}
          onRetry={() => void options.refetch()}
          onSave={(id, values) =>
            mutation.run(() => saveMaintenance(selectedId, id, values), 'Maintenance saved.')
          }
        />
      )}
      {maintenanceId && (
        <MaintenanceDetailDialog
          key={maintenanceId}
          id={maintenanceId}
          onClose={() => setMaintenanceId(null)}
          canManage={canMaintain}
          canReadAudit={runtime.permissions.includes('audit.read')}
          onEdit={(record) => {
            setMaintenanceId(null)
            setMaintenanceEditor(record)
            setMode('maintenance')
          }}
        />
      )}
      {selectedId && (
        <FleetAssignmentDialog
          serverFieldErrors={mutation.fieldErrors}
          submitError={mutation.error}
          open={mode === 'assignment'}
          vehicleId={selectedId}
          options={options.data}
          loading={options.isPending}
          error={options.error?.message}
          onRetry={() => void options.refetch()}
          onClose={closeForm}
          onSave={(values) =>
            mutation.run(() => saveAssignment(values), 'Driver and vehicle reserved.')
          }
        />
      )}
      {assignmentId && (
        <AssignmentDetailDialog
          key={assignmentId}
          id={assignmentId}
          onClose={() => setAssignmentId(null)}
          canManage={runtime.permissions.includes('vehicles.assign')}
          canReadAudit={runtime.permissions.includes('audit.read')}
        />
      )}
      {confirmation && (
        <FleetConfirmDialog
          title={
            confirmation.archive
              ? 'Archive this vehicle?'
              : `Mark this vehicle as ${confirmation.status}?`
          }
          description={
            confirmation.archive
              ? `${confirmation.record.name} will be removed from active lists. Its maintenance, assignments, and history remain recorded.`
              : `Update ${confirmation.record.name}. Active assignments or maintenance may prevent this change.`
          }
          confirmLabel={confirmation.archive ? 'Archive vehicle' : 'Confirm'}
          danger={confirmation.archive}
          busy={mutation.busy}
          error={mutation.error}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  )
}
