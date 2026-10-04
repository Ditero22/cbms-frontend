import { AttachmentList } from '@/components/common/AttachmentList'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ExpenseSource } from './types'

export function ExpenseSourcePanel({ source }: { source: ExpenseSource }) {
  const isMaintenance = source.entityType === 'vehicle-maintenance'
  return (
    <section className="expense-source" aria-label="Expense source">
      <div className="expense-section-heading">
        <h3>Expense source</h3>
        <StatusBadge value={source.status} />
      </div>
      <strong>
        {isMaintenance ? 'Vehicle maintenance' : 'Driver allowance'} · {source.reference}
      </strong>
      <dl className="expense-details">
        {isMaintenance ? (
          <>
            {source.vehicleName && (
              <div>
                <dt>Vehicle</dt>
                <dd>{source.vehicleName}</dd>
              </div>
            )}
            {source.plateNumber && (
              <div>
                <dt>Plate number</dt>
                <dd>{source.plateNumber}</dd>
              </div>
            )}
          </>
        ) : (
          <>
            {source.workerName && (
              <div>
                <dt>Worker</dt>
                <dd>{source.workerName}</dd>
              </div>
            )}
            {source.paymentType && (
              <div>
                <dt>Payment type</dt>
                <dd>{source.paymentType}</dd>
              </div>
            )}
            {source.method && (
              <div>
                <dt>Payment method</dt>
                <dd>{source.method}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      <p className="form-helper">
        {isMaintenance
          ? 'This expense was created when maintenance was completed.'
          : 'This expense was created when the allowance payment was released.'}{' '}
        Proof remains attached to that source record.
      </p>
      <AttachmentList entityType={source.entityType} entityId={source.id} canUpload={false} />
    </section>
  )
}
