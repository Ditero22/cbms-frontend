import { useState } from 'react'
import { AttachmentList } from '@/components/common/AttachmentList'
import { StatusInline } from '@/components/common/StatusInline'
import { formatPeso } from '@/features/modules/order-decimals'
import { PayrollPaymentDialog } from './PayrollPaymentDialog'
import { PayrollReceiptDialog } from './PayrollReceiptDialog'
import type { PayrollEntry } from './types'

export function PayrollEntryCard({
  entry,
  runStatus,
  period,
  permissions,
  onChanged,
}: {
  entry: PayrollEntry
  runStatus: 'Draft' | 'Processed'
  period: string
  permissions: string[]
  onChanged: () => Promise<void>
}) {
  const [action, setAction] = useState<'pay' | 'receive' | null>(null)
  return (
    <article className="payroll-detail-card">
      <div className="payroll-detail-card-heading">
        <div>
          <h4>{entry.employeeName}</h4>
          <span>
            {entry.employeeNumber} · {entry.position}
          </span>
        </div>
        <StatusInline status={entry.paymentStatus} />
      </div>
      <dl className="payroll-amount-grid">
        <div>
          <dt>Regular pay</dt>
          <dd>{formatPeso(entry.regularPay)}</dd>
          <small>
            {entry.payBasis} · {entry.units} × {formatPeso(entry.rate)}
          </small>
        </div>
        <div>
          <dt>Additional pay</dt>
          <dd>{formatPeso(entry.additionalPay)}</dd>
        </div>
        <div>
          <dt>Deductions</dt>
          <dd>{formatPeso(entry.deductions)}</dd>
        </div>
        <div>
          <dt>Net pay</dt>
          <dd>{formatPeso(entry.netPay)}</dd>
        </div>
      </dl>
      {entry.adjustments.length > 0 && (
        <ul className="payroll-adjustments">
          {entry.adjustments.map((adjustment) => (
            <li key={adjustment.id}>
              <span>
                {adjustment.type}
                {adjustment.kind === 'deduction' ? ' · deduction' : ''}
                {adjustment.notes ? ` · ${adjustment.notes}` : ''}
              </span>
              <strong>{formatPeso(adjustment.amount)}</strong>
            </li>
          ))}
        </ul>
      )}
      {entry.paymentStatus !== 'Pending' && (
        <div className="payroll-payment-meta">
          <span>
            Paid{' '}
            {entry.paymentDate
              ? new Date(`${entry.paymentDate}T00:00:00`).toLocaleDateString('en-PH')
              : '—'}
            {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}
            {entry.paymentReference ? ` · Ref ${entry.paymentReference}` : ''}
            {entry.paidByName ? ` · recorded by ${entry.paidByName}` : ''}
          </span>
          {entry.paymentNotes && <span>{entry.paymentNotes}</span>}
          {entry.paymentStatus === 'Received' && (
            <span>
              Received {entry.receivedAt ? new Date(entry.receivedAt).toLocaleString('en-PH') : ''}
              {entry.confirmedByName ? ` · confirmed by ${entry.confirmedByName}` : ''}
            </span>
          )}
        </div>
      )}
      {runStatus === 'Processed' && (
        <div className="payroll-entry-actions">
          {entry.paymentStatus === 'Pending' && permissions.includes('payroll.pay') && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setAction('pay')}
            >
              Record payment
            </button>
          )}
          {entry.paymentStatus === 'Paid' && permissions.includes('payroll.receive') && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setAction('receive')}
            >
              Confirm receipt
            </button>
          )}
        </div>
      )}
      {entry.paymentStatus !== 'Pending' && (
        <AttachmentList
          entityType="payroll-entry"
          entityId={entry.id}
          canUpload={permissions.includes('payroll.pay') || permissions.includes('payroll.receive')}
          onUploaded={() => void onChanged()}
        />
      )}
      {action === 'pay' && (
        <PayrollPaymentDialog
          entry={entry}
          period={period}
          onClose={() => setAction(null)}
          onSaved={onChanged}
        />
      )}
      {action === 'receive' && (
        <PayrollReceiptDialog entry={entry} onClose={() => setAction(null)} onSaved={onChanged} />
      )}
    </article>
  )
}
