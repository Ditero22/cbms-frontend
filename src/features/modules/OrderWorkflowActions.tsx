import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/common/DataTable'
import {
  approveRefund,
  approveReturn,
  cancelOrder,
  processRefund,
  receiveReturn,
  requestOrderRefund,
  requestOrderReturn,
} from './modules.api'
import type { OrderDetailResponse, ReturnReceiptClassification } from './types'
import { OrderWorkflowDialogViews, type WorkflowDialog } from './OrderWorkflowDialogViews'
import {
  formatPeso,
  fromMinorUnits,
  isPositiveDecimal,
  nonRestockedRemainder,
  remainingRefundCents,
  remainingReturnMilli,
  toMinorUnits,
} from './order-decimals'

type RequestIntent = { payload: string; key: string }

export function OrderWorkflowActions({
  order,
  permissions,
}: {
  order: OrderDetailResponse
  permissions: string[]
}) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<WorkflowDialog>(null)
  const [cancelReason, setCancelReason] = useState('customer request')
  const [cancelNotes, setCancelNotes] = useState('')
  const [cancelQuantities, setCancelQuantities] = useState<Record<string, string>>({})
  const [paymentId, setPaymentId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('Cash')
  const [refundReason, setRefundReason] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [deliveryId, setDeliveryId] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [decisionId, setDecisionId] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [receiveItems, setReceiveItems] = useState<Record<string, ReturnReceiptClassification>>({})
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const refundIntentRef = useRef<RequestIntent | null>(null)
  const returnIntentRef = useRef<RequestIntent | null>(null)

  const selectedDelivery = order.deliveries.find((delivery) => delivery.id === deliveryId)
  const returnableDeliveries = useMemo(
    () => order.deliveries.filter((delivery) => delivery.status === 'Delivered'),
    [order.deliveries],
  )
  const eligiblePayments = useMemo(
    () =>
      order.payments.flatMap((payment) => {
        if (payment.status !== 'Paid') return []
        const paymentRefunds = order.refunds.filter((refund) => refund.paymentId === payment.id)
        const previouslyRefunded = paymentRefunds
          .filter((refund) => refund.status === 'Processed')
          .reduce((total, refund) => total + toMinorUnits(refund.amount, 2), 0n)
        const pendingRefundAmount = paymentRefunds
          .filter((refund) => ['Requested', 'Approved'].includes(refund.status))
          .reduce((total, refund) => total + toMinorUnits(refund.amount, 2), 0n)
        const remaining = remainingRefundCents(payment.amount, paymentRefunds)
        return remaining > 0n
          ? [
              {
                ...payment,
                previouslyRefunded: fromMinorUnits(previouslyRefunded, 2),
                pendingRefundAmount: fromMinorUnits(pendingRefundAmount, 2),
                remainingAmount: fromMinorUnits(remaining, 2),
              },
            ]
          : []
      }),
    [order.payments, order.refunds],
  )
  const selectedPayment = eligiblePayments.find((payment) => payment.id === paymentId)
  const cancellableItems = order.lifecycle.items.filter(
    (item) => toMinorUnits(item.cancellableQuantity, 3) > 0n,
  )
  const returnableItems = (selectedDelivery?.items ?? [])
    .map((item) => {
      const alreadyReturned = order.returns
        .filter((record) => record.deliveryId === selectedDelivery?.id)
        .flatMap((record) =>
          record.items
            .filter((line) => line.orderItemId === item.orderItemId)
            .map((line) => ({ quantity: line.quantity, status: record.status })),
        )
      const remaining = remainingReturnMilli(item.quantity, alreadyReturned)
      return {
        ...item,
        remaining: fromMinorUnits(remaining, 3),
        previouslyReturned: fromMinorUnits(toMinorUnits(item.quantity, 3) - remaining, 3),
      }
    })
    .filter((item) => toMinorUnits(item.remaining, 3) > 0n)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['order-detail', order.id] }),
      queryClient.invalidateQueries({ queryKey: ['module', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: ['module', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: ['module', 'deliveries'] }),
      queryClient.invalidateQueries({ queryKey: ['module', 'inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-options'] }),
      queryClient.invalidateQueries({ queryKey: ['order-options'] }),
      queryClient.invalidateQueries({ queryKey: ['report'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-options'] }),
      queryClient.invalidateQueries({ queryKey: ['delivery-options'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
    ])
  }

  async function runAction(
    action: () => Promise<unknown>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await action()
      await refresh()
      onSuccess?.()
      toast.success(successMessage)
      setDialog(null)
      setDecisionId('')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'The order workflow could not be updated.',
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function closeDialog() {
    if (busy) return
    setDialog(null)
    setDecisionId('')
    setDecisionReason('')
  }

  function submitCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const items = cancellableItems
      .map((item) => ({ orderItemId: item.id, quantity: cancelQuantities[item.id] ?? '' }))
      .filter((item) => isPositiveDecimal(item.quantity, 3))
    if (!items.length) {
      toast.error('Enter a quantity for at least one order item.')
      return
    }
    if (cancelReason === 'other' && !cancelNotes.trim()) {
      toast.error('Add a note when the reason is Other.')
      return
    }
    void runAction(
      () =>
        cancelOrder(order.id, {
          reason: cancelReason,
          notes: cancelNotes.trim() || undefined,
          items,
        }),
      'Order quantities cancelled.',
    )
  }

  function submitRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return
    if (!paymentId) return toast.error('Choose a payment to refund.')
    if (!isPositiveDecimal(refundAmount, 2)) {
      return toast.error('Enter a positive amount with up to two decimal places.')
    }
    if (
      selectedPayment &&
      toMinorUnits(refundAmount, 2) > toMinorUnits(selectedPayment.remainingAmount, 2)
    ) {
      return toast.error('Refund amount exceeds the selected payment’s refundable balance.')
    }
    const payload = {
      paymentId,
      amount: refundAmount,
      method: refundMethod,
      reason: refundReason,
      notes: refundNotes.trim() || undefined,
    }
    const fingerprint = JSON.stringify(payload)
    const requestKey =
      refundIntentRef.current?.payload === fingerprint
        ? refundIntentRef.current.key
        : crypto.randomUUID()
    refundIntentRef.current = { payload: fingerprint, key: requestKey }
    void runAction(
      () =>
        requestOrderRefund(order.id, {
          requestKey,
          ...payload,
        }),
      'Refund request submitted for approval.',
      () => {
        refundIntentRef.current = null
      },
    )
  }

  function submitReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return
    if (!deliveryId) return toast.error('Choose a completed delivery.')
    const items = returnableItems
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: returnQuantities[item.orderItemId] ?? '',
      }))
      .filter((item) => isPositiveDecimal(item.quantity, 3))
    if (!items.length) return toast.error('Enter a quantity for at least one delivered item.')
    const payload = {
      deliveryId,
      reason: returnReason,
      notes: returnNotes.trim() || undefined,
      items,
    }
    const fingerprint = JSON.stringify(payload)
    const requestKey =
      returnIntentRef.current?.payload === fingerprint
        ? returnIntentRef.current.key
        : crypto.randomUUID()
    returnIntentRef.current = { payload: fingerprint, key: requestKey }
    void runAction(
      () =>
        requestOrderReturn(order.id, {
          requestKey,
          ...payload,
        }),
      'Return request submitted for approval.',
      () => {
        returnIntentRef.current = null
      },
    )
  }

  function submitReceiveReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const record = order.returns.find((candidate) => candidate.id === decisionId)
    if (!record) return
    const items = record.items.map((item) => {
      const current = receiveItems[item.orderItemId] ?? {
        condition: 'Resalable',
        acceptedQuantity: item.quantity,
      }
      const hasRemainder =
        current.condition === 'Resalable' &&
        nonRestockedRemainder(item.quantity, current.acceptedQuantity) > 0n
      return {
        orderItemId: item.orderItemId,
        condition: current.condition,
        acceptedQuantity: current.acceptedQuantity,
        ...(hasRemainder && current.remainderCondition
          ? { remainderCondition: current.remainderCondition }
          : {}),
      }
    })
    void runAction(
      () => receiveReturn(record.id, items),
      'Returned items received and inventory updated.',
    )
  }

  const canRequestRefund =
    permissions.includes('payments.refund.request') && eligiblePayments.length > 0
  const canRequestReturn =
    permissions.includes('returns.create') &&
    returnableDeliveries.length > 0 &&
    !order.lifecycle.requiresLegacyDeliveryReconciliation
  const canCancel =
    permissions.includes('orders.cancel') &&
    order.lifecycle.cancellation.canCancelRemaining &&
    cancellableItems.length > 0
  const canComplete =
    permissions.includes('orders.complete') && order.lifecycle.completion.canComplete

  return (
    <>
      {(canCancel || canComplete || canRequestRefund || canRequestReturn) && (
        <section className="order-workflow-actions" aria-label="Order actions">
          <div className="order-workflow-action-heading">
            <div>
              <h3>Order actions</h3>
              <p>Available actions reflect the current delivery and payment state.</p>
            </div>
          </div>
          <div className="order-workflow-action-buttons">
            {canComplete && (
              <button className="button button-primary" onClick={() => setDialog('complete')}>
                Complete order
              </button>
            )}
            {canCancel && (
              <button className="button button-outline" onClick={() => setDialog('cancel')}>
                Cancel quantities
              </button>
            )}
            {canRequestRefund && (
              <button className="button button-outline" onClick={() => setDialog('refund')}>
                Request refund
              </button>
            )}
            {canRequestReturn && (
              <button className="button button-outline" onClick={() => setDialog('return')}>
                Request return
              </button>
            )}
          </div>
        </section>
      )}
      {order.refunds.length > 0 && (
        <section className="order-workflow-history">
          <div className="employee-detail-section-heading">
            <h3>Refunds</h3>
          </div>
          <ul className="order-detail-list">
            {order.refunds.map((refund) => (
              <li key={refund.id}>
                <div>
                  <strong>
                    {refund.reference} · {formatCurrency(refund.amount)}
                  </strong>
                  <span>
                    {refund.paymentReference} · {refund.method} · {refund.reason}
                  </span>
                  <span>
                    Requested by {refund.requestedByName} · {formatDateTime(refund.requestedAt)}
                  </span>
                  {refund.approvedAt && (
                    <span>
                      Approved by {refund.approvedByName || 'Unknown'} ·{' '}
                      {formatDateTime(refund.approvedAt)}
                    </span>
                  )}
                  {refund.processedAt && (
                    <span>
                      Processed by {refund.processedByName || 'Unknown'} ·{' '}
                      {formatDateTime(refund.processedAt)}
                      {refund.processedReference && ` · Ref ${refund.processedReference}`}
                    </span>
                  )}
                  {refund.notes && <span>{refund.notes}</span>}
                </div>
                <div>
                  <StatusBadge value={refund.status} />
                  {refund.status === 'Requested' &&
                    permissions.includes('payments.refund.approve') && (
                      <div className="order-workflow-row-actions">
                        <button
                          className="button button-outline button-small"
                          disabled={busy}
                          onClick={() =>
                            void runAction(() => approveRefund(refund.id), 'Refund approved.')
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="button button-outline button-small"
                          disabled={busy}
                          onClick={() => {
                            setDecisionId(refund.id)
                            setDialog('refund-reject')
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  {refund.status === 'Approved' &&
                    permissions.includes('payments.refund.process') && (
                      <button
                        className="button button-outline button-small"
                        disabled={busy}
                        onClick={() =>
                          void runAction(() => processRefund(refund.id), 'Refund processed.')
                        }
                      >
                        Mark processed
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {order.returns.length > 0 && (
        <section className="order-workflow-history">
          <div className="employee-detail-section-heading">
            <h3>Returns</h3>
          </div>
          <ul className="order-detail-list">
            {order.returns.map((record) => (
              <li key={record.id}>
                <div>
                  <strong>
                    {record.reference} · {record.deliveryReference}
                  </strong>
                  <span>
                    {record.reason} ·{' '}
                    {record.items
                      .map((item) => `${item.productName} × ${item.quantity}`)
                      .join(', ')}
                  </span>
                  <span>
                    Requested by {record.requestedByName} · {formatDateTime(record.requestedAt)}
                  </span>
                  {record.approvedAt && (
                    <span>
                      Reviewed by {record.approvedByName || 'Unknown'} ·{' '}
                      {formatDateTime(record.approvedAt)}
                    </span>
                  )}
                  {record.receivedAt && (
                    <span>
                      Received by {record.receivedByName || 'Unknown'} ·{' '}
                      {formatDateTime(record.receivedAt)}
                    </span>
                  )}
                  {record.status === 'Received' && (
                    <span>
                      {record.items
                        .map((item) => {
                          if (item.condition !== 'Resalable')
                            return `${item.productName}: ${item.quantity} ${item.condition.toLowerCase()}, not restocked`
                          const remainder = nonRestockedRemainder(
                            item.quantity,
                            item.acceptedQuantity,
                          )
                          return `${item.productName}: ${item.acceptedQuantity} restocked${
                            remainder > 0n
                              ? ` · ${fromMinorUnits(remainder, 3)} ${(item.remainderCondition ?? 'Unclassified').toLowerCase()}, not restocked`
                              : ''
                          }`
                        })
                        .join(' · ')}
                    </span>
                  )}
                  {(record.notes || record.rejectionNotes) && (
                    <span>{record.rejectionNotes || record.notes}</span>
                  )}
                </div>
                <div>
                  <StatusBadge value={record.status} />
                  {record.status === 'Requested' && permissions.includes('returns.approve') && (
                    <div className="order-workflow-row-actions">
                      <button
                        className="button button-outline button-small"
                        disabled={busy}
                        onClick={() =>
                          void runAction(() => approveReturn(record.id), 'Return approved.')
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="button button-outline button-small"
                        disabled={busy}
                        onClick={() => {
                          setDecisionId(record.id)
                          setDialog('return-reject')
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {record.status === 'Approved' && permissions.includes('returns.receive') && (
                    <button
                      className="button button-outline button-small"
                      disabled={busy}
                      onClick={() => {
                        setDecisionId(record.id)
                        setReceiveItems(
                          Object.fromEntries(
                            record.items.map((item) => [
                              item.orderItemId,
                              { condition: 'Resalable', acceptedQuantity: item.quantity },
                            ]),
                          ),
                        )
                        setDialog('receive-return')
                      }}
                    >
                      Receive items
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <OrderWorkflowDialogViews
        order={order}
        dialog={dialog}
        busy={busy}
        closeDialog={closeDialog}
        runAction={runAction}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        cancelNotes={cancelNotes}
        setCancelNotes={setCancelNotes}
        cancelQuantities={cancelQuantities}
        setCancelQuantities={setCancelQuantities}
        eligiblePayments={eligiblePayments}
        selectedPayment={selectedPayment}
        paymentId={paymentId}
        setPaymentId={setPaymentId}
        refundAmount={refundAmount}
        setRefundAmount={setRefundAmount}
        refundMethod={refundMethod}
        setRefundMethod={setRefundMethod}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        refundNotes={refundNotes}
        setRefundNotes={setRefundNotes}
        deliveryId={deliveryId}
        setDeliveryId={setDeliveryId}
        returnableDeliveries={returnableDeliveries}
        selectedDelivery={selectedDelivery}
        returnableItems={returnableItems}
        returnQuantities={returnQuantities}
        setReturnQuantities={setReturnQuantities}
        returnReason={returnReason}
        setReturnReason={setReturnReason}
        returnNotes={returnNotes}
        setReturnNotes={setReturnNotes}
        decisionId={decisionId}
        decisionReason={decisionReason}
        setDecisionReason={setDecisionReason}
        receiveItems={receiveItems}
        setReceiveItems={setReceiveItems}
        cancellableItems={cancellableItems}
        requiresRefund={order.lifecycle.cancellation.requiresRefund}
        submitCancellation={submitCancellation}
        submitRefund={submitRefund}
        submitReturn={submitReturn}
        submitReceiveReturn={submitReceiveReturn}
      />{' '}
    </>
  )
}

function formatCurrency(amount: string) {
  return formatPeso(amount)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
