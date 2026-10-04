import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { formatQuantity, fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import type { InventoryRecord } from './types'

export function ReorderPointDialog({
  inventory,
  busy,
  error,
  onClose,
  onSave,
}: {
  inventory: InventoryRecord
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (value: string) => Promise<boolean>
}) {
  const id = useId()
  const [value, setValue] = useState(inventory.reorderLevel)
  const [validationError, setValidationError] = useState<string | null>(null)
  useEffect(() => {
    setValue(inventory.reorderLevel)
  }, [inventory.id, inventory.reorderLevel])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setValidationError(null)
    let milli: bigint
    try {
      milli = toMinorUnits(value, 3)
      if (milli > 1_000_000_000n) throw new Error()
    } catch {
      setValidationError(
        'Enter a reorder point from zero to 1,000,000, with at most three decimal places.',
      )
      return
    }
    if (await onSave(fromMinorUnits(milli, 3))) onClose()
  }

  return (
    <AppDialog
      open
      onOpenChange={(next) => !next && !busy && onClose()}
      title="Edit reorder point"
      description={`${inventory.productName} · ${inventory.branchName}`}
      size="md"
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label inventory-quantity-field" htmlFor={id}>
          <FieldHeading required>Reorder point</FieldHeading>
          <input
            id={id}
            aria-label="Reorder point"
            className="form-input"
            type="number"
            inputMode="decimal"
            min="0"
            max="1000000"
            step="0.001"
            required
            value={value}
            disabled={busy}
            onChange={(event) => setValue(event.target.value)}
          />
          <span className="form-helper">
            Measured in {inventory.unit}. Current point: {formatQuantity(inventory.reorderLevel)}.
          </span>
        </label>
        <p className="form-helper">
          Positive on-hand stock at or below this point is marked Low stock. Zero stock is marked
          Out of stock. This setting does not change quantities.
        </p>
        {(validationError || error) && (
          <p className="field-error" role="alert">
            {validationError || error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save reorder point'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
