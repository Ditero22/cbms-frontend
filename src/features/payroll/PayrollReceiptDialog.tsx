import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { getProofs, proofQueryKey } from '@/components/common/proofs.api'
import { confirmPayrollEntryReceived } from './payroll.api'
import type { PayrollEntry } from './types'

function nowLocal() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function PayrollReceiptDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: PayrollEntry
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receivedAt, setReceivedAt] = useState(nowLocal())
  const [acknowledgement, setAcknowledgement] = useState('')
  const [proofAttachmentId, setProofAttachmentId] = useState('')
  const proofs = useQuery({
    queryKey: proofQueryKey('payroll-entry', entry.id),
    queryFn: () => getProofs('payroll-entry', entry.id),
  })
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    if (!acknowledgement.trim() && !proofAttachmentId) {
      setError('Add an employee acknowledgement or choose receipt proof.')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await confirmPayrollEntryReceived(entry.id, {
        receivedAt: new Date(receivedAt).toISOString(),
        acknowledgement: acknowledgement.trim(),
        ...(proofAttachmentId ? { proofAttachmentId } : {}),
      })
      await onSaved()
      toast.success('Employee receipt confirmed.')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The receipt could not be confirmed.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Confirm employee receipt"
      description={entry.employeeName}
      size="sm"
    >
      <form aria-busy={busy} className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label">
          <FieldHeading required>Received at</FieldHeading>
          <input
            className="form-input"
            type="datetime-local"
            required
            max={nowLocal()}
            value={receivedAt}
            disabled={busy}
            onChange={(event) => setReceivedAt(event.target.value)}
          />
        </label>
        <label className="field-label">
          <FieldHeading>Employee acknowledgement</FieldHeading>
          <textarea
            className="form-input"
            rows={3}
            maxLength={500}
            value={acknowledgement}
            disabled={busy}
            onChange={(event) => setAcknowledgement(event.target.value)}
            placeholder="Record how the employee confirmed receipt"
          />
        </label>
        <label className="field-label">
          <FieldHeading>Receipt proof</FieldHeading>
          <select
            className="form-input"
            disabled={busy || proofs.isPending || proofs.isError}
            value={proofAttachmentId}
            onChange={(event) => setProofAttachmentId(event.target.value)}
          >
            <option value="">Use acknowledgement only</option>
            {proofs.data?.items.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName}
              </option>
            ))}
          </select>
        </label>
        {proofs.isError && (
          <p className="field-error" role="alert">
            {proofs.error.message} You can still record an acknowledgement.
          </p>
        )}
        <p className="payroll-note">
          An acknowledgement or receipt proof is required. Choose proof only when it confirms that
          the employee received payment.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm receipt'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
