import { useId, useRef, useState, type FormEvent } from 'react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { formatQuantity, fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import type { InventoryRecord, StockCorrectionValues } from './types'

export function StockCorrectionDialog({
  inventory,
  addition,
  busy,
  error,
  onClose,
  onSave,
}: {
  inventory: InventoryRecord
  addition: { id: string; quantity: string }
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: StockCorrectionValues) => Promise<boolean>
}) {
  const id = useId()
  const [quantity, setQuantity] = useState(addition.quantity)
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const intent = useRef<{ payload: string; requestKey: string } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setValidationError(null)
    let milli: bigint
    try {
      milli = toMinorUnits(quantity, 3)
      if (milli < 0n || milli > 1_000_000_000n || milli === toMinorUnits(addition.quantity, 3))
        throw new Error()
    } catch {
      setValidationError(
        'Enter a different quantity between 0 and 1,000,000, with at most three decimal places.',
      )
      return
    }
    if (reason.trim().length < 3) {
      setValidationError('Explain the correction using at least three characters.')
      return
    }
    const values = {
      transactionId: addition.id,
      correctedQuantity: fromMinorUnits(milli, 3),
      reason: reason.trim(),
    }
    const payload = JSON.stringify(values)
    if (intent.current?.payload !== payload)
      intent.current = { payload, requestKey: crypto.randomUUID() }
    if (await onSave({ ...values, requestKey: intent.current.requestKey })) onClose()
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Correct latest stock addition"
      description={`${inventory.productName} · ${inventory.branchName}`}
      size="md"
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <p className="form-helper">
          Original addition:{' '}
          <strong>
            {formatQuantity(addition.quantity)} {inventory.unit}
          </strong>
          . This corrects the addition quantity, not the total on hand. The original entry remains
          in history with a linked correction. If stock has moved since this addition, use a stock
          adjustment.
        </p>
        <label className="field-label" htmlFor={`${id}-quantity`}>
          <FieldHeading required>Corrected addition quantity</FieldHeading>
          <input
            id={`${id}-quantity`}
            className="form-input"
            type="number"
            inputMode="decimal"
            min="0"
            max="1000000"
            step="0.001"
            required
            disabled={busy}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="field-label" htmlFor={`${id}-reason`}>
          <FieldHeading required>Reason</FieldHeading>
          <textarea
            id={`${id}-reason`}
            className="form-input"
            rows={3}
            minLength={3}
            maxLength={500}
            required
            disabled={busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {(validationError || error) && (
          <p className="form-error" role="alert">
            {validationError || error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
