import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatPeso } from '@/features/modules/order-decimals'
import { getCustomerPaymentDetail } from './customer-payments.api'
import { PaymentReceiptCard } from './PaymentReceiptCard'
import { formatPaymentDate } from './customer-payments.utils'
import type { CustomerPaymentDetail } from './types'
import './customer-payments.css'

type Props = {
  orderId: string | null
  canReadAudit: boolean
  canCreate: boolean
  canOpenRefundWorkflow: boolean
  onClose: () => void
  onRecord: (order: CustomerPaymentDetail) => void
  onReviewRefunds: (orderId: string) => void
}

export function CustomerPaymentDetailDialog({
  orderId,
  canReadAudit,
  canCreate,
  canOpenRefundWorkflow,
  onClose,
  onRecord,
  onReviewRefunds,
}: Props) {
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['customer-payment-detail', orderId],
    queryFn: () => getCustomerPaymentDetail(orderId!),
    enabled: Boolean(orderId),
  })
  const order = detail.data
  return (
    <AppDialog
      open={Boolean(orderId)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={order ? `${order.orderNumber} payments` : 'Customer payment details'}
      description={
        order
          ? `${order.customerName} · ${order.branchName}`
          : 'Balances and immutable payment receipts'
      }
      size="lg"
    >
      {detail.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading payment details…
        </div>
      ) : detail.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this transaction.</strong>
          <span>{detail.error.message}</span>
          <button className="button button-outline" onClick={() => void detail.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        order && (
          <>
            <div className="customer-payment-heading">
              <StatusBadge value={order.paymentStatus} />
              <span>Order: {order.orderStatus}</span>
              {canOpenRefundWorkflow && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onReviewRefunds(order.id)}
                >
                  Review refunds and order activity
                </button>
              )}
            </div>
            <div className="customer-payment-summary">
              <Money label="Payable total" value={order.payableAmount} />
              <Money label="Amount paid (net)" value={order.netPaidAmount} />
              <Money label="Remaining balance" value={order.balance} />
              <div>
                <span>Last payment</span>
                <strong>{formatPaymentDate(order.lastPaymentDate)}</strong>
              </div>
            </div>
            {order.originalTotal !== order.payableAmount && (
              <p className="form-helper">
                Original order total: {formatPeso(order.originalTotal)}. Cancelled quantities reduce
                the payable total.
              </p>
            )}
            {order.refundedAmount !== '0.00' && (
              <p className="form-helper">
                Receipts recorded: {formatPeso(order.paymentsAmount)} · Processed refunds:{' '}
                {formatPeso(order.refundedAmount)}. Amount paid is net of processed refunds.
              </p>
            )}
            {order.pendingRefundAmount !== '0.00' && (
              <p className="form-helper">
                Pending refunds: {formatPeso(order.pendingRefundAmount)}. Another payment can be
                recorded after the refund is resolved.
              </p>
            )}
            {order.paymentStatus === 'Overpaid' && (
              <p className="field-error" role="alert">
                This historical transaction has a credit balance. Review and refund the excess
                through the existing order refund workflow.
              </p>
            )}
            <section className="customer-payment-section">
              <h3>Payment history</h3>
              {order.payments.length ? (
                <div className="customer-payment-receipts">
                  {order.payments.map((receipt) => (
                    <PaymentReceiptCard
                      key={receipt.id}
                      receipt={receipt}
                      canUpload={canCreate}
                      onUploaded={() => {
                        void queryClient.invalidateQueries({
                          queryKey: ['customer-payment-detail', orderId],
                        })
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="form-helper">No payments have been recorded for this order.</p>
              )}
            </section>
            {order.refunds.length > 0 && (
              <section className="customer-payment-section">
                <h3>Refund history</h3>
                <div className="customer-payment-refunds">
                  {order.refunds.map((refund) => (
                    <article key={refund.id}>
                      <div>
                        <strong>{refund.reference}</strong>
                        <StatusBadge value={refund.status} />
                      </div>
                      <strong>{formatPeso(refund.amount)}</strong>
                      {refund.processedReference && (
                        <span>Settlement reference: {refund.processedReference}</span>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            {canReadAudit && (
              <section className="customer-payment-section">
                <h3>Record history</h3>
                <p className="form-helper">Latest recorded changes (up to 25).</p>
                <RecordHistoryPanel
                  entries={order.history}
                  page={1}
                  pageSize={25}
                  total={order.history.length}
                  onPageChange={() => undefined}
                />
              </section>
            )}
            <div className="dialog-actions">
              {canCreate && (
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!order.canRecordPayment}
                  title={order.recordingBlocker ?? undefined}
                  onClick={() => onRecord(order)}
                >
                  <Plus size={16} />
                  Record payment
                </button>
              )}
            </div>
          </>
        )
      )}
    </AppDialog>
  )
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatPeso(value)}</strong>
    </div>
  )
}
