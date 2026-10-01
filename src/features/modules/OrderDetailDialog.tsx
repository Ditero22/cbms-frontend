import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/DataTable'
import { formatPaymentDate } from '@/features/customer-payments/customer-payments.utils'
import { getOrderDetail } from './modules.api'
import { OrderWorkflowActions } from './OrderWorkflowActions'
import { LegacyDeliveryReconciliationPanel } from './LegacyDeliveryReconciliationPanel'
import {
  formatPeso,
  formatQuantity as formatExactQuantity,
  fromMinorUnits,
  toMinorUnits,
} from './order-decimals'

type OrderDetailDialogProps = {
  orderId: string | null
  canReadAudit: boolean
  permissions: string[]
  onClose: () => void
}

export function OrderDetailDialog({
  orderId,
  canReadAudit,
  permissions,
  onClose,
}: OrderDetailDialogProps) {
  const orderQuery = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => getOrderDetail(orderId!),
    enabled: Boolean(orderId),
  })
  const order = orderQuery.data
  const paymentsRecorded = fromMinorUnits(
    order?.payments
      .filter((payment) => payment.status === 'Paid')
      .reduce((sum, payment) => sum + toMinorUnits(payment.amount, 2), 0n) ?? 0n,
    2,
  )
  const refundsProcessed = fromMinorUnits(
    order?.refunds
      .filter((refund) => refund.status === 'Processed')
      .reduce((sum, refund) => sum + toMinorUnits(refund.amount, 2), 0n) ?? 0n,
    2,
  )

  return (
    <AppDialog
      open={Boolean(orderId)}
      onOpenChange={(open) => !open && onClose()}
      title={order?.orderNumber ?? 'Order details'}
      description={
        order ? `${order.customerName} · ${order.branchName}` : 'Order and related activity'
      }
      size="wide"
    >
      {orderQuery.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading order details…
        </div>
      ) : orderQuery.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this order.</strong>
          <span>{orderQuery.error.message}</span>
          <button className="button button-outline" onClick={() => void orderQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : order ? (
        <>
          <div className="order-detail-summary">
            <div className="order-detail-status">
              <span>Status</span>
              <StatusBadge value={order.status} />
            </div>
            <MoneySummary label="Payable total" value={order.payableAmount} />
            <MoneySummary label="Payments recorded" value={paymentsRecorded} />
            <MoneySummary label="Refunds processed" value={refundsProcessed} />
            <MoneySummary label="Net paid" value={order.paidAmount} />
            <MoneySummary label="Balance" value={order.balance} />
          </div>

          {order.lifecycle.requiresLegacyDeliveryReconciliation && (
            <LegacyDeliveryReconciliationPanel
              orderId={order.id}
              canReconcile={permissions.includes('deliveries.update')}
            />
          )}
          <OrderWorkflowActions order={order} permissions={permissions} />

          <DetailSection title="Order items">
            {order.items.length ? (
              <div className="order-detail-items">
                <div className="order-detail-item-heading" aria-hidden="true">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Unit price</span>
                  <span>Line total</span>
                </div>
                {order.items.map((item) => (
                  <div className="order-detail-item" key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>{item.sku}</span>
                      {(Number(item.deliveredQuantity) > 0 ||
                        Number(item.cancelledQuantity) > 0) && (
                        <small className="order-detail-item-progress">
                          {formatQuantity(item.deliveredQuantity)} delivered
                          {Number(item.cancelledQuantity) > 0 &&
                            ` · ${formatQuantity(item.cancelledQuantity)} cancelled`}
                          {Number(item.returnedQuantity) > 0 &&
                            ` · ${formatQuantity(item.returnedQuantity)} returned`}
                        </small>
                      )}
                    </div>
                    <span>
                      {formatQuantity(item.quantity)} {item.unit}
                    </span>
                    <span>{formatCurrency(item.unitPrice)}</span>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="employee-history-empty">No order items are available.</p>
            )}
          </DetailSection>

          <div className="order-detail-related-grid">
            <DetailSection title="Payments">
              {order.payments.length ? (
                <ul className="order-detail-list">
                  {order.payments.map((payment) => (
                    <li key={payment.id}>
                      <div>
                        <strong>{payment.reference}</strong>
                        <span>
                          {payment.method} · {payment.recordedByName}
                        </span>
                        {payment.externalReference && (
                          <span>Reference: {payment.externalReference}</span>
                        )}
                        {payment.notes && <span>{payment.notes}</span>}
                      </div>
                      <div>
                        <strong>{formatCurrency(payment.amount)}</strong>
                        <span>{formatPaymentDate(payment.paymentDate)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="employee-history-empty">No payments recorded.</p>
              )}
            </DetailSection>

            <DetailSection title="Deliveries">
              {order.deliveries.length ? (
                <ul className="order-detail-list">
                  {order.deliveries.map((delivery) => (
                    <li key={delivery.id}>
                      <div>
                        <strong>{delivery.reference}</strong>
                        <span>{delivery.destination}</span>
                      </div>
                      <div>
                        <StatusBadge value={delivery.status} />
                        <span>{delivery.driverName || 'No driver assigned'}</span>
                        {delivery.vehicleName && (
                          <span>
                            {delivery.vehicleName}
                            {delivery.plateNumber ? ` · ${delivery.plateNumber}` : ''}
                          </span>
                        )}
                        {delivery.items.length > 0 && (
                          <span>
                            {delivery.items
                              .map(
                                (item) => `${item.productName} × ${formatQuantity(item.quantity)}`,
                              )
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="employee-history-empty">No delivery is scheduled.</p>
              )}
            </DetailSection>
          </div>

          <DetailSection title="Stock movements">
            {order.stockMovements.length ? (
              <ul className="order-detail-list">
                {order.stockMovements.map((movement) => (
                  <li key={movement.id}>
                    <div>
                      <strong>
                        {movement.productName} · {movement.sku}
                      </strong>
                      <span>
                        {movement.transactionType} · {movement.note}
                      </span>
                    </div>
                    <div>
                      <strong>{formatQuantity(movement.quantityDelta)}</strong>
                      <span>
                        {movement.performedByName} · {formatDateTime(movement.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="employee-history-empty">
                No stock movements are recorded for this order.
              </p>
            )}
          </DetailSection>

          {canReadAudit && (
            <DetailSection title="Audit history">
              {order.history.length ? (
                <ol className="employee-history-list">
                  {order.history.map((entry) => (
                    <li key={entry.id}>
                      <div className="employee-history-marker" aria-hidden="true" />
                      <div>
                        <strong>{sentenceCase(entry.action)}</strong>
                        <span>
                          {entry.actorName || 'System'} · {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="employee-history-empty">No audit history is available.</p>
              )}
            </DetailSection>
          )}

          <div className="order-detail-metadata">
            Created by {order.createdByName} · {formatDateTime(order.createdAt)}
            {order.cancelledAt && <> · Cancelled {formatDateTime(order.cancelledAt)}</>}
            {order.cancellationReason && <> · Reason: {order.cancellationReason}</>}
            {order.completedAt && <> · Completed {formatDateTime(order.completedAt)}</>}
          </div>
          <div className="dialog-actions">
            <button className="button button-outline" onClick={onClose}>
              Close
            </button>
          </div>
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

function MoneySummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="order-detail-money">
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  )
}

function formatCurrency(amount: string | number) {
  return formatPeso(String(amount))
}

function formatQuantity(quantity: string | number) {
  return formatExactQuantity(String(quantity))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
