import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/DataTable'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { RecordPagination } from '@/components/common/RecordPagination'
import { formatPeso, formatQuantity } from '@/features/modules/order-decimals'
import { QueryState } from '@/components/common/QueryState'
import { formatFleetDate } from './fleet.utils'
import { getVehicleDetail } from './fleet.api'
import type { VehicleRecord } from './types'

export function VehicleDetailDialog({
  id,
  open,
  onClose,
  onEdit,
  onStatus,
  onArchive,
  onMaintenance,
  onViewMaintenance,
  onAssign,
  onViewAssignment,
  permissions,
}: {
  id: string
  open: boolean
  onClose: () => void
  onEdit: (record: VehicleRecord) => void
  onStatus: (
    record: VehicleRecord,
    status: 'Available' | 'Under Maintenance' | 'Unavailable',
  ) => void
  onArchive: (record: VehicleRecord) => void
  onMaintenance: () => void
  onViewMaintenance: (id: string) => void
  onAssign: () => void
  onViewAssignment: (id: string) => void
  permissions: string[]
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const [maintenancePage, setMaintenancePage] = useState(1)
  const [assignmentPage, setAssignmentPage] = useState(1)
  const query = useQuery({
    queryKey: ['vehicle-detail', id, historyPage, maintenancePage, assignmentPage],
    queryFn: () => getVehicleDetail(id, historyPage, maintenancePage, assignmentPage),
    placeholderData: (previous) => previous,
  })
  const vehicle = query.data?.vehicle
  const maintenance = query.data?.currentMaintenance
  const canUpdate = permissions.includes('vehicles.update')
  const canReadMaintenance =
    permissions.includes('expenses.read') && permissions.includes('vehicles.maintenance')
  const canAssign = permissions.includes('vehicles.assign')
  const canReadAudit = permissions.includes('audit.read')
  const specifications: [string, string | null | undefined][] = vehicle
    ? [
        ['Vehicle type', vehicle.vehicleType],
        ['Brand / model', [vehicle.brand, vehicle.model].filter(Boolean).join(' ')],
        ['Year', vehicle.year?.toString()],
        ['Color', vehicle.color],
        ['Fuel type', vehicle.fuelType],
        ['Odometer', vehicle.odometer ? `${vehicle.odometer} km` : null],
        [
          'Capacity',
          vehicle.capacityValue
            ? `${formatQuantity(vehicle.capacityValue)} ${vehicle.capacityUnit ?? ''}`
            : null,
        ],
        ['Default driver', vehicle.defaultDriverName],
        ['Registration expiration', formatFleetDate(vehicle.registrationExpiresOn)],
        ['Next service', formatFleetDate(vehicle.nextServiceAt)],
        ['Insurance provider', vehicle.insuranceProvider],
        ['Insurance reference', vehicle.insuranceReference],
        ['Insurance expiration', formatFleetDate(vehicle.insuranceExpiresOn)],
      ]
    : []
  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={vehicle?.name ?? 'Vehicle details'}
      description={
        vehicle?.plateNumber ? `Plate ${vehicle.plateNumber}` : 'Fleet specifications and activity'
      }
      size="wide"
    >
      <QueryState
        className="fleet-state"
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {vehicle && (
          <>
            <div className="fleet-overview">
              <div>
                <strong>{vehicle.vehicleType}</strong>
                <small>Updated {formatFleetDate(vehicle.updatedAt)}</small>
              </div>
              <StatusBadge value={vehicle.status} />
            </div>
            {canReadMaintenance && maintenance && (
              <section className="fleet-current">
                <div className="fleet-section-heading">
                  <h3>Current maintenance</h3>
                  <StatusBadge value={maintenance.status} />
                </div>
                <p>{maintenance.problemReported || maintenance.description}</p>
                <dl className="fleet-summary">
                  <div>
                    <dt>Started</dt>
                    <dd>{formatFleetDate(maintenance.startedOn)}</dd>
                  </div>
                  <div>
                    <dt>Recorded repair expense</dt>
                    <dd>{formatPeso(maintenance.totalCost)}</dd>
                  </div>
                  <div>
                    <dt>Service provider</dt>
                    <dd>{maintenance.serviceProvider || '—'}</dd>
                  </div>
                  <div>
                    <dt>Latest update</dt>
                    <dd>{formatFleetDate(maintenance.updatedAt)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onViewMaintenance(maintenance.id)}
                >
                  Open maintenance record
                </button>
              </section>
            )}
            <dl className="fleet-detail-fields">
              {specifications.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {vehicle.notes && <p className="form-helper">{vehicle.notes}</p>}
            {canAssign && (
              <section className="fleet-section">
                <div className="fleet-section-heading">
                  <h3>Vehicle assignments</h3>
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={vehicle.status !== 'Available'}
                    onClick={onAssign}
                  >
                    New assignment
                  </button>
                </div>
                <div className="fleet-record-list">
                  {query.data?.assignments.length ? (
                    query.data.assignments.map((assignment) => (
                      <button
                        type="button"
                        className="fleet-record"
                        key={assignment.id}
                        onClick={() => onViewAssignment(assignment.id)}
                      >
                        <div>
                          <strong>
                            {assignment.reference} · {assignment.driverName}
                          </strong>
                          <span>{assignment.destination}</span>
                          <small>
                            {formatFleetDate(assignment.scheduledAt || assignment.createdAt)}
                          </small>
                        </div>
                        <StatusBadge value={assignment.status} />
                      </button>
                    ))
                  ) : (
                    <p className="form-helper">No assignments recorded yet.</p>
                  )}
                </div>
                {query.data && (
                  <RecordPagination
                    label="Vehicle assignment pages"
                    page={query.data.assignmentPage}
                    pageSize={query.data.activityPageSize}
                    total={query.data.assignmentTotal}
                    busy={query.isFetching}
                    onPageChange={setAssignmentPage}
                  />
                )}
              </section>
            )}
            {canReadMaintenance && (
              <section className="fleet-section">
                <div className="fleet-section-heading">
                  <h3>Maintenance & Repair Expenses</h3>
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={onMaintenance}
                  >
                    Schedule maintenance
                  </button>
                </div>
                <div className="fleet-form-total">
                  <span>Total completed maintenance expenses</span>
                  <strong>{formatPeso(query.data?.totalMaintenanceCost ?? '0.00')}</strong>
                </div>
                <div className="fleet-record-list">
                  {query.data?.maintenance.length ? (
                    query.data.maintenance.map((record) => (
                      <button
                        type="button"
                        className="fleet-record"
                        key={record.id}
                        onClick={() => onViewMaintenance(record.id)}
                      >
                        <div>
                          <strong>{record.maintenanceType}</strong>
                          <span>{record.problemReported || record.description}</span>
                          <small>{formatFleetDate(record.startedOn || record.createdAt)}</small>
                        </div>
                        <div className="fleet-record-end">
                          <strong>{formatPeso(record.totalCost)}</strong>
                          <StatusBadge value={record.status} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="form-helper">No maintenance records yet.</p>
                  )}
                </div>
                {query.data && (
                  <RecordPagination
                    label="Maintenance record pages"
                    page={query.data.maintenancePage}
                    pageSize={query.data.activityPageSize}
                    total={query.data.maintenanceTotal}
                    busy={query.isFetching}
                    onPageChange={setMaintenancePage}
                  />
                )}
              </section>
            )}
            {canReadAudit && query.data && (
              <RecordHistoryPanel
                entries={query.data.history}
                page={query.data.historyPage}
                pageSize={query.data.historyPageSize}
                total={query.data.historyTotal}
                onPageChange={setHistoryPage}
                busy={query.isFetching}
              />
            )}
            <div className="dialog-actions">
              <button className="button button-outline" type="button" onClick={onClose}>
                Close
              </button>
              {canUpdate && (
                <>
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => onArchive(vehicle)}
                  >
                    Archive vehicle
                  </button>
                  {vehicle.status === 'Available' && (
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => onStatus(vehicle, 'Under Maintenance')}
                    >
                      Under Maintenance
                    </button>
                  )}
                  {vehicle.status === 'Available' && (
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => onStatus(vehicle, 'Unavailable')}
                    >
                      Place on hold
                    </button>
                  )}
                  {['Unavailable', 'Under Maintenance'].includes(vehicle.status) && (
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => onStatus(vehicle, 'Available')}
                    >
                      Mark Available
                    </button>
                  )}
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => onEdit(vehicle)}
                  >
                    Edit vehicle
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </QueryState>
    </AppDialog>
  )
}
