import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppDialog } from '@/components/common/AppDialog'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { StatusBadge } from '@/components/common/DataTable'
import { QueryState } from '@/components/common/QueryState'
import { formatFleetDate } from './fleet.utils'
import { FleetConfirmDialog } from './FleetConfirmDialog'
import { getAssignmentDetail, transitionAssignment } from './fleet.api'
import { useFleetMutation } from './useFleetMutation'

export function AssignmentDetailDialog({
  id,
  onClose,
  canManage,
  canReadAudit,
}: {
  id: string
  onClose: () => void
  canManage: boolean
  canReadAudit: boolean
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const query = useQuery({
    queryKey: ['assignment-detail', id, historyPage],
    queryFn: () => getAssignmentDetail(id, historyPage),
    placeholderData: (previous) => previous,
  })
  const mutation = useFleetMutation()
  const [action, setAction] = useState<'start' | 'complete' | 'cancel' | null>(null)
  const [endOdometer, setEndOdometer] = useState('')
  const record = query.data?.assignment
  return (
    <>
      <AppDialog
        open
        onOpenChange={(next) => !next && !mutation.busy && onClose()}
        title={record?.reference ?? 'Assignment details'}
        description="Driver, vehicle, and trip activity."
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
                  <strong>{record.driverName}</strong>
                  <small>
                    {record.vehicleName} · {record.plateNumber}
                  </small>
                </div>
                <StatusBadge value={record.status} />
              </div>
              <dl className="fleet-detail-fields">
                <div>
                  <dt>Destination</dt>
                  <dd>{record.destination}</dd>
                </div>
                <div>
                  <dt>Purpose</dt>
                  <dd>{record.purpose}</dd>
                </div>
                <div>
                  <dt>Scheduled start</dt>
                  <dd>{formatFleetDate(record.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatFleetDate(record.startedAt)}</dd>
                </div>
                <div>
                  <dt>Ended</dt>
                  <dd>{formatFleetDate(record.endedAt)}</dd>
                </div>
                <div>
                  <dt>Starting odometer</dt>
                  <dd>{record.startOdometer ? `${record.startOdometer} km` : '—'}</dd>
                </div>
                <div>
                  <dt>Ending odometer</dt>
                  <dd>{record.endOdometer ? `${record.endOdometer} km` : '—'}</dd>
                </div>
              </dl>
              {record.notes && <p className="form-helper">{record.notes}</p>}
              {record.deliveryId && (
                <p className="form-helper">
                  This assignment follows its delivery status.{' '}
                  <Link to="/deliveries" onClick={onClose}>
                    Open deliveries
                  </Link>
                </p>
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
                <button type="button" className="button button-outline" onClick={onClose}>
                  Close
                </button>
                {canManage &&
                  !record.deliveryId &&
                  ['Scheduled', 'Active'].includes(record.status) && (
                    <>
                      <button
                        className="button button-danger"
                        type="button"
                        onClick={() => {
                          mutation.clearError()
                          setAction('cancel')
                        }}
                      >
                        Cancel assignment
                      </button>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => {
                          mutation.clearError()
                          setEndOdometer('')
                          setAction(record.status === 'Scheduled' ? 'start' : 'complete')
                        }}
                      >
                        {record.status === 'Scheduled' ? 'Start assignment' : 'Complete assignment'}
                      </button>
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
              ? 'Start this assignment?'
              : action === 'complete'
                ? 'Complete this assignment?'
                : 'Cancel this assignment?'
          }
          description={
            action === 'start'
              ? `${record.driverName} will start using ${record.vehicleName}.`
              : `Finish this work for ${record.driverName} and release its reserved resources when eligible.`
          }
          busy={mutation.busy}
          error={mutation.error}
          danger={action === 'cancel'}
          onCancel={() => setAction(null)}
          onConfirm={() =>
            void mutation
              .run(
                () => transitionAssignment(id, action, { endOdometer: endOdometer || null }),
                'Assignment updated.',
              )
              .then((saved) => saved && setAction(null))
          }
        >
          {action === 'complete' && (
            <label className="field-label">
              Ending odometer (km)
              <input
                className="form-input"
                type="number"
                min={record.startOdometer ?? '0'}
                step="0.001"
                value={endOdometer}
                onChange={(event) => setEndOdometer(event.target.value)}
                disabled={mutation.busy}
              />
            </label>
          )}
        </FleetConfirmDialog>
      )}
    </>
  )
}
