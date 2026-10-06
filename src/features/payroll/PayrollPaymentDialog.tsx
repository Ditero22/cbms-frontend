import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { ProofFileField } from '@/components/common/ProofFileField'
import { validatePaymentProof } from '@/components/common/payment-proof'
import { philippineDate } from '@/features/customer-payments/customer-payments.utils'
import { formatPeso } from '@/features/modules/order-decimals'
import { markPayrollEntryPaid } from './payroll.api'
import type { PayrollEntry } from './types'

export function PayrollPaymentDialog({
  entry,
  period,
  onClose,
  onSaved,
}: {
  entry: PayrollEntry
  period: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const requestKey = useRef(crypto.randomUUID())
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proofError, setProofError] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [paymentDate, setPaymentDate] = useState(philippineDate())
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const invalid = validatePaymentProof(proofFile)
    setProofError(invalid)
    if (invalid || !proofFile) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await markPayrollEntryPaid(
        entry.id,
        {
          paymentDate,
          paymentMethod,
          paymentReference,
          paymentNotes,
          requestKey: requestKey.current,
        },
        proofFile,
      )
      await onSaved()
      toast.success('Payroll payment and proof recorded.')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The payment could not be recorded.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Record payroll payment"
      description={`${entry.employeeName} · ${period}`}
      size="md"
    >
      <form aria-busy={busy} className="dialog-form" onSubmit={(event) => void submit(event)}>
        <dl className="payroll-amount-grid">
          <div>
            <dt>Gross pay</dt>
            <dd>{formatPeso(entry.grossPay)}</dd>
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
        <div className="payroll-fields-grid">
          <label className="field-label">
            <FieldHeading required>Payment date</FieldHeading>
            <input
              className="form-input"
              type="date"
              required
              max={philippineDate()}
              value={paymentDate}
              disabled={busy}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </label>
          <label className="field-label">
            <FieldHeading required>Payment method</FieldHeading>
            <select
              className="form-input"
              value={paymentMethod}
              disabled={busy}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {['Cash', 'GCash', 'Bank transfer', 'Check', 'Other'].map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <label className="field-label payroll-span-two">
            <FieldHeading>Reference number</FieldHeading>
            <input
              className="form-input"
              maxLength={100}
              value={paymentReference}
              disabled={busy}
              onChange={(event) => setPaymentReference(event.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          <FieldHeading>Payment notes</FieldHeading>
          <textarea
            className="form-input"
            rows={2}
            maxLength={2000}
            value={paymentNotes}
            disabled={busy}
            onChange={(event) => setPaymentNotes(event.target.value)}
          />
        </label>
        <ProofFileField
          file={proofFile}
          disabled={busy}
          error={proofError}
          onChange={(file) => {
            setProofFile(file)
            setProofError('')
          }}
        />
        <p className="payroll-note">
          Confirm the actual payment and review its proof. Both are saved together.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
