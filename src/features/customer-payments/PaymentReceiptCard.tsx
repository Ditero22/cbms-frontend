import { useState } from 'react'
import { AttachmentList } from '@/components/common/AttachmentList'
import { formatPeso } from '@/features/modules/order-decimals'
import type { CustomerReceipt } from './types'
import { formatPaymentDate } from './customer-payments.utils'

export function PaymentReceiptCard({
  receipt,
  canUpload,
  onUploaded,
}: {
  receipt: CustomerReceipt
  canUpload: boolean
  onUploaded: () => void
}) {
  const [proofsOpen, setProofsOpen] = useState(false)
  return (
    <article className="customer-receipt-card" aria-label={`Payment ${receipt.reference}`}>
      <div className="customer-receipt-heading">
        <div>
          <strong>{receipt.reference}</strong>
          <span>
            {formatPaymentDate(receipt.paymentDate)} · {receipt.method}
          </span>
        </div>
        <strong>{formatPeso(receipt.amount)}</strong>
      </div>
      <dl className="customer-receipt-metadata">
        <div>
          <dt>Recorded by</dt>
          <dd>{receipt.recordedByName}</dd>
        </div>
        <div>
          <dt>Reference number</dt>
          <dd>{receipt.externalReference || '—'}</dd>
        </div>
      </dl>
      {receipt.notes && <p className="customer-payment-note">{receipt.notes}</p>}
      <button
        type="button"
        className="button button-quiet"
        aria-expanded={proofsOpen}
        onClick={() => setProofsOpen((open) => !open)}
      >
        {proofsOpen
          ? 'Hide receipt/proof'
          : canUpload
            ? 'View or attach receipt/proof'
            : 'View receipt/proof'}
      </button>
      {proofsOpen && (
        <AttachmentList
          entityType="payment"
          entityId={receipt.id}
          canUpload={canUpload}
          onUploaded={onUploaded}
        />
      )}
    </article>
  )
}
