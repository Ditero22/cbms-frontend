import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { AttachmentList } from '@/components/common/AttachmentList'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatQuantity } from './order-decimals'
import { getDeliveryDetail } from './modules.api'
import type { DeliveryDetailResponse } from './types'

type DeliveryDetailDialogProps = {
  deliveryId: string | null
  canUpdate: boolean
  canReadAudit: boolean
  onClose: () => void
  onUpdateStatus: (delivery: Pick<DeliveryDetailResponse, 'id' | 'status'>) => void
}

export function DeliveryDetailDialog({
  deliveryId,
  canUpdate,
  canReadAudit,
  onClose,
  onUpdateStatus,
}: DeliveryDetailDialogProps) {
  const [historyPage, setHistoryPage] = useState(1)
  const detail = useQuery({
    queryKey: ['delivery-detail', deliveryId, historyPage],
    queryFn: () => getDeliveryDetail(deliveryId!, historyPage),
    enabled: Boolean(deliveryId),
  })
  const delivery = detail.data
  const statusCanAdvance = delivery
    ? ['Preparing', 'Scheduled', 'In Transit'].includes(delivery.status) &&
      !['Cancelled', 'Completed'].includes(delivery.orderStatus) &&
      delivery.allocationStatus === 'Verified'
    : false

  return (
    <AppDialog
      open={Boolean(deliveryId)}
      onOpenChange={(open) => !open && onClose()}
      title={delivery?.reference ?? 'Delivery details'}
      description="Order fulfillment, assigned resources, and recorded activity"
      size="lg"
    >
      {detail.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading delivery details…
        </div>
      ) : detail.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this delivery.</strong>
          <span>{detail.error.message}</span>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void detail.refetch()}
          >
            Try again
          </button>
        </div>
      ) : delivery ? (
        <>
          <div className="employee-detail-overview">
            <div>
              <span className="employee-detail-eyebrow">Delivery</span>
              <strong>{delivery.orderNumber}</strong>
              <span>
                {delivery.customerName} · {delivery.branchName}
              </span>
            </div>
            <StatusBadge value={delivery.status} />
          </div>

          <div className="order-detail-related-grid">
            <DetailSection title="Order and destination">
              <dl className="managed-record-fields">
                <Field label="Order status" value={delivery.orderStatus} />
                <Field label="Destination" value={delivery.destination} />
                <Field label="Scheduled" value={formatDateTime(delivery.scheduledAt)} />
                <Field label="Created" value={formatDateTime(delivery.createdAt)} />
              </dl>
            </DetailSection>

            <DetailSection title="Assigned resources">
              <dl className="managed-record-fields">
                <Field label="Driver" value={delivery.driverName} />
                <Field label="Vehicle" value={delivery.vehicleName} />
                <Field label="Plate number" value={delivery.plateNumber} />
                <Field label="Trip reference" value={delivery.assignmentReference} />
                <Field label="Trip status" value={delivery.assignmentStatus} />
                <Field label="Start odometer" value={formatOdometer(delivery.startOdometer)} />
                <Field label="End odometer" value={formatOdometer(delivery.endOdometer)} />
                <Field label="Activity notes" value={delivery.activityNotes} />
              </dl>
            </DetailSection>
          </div>

          <DetailSection title="Delivery items">
            {delivery.items.length ? (
              <ul className="order-detail-list">
                {delivery.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>
                        {item.sku} · {item.unit}
                      </span>
                      {item.inferredQuantity !== null && (
                        <span>Quantity recorded from legacy delivery data</span>
                      )}
                    </div>
                    <div>
                      <strong>
                        {formatQuantity(item.quantity)} {item.unit}
                      </strong>
                      <span>of {formatQuantity(item.orderedQuantity)} ordered</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="employee-history-empty">
                No item lines are recorded for this delivery.
              </p>
            )}
          </DetailSection>

          <DetailSection title="Allocation record">
            <dl className="managed-record-fields">
              <Field label="Origin" value={delivery.allocationOrigin} />
              <Field label="Verification status" value={delivery.allocationStatus} />
              <Field label="Verified by" value={delivery.allocationVerifiedByName} />
              <Field label="Verified at" value={formatDateTime(delivery.allocationVerifiedAt)} />
            </dl>
            {canUpdate && delivery.allocationStatus === 'Unverified' && (
              <p className="field-error" role="status">
                Status changes are paused until the historical delivery quantities are verified.
              </p>
            )}
            {canUpdate && ['Cancelled', 'Completed'].includes(delivery.orderStatus) && (
              <p className="form-helper" role="status">
                This order is closed, so the delivery can no longer change status.
              </p>
            )}
          </DetailSection>

          <p className="form-helper">Delivery proof is optional for this release.</p>
          <AttachmentList entityType="delivery" entityId={delivery.id} canUpload={canUpdate} />

          {canReadAudit && (
            <RecordHistoryPanel
              entries={delivery.history}
              page={delivery.historyPage}
              pageSize={delivery.historyPageSize}
              total={delivery.historyTotal}
              onPageChange={setHistoryPage}
              busy={detail.isFetching}
            />
          )}

          <div className="order-detail-metadata">
            Last updated {formatDateTime(delivery.updatedAt)}
          </div>
          {canUpdate && statusCanAdvance && (
            <div className="dialog-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => onUpdateStatus({ id: delivery.id, status: delivery.status })}
              >
                Update status
              </button>
            </div>
          )}
        </>
      ) : null}
    </AppDialog>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="order-detail-section">
      <div className="employee-detail-section-heading">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatOdometer(value: string | null) {
  return value === null ? null : `${formatQuantity(value)} km`
}
