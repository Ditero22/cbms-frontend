import { FieldHeading } from '@/components/common/FieldHeading'
import { customerPaymentMethods as paymentMethods } from '@/features/customer-payments/payment-methods'
import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { completeOrder, rejectRefund, rejectReturn } from './modules.api'
import type { OrderDetailResponse, ReturnReceiptClassification } from './types'
import {
  formatPeso,
  formatQuantity as formatExactQuantity,
  fromMinorUnits,
  nonRestockedRemainder,
  toMinorUnits,
} from './order-decimals'

export type WorkflowDialog =
  | 'complete'
  | 'cancel'
  | 'refund'
  | 'return'
  | 'refund-reject'
  | 'return-reject'
  | 'receive-return'
  | null

type EligiblePayment = OrderDetailResponse['payments'][number] & {
  previouslyRefunded: string
  pendingRefundAmount: string
  remainingAmount: string
}
type ReturnableItem = OrderDetailResponse['deliveries'][number]['items'][number] & {
  remaining: string
  previouslyReturned: string
}
type ReceiveItems = Record<string, ReturnReceiptClassification>
type RunAction = (action: () => Promise<unknown>, successMessage: string) => void

type Props = {
  actionError?: string
  order: OrderDetailResponse
  dialog: WorkflowDialog
  busy: boolean
  closeDialog: () => void
  runAction: RunAction
  cancelReason: string
  setCancelReason: Dispatch<SetStateAction<string>>
  cancelNotes: string
  setCancelNotes: Dispatch<SetStateAction<string>>
  cancelQuantities: Record<string, string>
  setCancelQuantities: Dispatch<SetStateAction<Record<string, string>>>
  eligiblePayments: EligiblePayment[]
  selectedPayment: EligiblePayment | undefined
  paymentId: string
  setPaymentId: Dispatch<SetStateAction<string>>
  refundAmount: string
  setRefundAmount: Dispatch<SetStateAction<string>>
  refundMethod: string
  setRefundMethod: Dispatch<SetStateAction<string>>
  refundReason: string
  setRefundReason: Dispatch<SetStateAction<string>>
  refundNotes: string
  setRefundNotes: Dispatch<SetStateAction<string>>
  deliveryId: string
  setDeliveryId: Dispatch<SetStateAction<string>>
  returnableDeliveries: OrderDetailResponse['deliveries']
  selectedDelivery: OrderDetailResponse['deliveries'][number] | undefined
  returnableItems: ReturnableItem[]
  returnQuantities: Record<string, string>
  setReturnQuantities: Dispatch<SetStateAction<Record<string, string>>>
  returnReason: string
  setReturnReason: Dispatch<SetStateAction<string>>
  returnNotes: string
  setReturnNotes: Dispatch<SetStateAction<string>>
  decisionId: string
  decisionReason: string
  setDecisionReason: Dispatch<SetStateAction<string>>
  receiveItems: ReceiveItems
  setReceiveItems: Dispatch<SetStateAction<ReceiveItems>>
  cancellableItems: OrderDetailResponse['lifecycle']['items']
  requiresRefund: boolean
  submitCancellation: FormEventHandler<HTMLFormElement>
  submitRefund: FormEventHandler<HTMLFormElement>
  submitReturn: FormEventHandler<HTMLFormElement>
  submitReceiveReturn: FormEventHandler<HTMLFormElement>
}

const cancellationReasons = [
  ['customer request', 'Customer request'],
  ['duplicate order', 'Duplicate order'],
  ['incorrect order', 'Incorrect order'],
  ['project cancelled', 'Project cancelled'],
  ['unavailable materials', 'Unavailable materials'],
  ['pricing error', 'Pricing error'],
  ['payment issue', 'Payment issue'],
  ['management decision', 'Management decision'],
  ['other', 'Other'],
] as const
const returnConditions = ['Resalable', 'Damaged', 'Defective', 'Used', 'Lost', 'Non-returnable']

