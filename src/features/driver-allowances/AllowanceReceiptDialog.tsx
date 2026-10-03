import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { getProofs, proofQueryKey } from '@/components/common/proofs.api'
import { formatPeso } from '@/features/modules/order-decimals'
import type { AllowanceRecord } from './types'

function nowInput() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`
}
export function AllowanceReceiptDialog({
  record,
  busy,
  error,
  onClose,
  onReceive,
}: {
  record: AllowanceRecord
  busy: boolean
  error?: string | null
  onClose: () => void
  onReceive: (values: {
    receivedAt: string
    acknowledgement?: string
    proofAttachmentId?: string
  }) => Promise<boolean>
}) {
  const [acknowledgement, setAcknowledgement] = useState('')
  const [proofId, setProofId] = useState('')
  const [receivedAt, setReceivedAt] = useState(nowInput)
  const [validationError, setValidationError] = useState<string | null>(null)
  const proofs = useQuery({
    queryKey: proofQueryKey('driver-allowance', record.id),
    queryFn: () => getProofs('driver-allowance', record.id),
  })
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!acknowledgement.trim() && !proofId) {
      setValidationError('Choose receipt proof or enter the worker’s acknowledgement.')
      return
    }
    if (!receivedAt || Number.isNaN(new Date(receivedAt).getTime())) {
      setValidationError('Enter the receipt date and time.')
      return
    }
    setValidationError(null)
    if (
      await onReceive({
        receivedAt: new Date(receivedAt).toISOString(),
        acknowledgement: acknowledgement.trim() || undefined,
        proofAttachmentId: proofId || undefined,
      })
    )
      onClose()
  }
  return (
    <AppDialog
      open
      onOpenChange={(next) => !next && !busy && onClose()}
      title={`Confirm that ${record.workerName} received ${formatPeso(record.amount)}?`}
      description="Save receipt confirmation with an acknowledgement or a proof attached to this transaction."
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label">
          Received date and time
          <input
            className="form-input"
            type="datetime-local"
            step="0.001"
            required
            value={receivedAt}
            disabled={busy}
            onChange={(event) => setReceivedAt(event.target.value)}
          />
        </label>
        <label className="field-label">
          Receipt proof
          <select
            className="form-input"
            aria-label="Receipt proof"
            value={proofId}
            disabled={busy || proofs.isPending}
            onChange={(event) => setProofId(event.target.value)}
          >
            <option value="">Use acknowledgement or select proof</option>
            {proofs.data?.items.map((proof) => (
              <option key={proof.id} value={proof.id}>
                {proof.fileName}
              </option>
            ))}
          </select>
        </label>
        {!proofs.isPending && !proofs.data?.items.length && !proofs.isError && (
          <p className="form-helper">
            No proof has been uploaded. Attach proof from the allowance details or record the
            acknowledgement below.
          </p>
        )}
        {proofs.isError && (
          <div className="field-error" role="alert">
            Receipt proof could not be loaded.
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void proofs.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        <label className="field-label">
          Worker acknowledgement / reference
          <textarea
            className="form-input"
            rows={3}
            maxLength={1000}
            value={acknowledgement}
            disabled={busy}
            onChange={(event) => setAcknowledgement(event.target.value)}
          />
        </label>
        {(validationError || error) && (
          <p className="field-error" role="alert">
            {validationError || error}
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
