import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { AttachmentList } from '@/components/common/AttachmentList'
import { StatusBadge } from '@/components/common/DataTable'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatPeso } from '@/features/modules/order-decimals'
import { QueryState } from '@/components/common/QueryState'
import { formatFleetDate } from './fleet.utils'
import { FleetConfirmDialog } from './FleetConfirmDialog'
import { getMaintenanceDetail, transitionMaintenance } from './fleet.api'
import { useFleetMutation } from './useFleetMutation'
import type { MaintenanceRecord } from './types'

export function MaintenanceDetailDialog({
  id,
  onClose,
  onEdit,
  canManage,
  canReadAudit,
}: {
  id: string
  onClose: () => void
  onEdit: (record: MaintenanceRecord) => void
  canManage: boolean
  canReadAudit: boolean
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const query = useQuery({
    queryKey: ['maintenance-detail', id, historyPage],
    queryFn: () => getMaintenanceDetail(id, historyPage),
    placeholderData: (previous) => previous,
  })
  const mutation = useFleetMutation()
  const [action, setAction] = useState<'start' | 'complete' | 'cancel' | null>(null)
  const record = query.data?.maintenance
  const canEdit = record && !['Completed', 'Cancelled'].includes(record.status)
  return (
    <>
      <AppDialog
        open
        onOpenChange={(next) => !next && !mutation.busy && onClose()}
        title={record?.reference ?? 'Maintenance details'}
        description="Repair information, itemized expenses, and receipts."
        size="wide"
      >
        <QueryState
          className="fleet-state"
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
        >
          {record && (
            <>
              <div className="fleet-overview">
                <div>
                  <strong>{record.maintenanceType}</strong>
                  <small>{record.description}</small>
                </div>
                <StatusBadge value={record.status} />
              </div>
              <dl className="fleet-detail-fields">
                <div>
                  <dt>Problem reported</dt>
                  <dd>{record.problemReported || '—'}</dd>
                </div>
                <div>
                  <dt>Service provider</dt>
                  <dd>{record.serviceProvider || '—'}</dd>
                </div>
                <div>
                  <dt>Contact person</dt>
                  <dd>{record.contactPerson || '—'}</dd>
                </div>
                <div>
                  <dt>Start date</dt>
                  <dd>{formatFleetDate(record.startedOn)}</dd>
                </div>
                <div>
                  <dt>Completed date</dt>
                  <dd>{formatFleetDate(record.completedOn)}</dd>
                </div>
                <div>
                  <dt>Receipt reference</dt>
                  <dd>{record.receiptReference || '—'}</dd>
                </div>
                <div>
                  <dt>Labor</dt>
                  <dd>{formatPeso(record.laborCost)}</dd>
                </div>
                <div>
                  <dt>Parts</dt>
                  <dd>{formatPeso(record.partsCost)}</dd>
                </div>
                <div>
                  <dt>Other expenses</dt>
                  <dd>{formatPeso(record.otherCost)}</dd>
                </div>
                <div>
                  <dt>Total repair cost</dt>
                  <dd>{formatPeso(record.totalCost)}</dd>
                </div>
              </dl>
              {record.notes && <p className="form-helper">{record.notes}</p>}
              <section className="fleet-section">
                <div className="fleet-section-heading">
                  <h3>Receipts and proof</h3>
                </div>
                <AttachmentList
                  entityType="vehicle-maintenance"
                  entityId={id}
                  canUpload={canManage && Boolean(canEdit)}
                  onUploaded={() => void query.refetch()}
                />
              </section>
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
                {canManage && canEdit && (
                  <>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => onEdit(record)}
                    >
                      Edit maintenance
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => {
                        mutation.clearError()
                        setAction('cancel')
                      }}
                    >
                      Cancel maintenance
                    </button>
                    {record.status === 'Scheduled' ? (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => {
                          mutation.clearError()
                          setAction('start')
                        }}
                      >
                        Start maintenance
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => {
                          mutation.clearError()
                          setAction('complete')
                        }}
                      >
                        Complete maintenance
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </QueryState>
      </AppDialog>
      {action && record && (
        <FleetConfirmDialog
          title={
            action === 'start'
              ? 'Start maintenance?'
              : action === 'complete'
                ? 'Complete this maintenance record?'
                : 'Cancel this maintenance record?'
          }
          description={
            action === 'complete'
              ? `Record ${formatPeso(record.totalCost)} in Maintenance & Repair Expenses and finish this service.`
              : action === 'start'
                ? 'This vehicle will be unavailable for new active assignments.'
                : 'The cancelled record and its audit history will be retained.'
          }
          busy={mutation.busy}
          error={mutation.error}
          danger={action === 'cancel'}
          onCancel={() => setAction(null)}
          onConfirm={() =>
            void mutation
              .run(() => transitionMaintenance(id, action), 'Maintenance updated.')
              .then((saved) => saved && setAction(null))
          }
        />
      )}
    </>
  )
}
