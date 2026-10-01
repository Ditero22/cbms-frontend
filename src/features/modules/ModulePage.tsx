import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { AppDialog } from '@/components/common/AppDialog'
import { ArchiveRecordDialog } from '@/components/common/ArchiveRecordDialog'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { CreateRecordDialog } from './CreateRecordDialog'
import { CreateOrderDialog } from './CreateOrderDialog'
import { CreateDeliveryDialog } from './CreateDeliveryDialog'
import { UpdateDeliveryStatusDialog } from './UpdateDeliveryStatusDialog'
import { UsersPage } from '@/features/users/UsersPage'
import { PaymentsPage } from '@/features/customer-payments/PaymentsPage'
import { FleetPage } from '@/features/fleet/FleetPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { ExpensesPage } from '@/features/expenses/ExpensesPage'
import { PayrollPage } from '@/features/payroll/PayrollPage'
import { getFleetOptions } from '@/features/fleet/fleet.api'
import { canCreateModuleRecord } from './create-fields'
import { useModuleRuntime } from './useModuleRuntime'
import {
  updateDeliveryStatus,
  createEmployee,
  updateEmployee,
  archiveEmployee as archiveEmployeeApi,
  getModuleRecords,
  updateManagedRecord,
  archiveManagedRecord,
} from './modules.api'
import { modules } from './modules'
import { canAccessModule } from './module-access'
import type {
  CreateOrderValues,
  CreateDeliveryValues,
  DeliveryStatus,
  CreateRecordPayload,
  RecordRow,
  ModuleListQuery,
  EmployeeRecord,
  EmployeeValues,
  ManagedModuleId,
  ManagedRecord,
} from './types'
import { InventoryTransferDialog } from './InventoryTransferDialog'
import { EmployeeRecordDialog } from './EmployeeRecordDialog'
import { EmployeeDetailDialog } from './EmployeeDetailDialog'
import { TransferDetailDialog } from './TransferDetailDialog'
import { DeliveryDetailDialog } from './DeliveryDetailDialog'
import { ManagedRecordDetailDialog } from './ManagedRecordDetailDialog'
import { OrderDetailDialog } from './OrderDetailDialog'
import { ReportsPage } from './ReportsPage'
import { useModulePageQueries } from './hooks/useModulePageQueries'
import { invalidateMasterData } from './hooks/invalidateMasterData'

