import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { AttachmentList } from '@/components/common/AttachmentList'
import { StatusBadge } from '@/components/common/DataTable'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatPeso } from '@/features/modules/order-decimals'
import { QueryState } from '@/components/common/QueryState'
import { formatFleetDate } from '@/features/fleet/fleet.utils'
import { FleetConfirmDialog } from '@/features/fleet/FleetConfirmDialog'
import { useFleetMutation } from '@/features/fleet/useFleetMutation'
import { AllowanceReceiptDialog } from './AllowanceReceiptDialog'
import { getAllowanceDetail, receiveAllowance, transitionAllowance } from './allowances.api'

export function DriverAllowanceDetailDialog({
  id,
  onClose,
  permissions,
}: {
  id: string
  onClose: () => void
  permissions: string[]
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const query = useQuery({
    queryKey: ['driver-allowance-detail', id, historyPage],
    queryFn: () => getAllowanceDetail(id, historyPage),
    placeholderData: (previous) => previous,
  })
  const mutation = useFleetMutation()
  const [action, setAction] = useState<'approve' | 'release' | 'cancel' | 'receive' | null>(null)
  const record = query.data?.allowance
  const allowed = (key: string) => permissions.includes(`driver-allowances.${key}`)
  const canUpload = Boolean(
    record &&
    !['Cancelled', 'Received'].includes(record.status) &&
    ['create', 'update', 'release', 'receive'].some(allowed),
  )
  const chooseAction = (next: 'approve' | 'release' | 'cancel' | 'receive') => {
    mutation.clearError()
    setAction(next)
  }
  return (
    <>
      <AppDialog
        open
        onOpenChange={(next) => !next && !mutation.busy && onClose()}
        title={record?.reference ?? 'Driver allowance details'}
        description="Payment authorization, release, receipt confirmation, and proof."
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
                  <strong>{record.workerName}</strong>
                  <small>{record.paymentType}</small>
                </div>
                <StatusBadge value={record.status} />
              </div>
              <dl className="fleet-summary">
                <div>
                  <dt>Allowance amount</dt>
                  <dd>{formatPeso(record.amount)}</dd>
                </div>
                <div>
                  <dt>Payment timing</dt>
                  <dd>{record.paymentTiming}</dd>
                </div>
              </dl>
              <dl className="fleet-detail-fields">
                <div>
                  <dt>Payment method</dt>
                  <dd>{record.method}</dd>
                </div>
                <div>
                  <dt>Reference number</dt>
                  <dd>{record.referenceNumber || '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatFleetDate(record.createdAt)}</dd>
                </div>
                <div>
                  <dt>Authorized</dt>
                  <dd>
                    {formatFleetDate(record.authorizedAt)}
                    {record.authorizedByName ? ` · ${record.authorizedByName}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Released</dt>
                  <dd>
                    {formatFleetDate(record.releasedAt)}
                    {record.releasedByName ? ` · ${record.releasedByName}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>
                    {formatFleetDate(record.receivedAt)}
                    {record.confirmedByName ? ` · ${record.confirmedByName}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Receipt acknowledgement</dt>
                  <dd>{record.acknowledgement || 'Awaiting confirmation'}</dd>
                </div>
                {record.assignmentId && (
                  <div>
                    <dt>Related assignment</dt>
                    <dd>Linked to a vehicle assignment</dd>
                  </div>
                )}
                {record.deliveryId && (
                  <div>
                    <dt>Related delivery</dt>
                    <dd>Linked to a delivery</dd>
                  </div>
                )}
              </dl>
              {record.notes && <p className="form-helper">{record.notes}</p>}
              <section className="fleet-section">
                <div className="fleet-section-heading">
                  <h3>Payment / receipt proof</h3>
                </div>
                <AttachmentList
                  entityType="driver-allowance"
                  entityId={id}
                  canUpload={canUpload}
                  onUploaded={() => void query.refetch()}
                />
              </section>
              {record.status === 'Released' && (
                <p className="form-helper">
                  This payment has been released. Receipt confirmation is still pending.
                </p>
              )}
              {permissions.includes('audit.read') && query.data && (
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
                {['Pending', 'Approved'].includes(record.status) && allowed('cancel') && (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => chooseAction('cancel')}
                  >
                    Cancel allowance
                  </button>
                )}
                {record.status === 'Pending' && allowed('approve') && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => chooseAction('approve')}
                  >
                    Approve allowance
                  </button>
                )}
                {record.status === 'Approved' && allowed('release') && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => chooseAction('release')}
                  >
                    Release payment
                  </button>
                )}
                {record.status === 'Released' && allowed('receive') && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => chooseAction('receive')}
                  >
                    Confirm receipt
                  </button>
                )}
              </div>
            </>
          )}
        </QueryState>
      </AppDialog>
      {record && action && action !== 'receive' && (
        <FleetConfirmDialog
          title={
            action === 'release'
              ? `Release ${formatPeso(record.amount)} allowance to ${record.workerName}?`
              : action === 'approve'
                ? 'Approve this driver allowance?'
                : 'Cancel this driver allowance?'
          }
          description={
            action === 'release'
              ? 'Confirm the payment has actually been released. The release is recorded as a business expense and still needs worker receipt confirmation.'
              : `${record.workerName} · ${record.paymentType} · ${formatPeso(record.amount)}`
          }
          busy={mutation.busy}
          error={mutation.error}
          danger={action === 'cancel'}
          onCancel={() => setAction(null)}
          onConfirm={() =>
            void mutation
              .run(() => transitionAllowance(id, action), 'Driver allowance updated.')
              .then((saved) => saved && setAction(null))
          }
        />
      )}
      {record && action === 'receive' && (
        <AllowanceReceiptDialog
          record={record}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setAction(null)}
          onReceive={(values) =>
            mutation.run(() => receiveAllowance(id, values), 'Worker receipt confirmed.')
          }
        />
      )}
    </>
  )
}