export function OrderWorkflowDialogViews({
  actionError,
  order,
  dialog,
  busy,
  closeDialog,
  runAction,
  cancelReason,
  setCancelReason,
  cancelNotes,
  setCancelNotes,
  cancelQuantities,
  setCancelQuantities,
  eligiblePayments,
  selectedPayment,
  paymentId,
  setPaymentId,
  refundAmount,
  setRefundAmount,
  refundMethod,
  setRefundMethod,
  refundReason,
  setRefundReason,
  refundNotes,
  setRefundNotes,
  deliveryId,
  setDeliveryId,
  returnableDeliveries,
  selectedDelivery,
  returnableItems,
  returnQuantities,
  setReturnQuantities,
  returnReason,
  setReturnReason,
  returnNotes,
  setReturnNotes,
  decisionId,
  decisionReason,
  setDecisionReason,
  receiveItems,
  setReceiveItems,
  cancellableItems,
  requiresRefund,
  submitCancellation,
  submitRefund,
  submitReturn,
  submitReceiveReturn,
}: Props) {
  const deliveryStatus = getDeliveryStatus(order.lifecycle.items)
  const paymentStatus = getPaymentStatus(order.paidAmount, order.balance)

  return (
    <>
      {' '}
      <AppDialog
        error={actionError}
        open={dialog === 'complete'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Complete order"
        description="Completion records that every line is delivered or cancelled and the cash balance is settled."
      >
        <div aria-busy={busy} className="dialog-form">
          <dl className="order-workflow-summary">
            <div>
              <dt>Order</dt>
              <dd>{order.orderNumber}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd>{formatCurrency(order.payableAmount)}</dd>
            </div>
            <div>
              <dt>Amount paid</dt>
              <dd>{formatCurrency(order.paidAmount)}</dd>
            </div>
            <div>
              <dt>Remaining balance</dt>
              <dd>{formatCurrency(order.balance)}</dd>
            </div>
            <div>
              <dt>Delivery status</dt>
              <dd>{deliveryStatus}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>{paymentStatus}</dd>
            </div>
          </dl>
          <p className="form-helper">
            This action closes the order. Related payment and delivery activity remains available in
            its history.
          </p>
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy}>Keep open</DialogCancelButton>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void runAction(() => completeOrder(order.id), 'Order completed.')}
            >
              {busy ? 'Completing…' : 'Complete order'}
            </button>
          </div>
        </div>
      </AppDialog>
      <AppDialog
        error={actionError}
        open={dialog === 'cancel'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Cancel order quantities"
        size="md"
        description="Select the remaining quantity to cancel on each line. Delivered quantities must be returned first."
      >
        <form aria-busy={busy} className="dialog-form" onSubmit={submitCancellation}>
          <div className="workflow-line-list">
            {cancellableItems.map((item) => (
              <label className="workflow-line" key={item.id}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.cancellableQuantity} {item.unit} available to cancel
                  </small>
                </span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max={item.cancellableQuantity}
                  step="0.001"
                  inputMode="decimal"
                  value={cancelQuantities[item.id] ?? ''}
                  onChange={(event) =>
                    setCancelQuantities((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  aria-label={`Quantity to cancel for ${item.productName}`}
                />
              </label>
            ))}
          </div>
          {requiresRefund && (
            <p className="form-helper">
              Recorded payments stay in the history. If these quantities lower the order total below
              the net amount paid, process the difference as a refund before cancellation.
            </p>
          )}
          <label className="field-label">
            <FieldHeading required>Reason</FieldHeading>
            <select
              className="form-input"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            >
              {cancellationReasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <FieldHeading required={cancelReason === 'other'}>Notes</FieldHeading>
            <textarea
              className="form-input"
              rows={3}
              maxLength={1000}
              value={cancelNotes}
              onChange={(event) => setCancelNotes(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy} />
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Cancel selected quantities'}
            </button>
          </div>
        </form>
      </AppDialog>
      <AppDialog
        error={actionError}
        open={dialog === 'refund'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Request payment refund"
        size="md"
        description="Refund requests reserve part of a recorded payment until they are approved, rejected, or processed."
      >
        <form aria-busy={busy} className="dialog-form" onSubmit={submitRefund}>
          <label className="field-label">
            <FieldHeading required>Payment</FieldHeading>
            <select
              className="form-input"
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
              required
            >
              <option value="">Choose a payment</option>
              {eligiblePayments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.reference} · {payment.method} · {formatCurrency(payment.remainingAmount)}{' '}
                  refundable
                </option>
              ))}
            </select>
          </label>
          {selectedPayment && (
            <dl className="order-workflow-summary">
              <div>
                <dt>Original payment</dt>
                <dd>{formatCurrency(selectedPayment.amount)}</dd>
              </div>
              <div>
                <dt>Previously refunded</dt>
                <dd>{formatCurrency(selectedPayment.previouslyRefunded)}</dd>
              </div>
              <div>
                <dt>Pending refund</dt>
                <dd>{formatCurrency(selectedPayment.pendingRefundAmount)}</dd>
              </div>
              <div>
                <dt>Still refundable</dt>
                <dd>{formatCurrency(selectedPayment.remainingAmount)}</dd>
              </div>
            </dl>
          )}
          <div className="transfer-branch-fields">
            <label className="field-label">
              <FieldHeading required>Amount</FieldHeading>
              <input
                className="form-input"
                type="number"
                min="0.01"
                max={selectedPayment?.remainingAmount}
                step="0.01"
                inputMode="decimal"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              <FieldHeading required>Refund method</FieldHeading>
              <select
                className="form-input"
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">
            <FieldHeading required>Reason</FieldHeading>
            <input
              className="form-input"
              minLength={3}
              maxLength={300}
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Notes
            <textarea
              className="form-input"
              rows={3}
              maxLength={1000}
              value={refundNotes}
              onChange={(event) => setRefundNotes(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy} />
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit refund request'}
            </button>
          </div>
        </form>
      </AppDialog>
      <AppDialog
        error={actionError}
        open={dialog === 'return'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Request item return"
        size="md"
        description="Select delivered items and quantities to submit for review. Inventory changes only when the return is received."
      >
        <form aria-busy={busy} className="dialog-form" onSubmit={submitReturn}>
          <label className="field-label">
            <FieldHeading required>Delivery</FieldHeading>
            <select
              className="form-input"
              value={deliveryId}
              onChange={(event) => {
                setDeliveryId(event.target.value)
                setReturnQuantities({})
              }}
              required
            >
              <option value="">Choose a completed delivery</option>
              {returnableDeliveries.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {delivery.reference} · {delivery.destination}
                </option>
              ))}
            </select>
          </label>
          {selectedDelivery && (
            <div className="workflow-line-list">
              {returnableItems.map((item) => (
                <label className="workflow-line" key={item.orderItemId}>
                  <span>
                    <strong>{item.productName}</strong>
                    <small>
                      Ordered{' '}
                      {formatQuantity(
                        order.items.find((line) => line.id === item.orderItemId)?.quantity ?? '0',
                      )}{' '}
                      · this delivery {formatQuantity(item.quantity)} · previously
                      returned/requested {formatQuantity(item.previouslyReturned)} · max returnable{' '}
                      {formatQuantity(item.remaining)} {item.unit}
                    </small>
                  </span>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max={item.remaining}
                    step="0.001"
                    inputMode="decimal"
                    value={returnQuantities[item.orderItemId] ?? ''}
                    onChange={(event) =>
                      setReturnQuantities((current) => ({
                        ...current,
                        [item.orderItemId]: event.target.value,
                      }))
                    }
                    aria-label={`Quantity to return for ${item.productName}`}
                  />
                </label>
              ))}
              {!returnableItems.length && (
                <p className="form-helper">
                  All quantities on this delivery already have a return request.
                </p>
              )}
            </div>
          )}
          <label className="field-label">
            <FieldHeading required>Reason</FieldHeading>
            <input
              className="form-input"
              minLength={3}
              maxLength={300}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Notes
            <textarea
              className="form-input"
              rows={3}
              maxLength={1000}
              value={returnNotes}
              onChange={(event) => setReturnNotes(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy} />
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !returnableItems.length}
            >
              {busy ? 'Submitting…' : 'Submit return request'}
            </button>
          </div>
        </form>
      </AppDialog>
      <AppDialog
        error={actionError}
        open={dialog === 'refund-reject' || dialog === 'return-reject'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Reject request"
        description="Record why this request is being rejected. The request will remain in the order history."
      >
        <form
          aria-busy={busy}
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!decisionReason.trim()) return
            const action =
              dialog === 'refund-reject'
                ? rejectRefund(decisionId, decisionReason.trim())
                : rejectReturn(decisionId, decisionReason.trim())
            void runAction(() => action, 'Request rejected.')
          }}
        >
          <label className="field-label">
            <FieldHeading required>Rejection reason</FieldHeading>
            <textarea
              className="form-input"
              rows={3}
              minLength={3}
              maxLength={1000}
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              required
            />
          </label>
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy} />
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Reject request'}
            </button>
          </div>
        </form>
      </AppDialog>
      <AppDialog
        error={actionError}
        open={dialog === 'receive-return'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Receive returned items"
        size="md"
        description="Classify each item. Only quantities accepted as resalable return to inventory."
      >
        <form aria-busy={busy} className="dialog-form" onSubmit={submitReceiveReturn}>
          {order.returns
            .find((record) => record.id === decisionId)
            ?.items.map((item) => {
              const current: ReturnReceiptClassification = receiveItems[item.orderItemId] ?? {
                condition: 'Resalable',
                acceptedQuantity: item.quantity,
              }
              const remainder =
                current.condition === 'Resalable'
                  ? nonRestockedRemainder(item.quantity, current.acceptedQuantity)
                  : 0n
              return (
                <div className="workflow-receive-row" key={item.orderItemId}>
                  <div>
                    <strong>{item.productName}</strong>
                    <small>
                      {item.quantity} requested · {item.sku}
                    </small>
                  </div>
                  <div className="transfer-branch-fields">
                    <label className="field-label">
                      Condition
                      <select
                        className="form-input"
                        value={current.condition}
                        disabled={busy}
                        onChange={(event) =>
                          setReceiveItems((state) => ({
                            ...state,
                            [item.orderItemId]: {
                              condition: event.target.value,
                              acceptedQuantity:
                                event.target.value === 'Resalable'
                                  ? (state[item.orderItemId]?.acceptedQuantity ?? item.quantity)
                                  : '0',
                            },
                          }))
                        }
                      >
                        {returnConditions.map((condition) => (
                          <option key={condition}>{condition}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Accepted qty
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        max={item.quantity}
                        step="0.001"
                        required
                        disabled={busy || current.condition !== 'Resalable'}
                        value={current.acceptedQuantity}
                        onChange={(event) =>
                          setReceiveItems((state) => ({
                            ...state,
                            [item.orderItemId]: {
                              ...current,
                              acceptedQuantity: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                  {remainder > 0n && (
                    <label className="field-label">
                      <FieldHeading required>
                        Condition of remaining {fromMinorUnits(remainder, 3)}
                      </FieldHeading>
                      <select
                        className="form-input"
                        aria-label={`Condition of remaining quantity for ${item.productName}`}
                        required
                        disabled={busy}
                        value={current.remainderCondition ?? ''}
                        onChange={(event) =>
                          setReceiveItems((state) => ({
                            ...state,
                            [item.orderItemId]: {
                              ...current,
                              remainderCondition: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Choose the condition of goods not restocked</option>
                        {returnConditions
                          .filter((condition) => condition !== 'Resalable')
                          .map((condition) => (
                            <option key={condition}>{condition}</option>
                          ))}
                      </select>
                      <span className="form-helper">
                        Only the resalable quantity increases available stock.
                      </span>
                    </label>
                  )}
                </div>
              )
            })}
          <div className="dialog-actions">
            <DialogCancelButton disabled={busy} />
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Receiving…' : 'Receive return'}
            </button>
          </div>
        </form>
      </AppDialog>
    </>
  )
}

function formatCurrency(amount: string) {
  return formatPeso(amount)
}

function formatQuantity(quantity: string | number) {
  return formatExactQuantity(String(quantity))
}

function getDeliveryStatus(
  items: OrderDetailResponse['lifecycle']['items'],
): 'Not delivered' | 'Partially delivered' | 'Fulfillment complete' {
  if (items.every((item) => item.fulfillmentComplete)) return 'Fulfillment complete'
  return items.some((item) => toMinorUnits(item.netDeliveredQuantity, 3) > 0n)
    ? 'Partially delivered'
    : 'Not delivered'
}

function getPaymentStatus(paidAmount: string, balance: string) {
  const paid = toMinorUnits(paidAmount, 2)
  const outstanding = balance.startsWith('-')
    ? -toMinorUnits(balance.slice(1), 2)
    : toMinorUnits(balance, 2)
  if (outstanding < 0n) return 'Overpaid'
  if (outstanding === 0n && paid > 0n) return 'Paid'
  return paid > 0n ? 'Partially paid' : 'Unpaid'
}