export function ModulePage() {
  const { moduleId = '' } = useParams()
  const module = modules.find((candidate) => candidate.id === moduleId)
  const runtime = useModuleRuntime()
  const canReadModule = Boolean(
    module && moduleId !== 'driver-allowances' && canAccessModule(module, runtime),
  )
  const queryClient = useQueryClient()
  const [listQuery, setListQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  useEffect(() => {
    setListQuery({ page: 1, limit: 25, search: '', status: '', sort: '', order: 'asc' })
  }, [moduleId])
  const {
    moduleQuery,
    orderOptionsQuery,
    deliveryOptionsQuery,
    transferOptionsQuery,
    employeeOptionsQuery,
  } = useModulePageQueries({
    moduleId,
    canReadModule,
    listQuery,
    permissions: runtime.permissions,
    isCrossBranch: runtime.isCrossBranch,
  })
  const branchOptionsQuery = useQuery({
    queryKey: ['module', 'branches', 'branch-filter-options'],
    queryFn: () =>
      getModuleRecords('branches', {
        page: 1,
        limit: 100,
        search: '',
        status: '',
        sort: 'Branch',
        order: 'asc',
      }),
    enabled:
      Boolean(module?.columns.includes('Branch')) &&
      module?.id !== 'branches' &&
      runtime.isCrossBranch &&
      runtime.permissions.includes('branches.read') &&
      canReadModule,
  })

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [employeeBeingEdited, setEmployeeBeingEdited] = useState<EmployeeRecord | null>(null)
  const [employeeBeingArchived, setEmployeeBeingArchived] = useState<{
    id: string
    name: string
  } | null>(null)
  const [managedRecordBeingEdited, setManagedRecordBeingEdited] = useState<ManagedRecord | null>(
    null,
  )
  const [managedRecordBeingArchived, setManagedRecordBeingArchived] = useState<{
    id: string
    name: string
    moduleId: ManagedModuleId
  } | null>(null)
  const [deliveryBeingUpdated, setDeliveryBeingUpdated] = useState<{
    id: string
    status: string
  } | null>(null)
  const fleetOptionsQuery = useQuery({
    queryKey: ['fleet-options'],
    queryFn: getFleetOptions,
    enabled:
      moduleId === 'deliveries' &&
      createDialogOpen &&
      runtime.permissions.includes('vehicles.assign') &&
      runtime.permissions.includes('deliveries.create'),
  })

  if (!module) return <ModuleNotFound />
  if (moduleId === 'driver-allowances') return <Navigate to="/payroll?view=legacy" replace />
  if (!canReadModule) return <ModuleAccessDenied />
  const activeModule = module

  const canCreate = canCreateModuleRecord(
    activeModule.id,
    runtime.permissions,
    runtime.isCrossBranch,
  )
  const rows = moduleQuery.data?.data ?? []

  if (activeModule.id === 'reports') return <ReportsPage />
  if (activeModule.id === 'users') return <UsersPage />
  if (activeModule.id === 'payments') return <PaymentsPage />
  if (activeModule.id === 'vehicles') return <FleetPage />
  if (activeModule.id === 'inventory') return <InventoryPage />
  if (activeModule.id === 'expenses') return <ExpensesPage />
  if (activeModule.id === 'payroll') return <PayrollPage />

  function openCreateDialog() {
    setSaveError(undefined)
    if (activeModule.id === 'employees') {
      setEmployeeBeingEdited(null)
      setEmployeeDialogOpen(true)
      return
    }
    setManagedRecordBeingEdited(null)
    setCreateDialogOpen(true)
  }

  async function handleSaveEmployee(
    employeeId: string | null,
    values: EmployeeValues,
  ): Promise<boolean> {
    setSaveError(undefined)
    try {
      if (employeeId) {
        await updateEmployee(employeeId, { ...values, hiredAt: values.hiredAt || null })
      } else {
        const newEmployee = { ...values, hiredAt: values.hiredAt || undefined }
        delete newEmployee.status
        await createEmployee(newEmployee)
      }
      await invalidateMasterData(queryClient, 'employees')
      setEmployeeDialogOpen(false)
      setEmployeeBeingEdited(null)
      toast.success(employeeId ? 'Employee updated.' : 'Employee created.')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The employee could not be saved.'
      setSaveError(message)
      toast.error(message)
      return false
    }
  }

  async function handleArchiveEmployee() {
    if (!employeeBeingArchived) return
    try {
      await archiveEmployeeApi(employeeBeingArchived.id)
      await invalidateMasterData(queryClient, 'employees')
      setSelectedRecord(null)
      toast.success(`${employeeBeingArchived.name} was archived.`)
      setEmployeeBeingArchived(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The employee could not be archived.')
      throw error
    }
  }

  async function handleCreateRecord(values: CreateRecordPayload): Promise<boolean> {
    setSaveError(undefined)
    try {
      await runtime.createRecord(activeModule.id, values)
      setCreateDialogOpen(false)
      toast.success(`${activeModule.title} saved.`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The record could not be saved.'
      setSaveError(message)
      toast.error(message)
      return false
    }
  }

  async function handleSaveManagedRecord(recordId: string, values: Record<string, string>) {
    if (!isManagedModule(activeModule.id)) return false
    setSaveError(undefined)
    try {
      await updateManagedRecord(activeModule.id, recordId, values)
      await invalidateMasterData(queryClient, activeModule.id)
      setCreateDialogOpen(false)
      setManagedRecordBeingEdited(null)
      toast.success(`${singularModuleName(activeModule.id)} updated.`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The record could not be saved.'
      setSaveError(message)
      toast.error(message)
      return false
    }
  }

  async function handleArchiveManagedRecord() {
    if (!managedRecordBeingArchived) return
    try {
      await archiveManagedRecord(managedRecordBeingArchived.moduleId, managedRecordBeingArchived.id)
      await invalidateMasterData(queryClient, managedRecordBeingArchived.moduleId)
      setSelectedRecord(null)
      setManagedRecordBeingArchived(null)
      toast.success(`${managedRecordBeingArchived.name} was archived.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The record could not be archived.')
      throw error
    }
  }

  async function handleDeliveryStatusSave(
    deliveryId: string,
    status: DeliveryStatus,
    input: { endOdometer?: string; notes?: string } = {},
  ): Promise<boolean> {
    try {
      await updateDeliveryStatus(deliveryId, status, input)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['module', 'deliveries'] }),
        queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] }),
        queryClient.invalidateQueries({ queryKey: ['delivery-options'] }),
        queryClient.invalidateQueries({ queryKey: ['module', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-options'] }),
        queryClient.invalidateQueries({ queryKey: ['order-options'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
        queryClient.invalidateQueries({ queryKey: ['order-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['module', 'vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['fleet-options'] }),
      ])
      setDeliveryBeingUpdated(null)
      toast.success('Delivery status updated.')
      return true
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'The delivery status could not be updated.',
      )
      return false
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: activeModule.group },
          { label: activeModule.title },
        ]}
      />
      <PageHeading title={activeModule.title} description={activeModule.description}>
        {canCreate && (
          <button className="button button-primary" onClick={openCreateDialog}>
            <Plus size={17} />
            {activeModule.addLabel}
          </button>
        )}
      </PageHeading>

      {moduleQuery.isPending ? (
        <div className="table-empty">
          <strong>Loading {activeModule.title.toLowerCase()}…</strong>
        </div>
      ) : moduleQuery.isError ? (
        <div className="table-empty">
          <strong>Could not load {activeModule.title.toLowerCase()}.</strong>
          <span>{moduleQuery.error.message}</span>
          <button className="button button-outline" onClick={() => void moduleQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <DataTable
          module={activeModule}
          rows={rows}
          total={moduleQuery.data?.total ?? rows.length}
          statusOptions={moduleQuery.data?.statusOptions ?? []}
          query={listQuery}
          onQueryChange={setListQuery}
          onRowClick={setSelectedRecord}
          isCrossBranch={
            runtime.isCrossBranch &&
            (activeModule.id === 'customers' || runtime.permissions.includes('branches.read'))
          }
          branchOptions={[
            ...(activeModule.id === 'customers'
              ? [{ value: 'unassigned', label: 'Unassigned' }]
              : []),
            ...(branchOptionsQuery.data?.data
              .filter((row) => row.Status === 'Active')
              .map((row) => ({ value: row.id, label: row.Branch })) ?? []),
          ]}
          busy={moduleQuery.isFetching}
        />
      )}

      {activeModule.id === 'employees' ? (
        <EmployeeRecordDialog
          open={employeeDialogOpen}
          onOpenChange={(open) => {
            setEmployeeDialogOpen(open)
            if (!open) setEmployeeBeingEdited(null)
          }}
          employee={employeeBeingEdited}
          options={employeeOptionsQuery.data}
          isLoadingOptions={employeeOptionsQuery.isPending}
          optionsError={employeeOptionsQuery.error?.message}
          saveError={saveError}
          onRetryOptions={() => void employeeOptionsQuery.refetch()}
          onSave={handleSaveEmployee}
        />
      ) : activeModule.id === 'transfers' ? (
        <InventoryTransferDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateRecord}
          options={transferOptionsQuery.data}
          isLoadingOptions={transferOptionsQuery.isPending || transferOptionsQuery.isFetching}
          optionsError={transferOptionsQuery.error?.message}
          onRetryOptions={() => void transferOptionsQuery.refetch()}
          saveError={saveError}
        />
      ) : activeModule.id === 'orders' ? (
        <CreateOrderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={(values: CreateOrderValues) => handleCreateRecord(values)}
          options={orderOptionsQuery.data}
          isLoadingOptions={orderOptionsQuery.isPending || orderOptionsQuery.isFetching}
          optionsError={orderOptionsQuery.error?.message}
          onRetryOptions={() => void orderOptionsQuery.refetch()}
          saveError={saveError}
        />
      ) : activeModule.id === 'deliveries' ? (
        <CreateDeliveryDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={(values: CreateDeliveryValues) => handleCreateRecord(values)}
          options={deliveryOptionsQuery.data}
          isLoadingOptions={deliveryOptionsQuery.isPending}
          canAssign={runtime.permissions.includes('vehicles.assign')}
          fleetOptions={fleetOptionsQuery.data}
          isLoadingFleet={fleetOptionsQuery.isPending}
          fleetError={fleetOptionsQuery.error?.message}
          onRetryFleet={() => void fleetOptionsQuery.refetch()}
        />
      ) : (
        <CreateRecordDialog
          module={activeModule}
          isCrossBranch={runtime.isCrossBranch}
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) setManagedRecordBeingEdited(null)
          }}
          onCreate={handleCreateRecord}
          record={managedRecordBeingEdited}
          onSave={handleSaveManagedRecord}
          saveError={saveError}
        />
      )}
      {activeModule.id === 'employees' && (
        <EmployeeDetailDialog
          key={selectedRecord?.id ?? 'closed'}
          employeeId={selectedRecord?.id ?? null}
          onClose={() => setSelectedRecord(null)}
          canUpdate={runtime.permissions.includes('employees.update')}
          canReadAudit={runtime.permissions.includes('audit.read')}
          onEdit={(employee) => {
            setSaveError(undefined)
            setEmployeeBeingEdited(employee)
            setSelectedRecord(null)
            setEmployeeDialogOpen(true)
          }}
          onArchive={(employee) => {
            setEmployeeBeingArchived({ id: employee.id, name: employee.name })
            setSelectedRecord(null)
          }}
        />
      )}
      {isManagedModule(activeModule.id) && (
        <ManagedRecordDetailDialog
          moduleId={activeModule.id}
          moduleTitle={activeModule.title}
          recordId={selectedRecord?.id ?? null}
          canUpdate={runtime.permissions.includes(`${activeModule.id}.update`)}
          canReadAudit={runtime.permissions.includes('audit.read')}
          onClose={() => setSelectedRecord(null)}
          onEdit={(record) => {
            setSaveError(undefined)
            setManagedRecordBeingEdited(record)
            setSelectedRecord(null)
            setCreateDialogOpen(true)
          }}
          onArchive={(record) => {
            setManagedRecordBeingArchived({
              id: record.id,
              name: String(record.name ?? 'This record'),
              moduleId: activeModule.id as ManagedModuleId,
            })
            setSelectedRecord(null)
          }}
        />
      )}
      {activeModule.id === 'orders' && (
        <OrderDetailDialog
          orderId={selectedRecord?.id ?? null}
          canReadAudit={runtime.permissions.includes('audit.read')}
          permissions={runtime.permissions}
          onClose={() => setSelectedRecord(null)}
        />
      )}
      {activeModule.id === 'transfers' && (
        <TransferDetailDialog
          transferId={selectedRecord?.id ?? null}
          canReadAudit={runtime.permissions.includes('audit.read')}
          onClose={() => setSelectedRecord(null)}
        />
      )}
      {activeModule.id === 'deliveries' && (
        <DeliveryDetailDialog
          deliveryId={selectedRecord?.id ?? null}
          canUpdate={runtime.permissions.includes('deliveries.update')}
          canReadAudit={runtime.permissions.includes('audit.read')}
          onClose={() => setSelectedRecord(null)}
          onUpdateStatus={(delivery) => {
            setDeliveryBeingUpdated({ id: delivery.id, status: delivery.status })
            setSelectedRecord(null)
          }}
        />
      )}
      {activeModule.id !== 'employees' &&
        activeModule.id !== 'orders' &&
        activeModule.id !== 'transfers' &&
        activeModule.id !== 'deliveries' &&
        !isManagedModule(activeModule.id) && (
          <AppDialog
            open={Boolean(selectedRecord)}
            onOpenChange={(open) => !open && setSelectedRecord(null)}
            title={selectedRecord?.[activeModule.columns[0]] ?? 'Record details'}
            description={`Details from ${activeModule.title.toLowerCase()}`}
          >
            {selectedRecord && (
              <div className="detail-list">
                {activeModule.columns.map((column) => (
                  <div key={column}>
                    <span>{column}</span>
                    <strong>{selectedRecord[column] || '—'}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="dialog-actions">
              <button className="button button-outline" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>
          </AppDialog>
        )}
      {activeModule.id === 'deliveries' && deliveryBeingUpdated && (
        <UpdateDeliveryStatusDialog
          open={Boolean(deliveryBeingUpdated)}
          onOpenChange={(open) => !open && setDeliveryBeingUpdated(null)}
          deliveryId={deliveryBeingUpdated.id}
          currentStatus={deliveryBeingUpdated.status}
          onSave={handleDeliveryStatusSave}
        />
      )}
      <ArchiveRecordDialog
        key={employeeBeingArchived?.id ?? 'employee-archive-closed'}
        open={Boolean(employeeBeingArchived)}
        onClose={() => setEmployeeBeingArchived(null)}
        onConfirm={handleArchiveEmployee}
        actionLabel="Archive employee"
        title="Archive employee?"
        description={`${employeeBeingArchived?.name ?? 'This employee'} will be removed from active employee lists. Their record and audit history will be retained.`}
      />
      <ArchiveRecordDialog
        key={managedRecordBeingArchived?.id ?? 'master-archive-closed'}
        open={Boolean(managedRecordBeingArchived)}
        onClose={() => setManagedRecordBeingArchived(null)}
        onConfirm={handleArchiveManagedRecord}
        title={`Archive ${managedRecordBeingArchived ? singularModuleName(managedRecordBeingArchived.moduleId).toLowerCase() : 'record'}?`}
        description={`${managedRecordBeingArchived?.name ?? 'This record'} will be removed from active lists. Linked business records and audit history will be retained. Permanent deletion is unavailable to protect that history.`}
      />
    </>
  )
}

const managedModuleIds = ['branches', 'customers', 'suppliers', 'products'] as const

function isManagedModule(moduleId: string): moduleId is ManagedModuleId {
  return managedModuleIds.some((id) => id === moduleId)
}

function singularModuleName(moduleId: ManagedModuleId) {
  return {
    branches: 'Branch',
    customers: 'Customer',
    suppliers: 'Supplier',
    products: 'Product',
  }[moduleId]
}

function ModuleNotFound() {
  return (
    <div className="not-found">
      <div className="not-found-mark">404</div>
      <h1>Page not found</h1>
      <p>The page may have moved or no longer exists.</p>
      <Link className="button button-primary" to="/dashboard">
        Back to overview
      </Link>
    </div>
  )
}

function ModuleAccessDenied() {
  return (
    <div className="not-found" role="alert">
      <div className="not-found-mark">403</div>
      <h1>Access restricted</h1>
      <p>Your account does not have permission to view this section.</p>
      <Link className="button button-primary" to="/dashboard">
        Back to overview
      </Link>
    </div>
  )
}
