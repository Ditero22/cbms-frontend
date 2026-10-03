import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { getInventoryOptions } from '@/features/modules/modules.api'
import { fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import type { InventoryRecord, StockAdjustmentValues } from './types'

export function StockAdjustmentDialog({
  open,
  inventory,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean
  inventory: InventoryRecord | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: StockAdjustmentValues) => Promise<boolean>
}) {
  const id = useId()
  const [productId, setProductId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const submittedIntent = useRef<{ payload: string; requestKey: string } | null>(null)
  const options = useQuery({
    queryKey: ['inventory-options'],
    queryFn: getInventoryOptions,
    enabled: open,
  })
  useEffect(() => {
    if (!open) return
    setProductId(inventory?.productId ?? '')
    setBranchId(inventory?.branchId ?? '')
    setDirection('add')
    setQuantity('')
    setNote('')
    setValidationError(null)
    submittedIntent.current = null
  }, [open, inventory])
  const selectedProduct = options.data?.products.find((product) => product.id === productId)
  const choicesUnavailable = options.isPending || options.isError

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setValidationError(null)
    if (!options.data || choicesUnavailable) return
    if (
      !options.data.products.some((product) => product.id === productId) ||
      !options.data.branches.some((branch) => branch.id === branchId)
    ) {
      setValidationError(
        'Select an active product and branch. Archived records cannot be adjusted.',
      )
      return
    }
    let milli: bigint
    try {
      milli = toMinorUnits(quantity, 3)
      if (milli <= 0n || milli > 1_000_000_000n) throw new Error()
    } catch {
      setValidationError(
        'Enter a quantity greater than zero and up to 1,000,000, with at most three decimal places.',
      )
      return
    }
    const values = {
      productId,
      branchId,
      quantityDelta: fromMinorUnits(direction === 'remove' ? -milli : milli, 3),
      note: note.trim(),
    }
    const payload = JSON.stringify(values)
    if (submittedIntent.current?.payload !== payload)
      submittedIntent.current = { payload, requestKey: crypto.randomUUID() }
    if (await onSave({ ...values, requestKey: submittedIntent.current.requestKey })) {
      submittedIntent.current = null
      onClose()
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      title="Adjust stock"
      description="Record a stock correction for a product at one branch."
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <div className="dialog-field-grid">
          <label className="field-label" htmlFor={`${id}-product`}>
            <FieldHeading required>Product</FieldHeading>
            <select
              id={`${id}-product`}
              aria-label="Product"
              className="form-input"
              value={productId}
              required
              disabled={busy || choicesUnavailable}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Select product</option>
              {inventory &&
                !options.data?.products.some((product) => product.id === inventory.productId) && (
                  <option value={inventory.productId}>
                    {inventory.productName} · {inventory.sku}
                  </option>
                )}
              {options.data?.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label" htmlFor={`${id}-branch`}>
            <FieldHeading required>Branch</FieldHeading>
            <select
              id={`${id}-branch`}
              aria-label="Branch"
              className="form-input"
              value={branchId}
              required
              disabled={busy || choicesUnavailable}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Select branch</option>
              {inventory &&
                !options.data?.branches.some((branch) => branch.id === inventory.branchId) && (
                  <option value={inventory.branchId}>{inventory.branchName}</option>
                )}
              {options.data?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {options.isPending && (
          <p className="form-helper" role="status">
            Loading products and branches…
          </p>
        )}
        {options.isError && (
          <div className="inventory-form-error" role="alert">
            <span>Could not load products and branches. {options.error.message}</span>
            <button
              type="button"
              className="button button-outline button-small"
              disabled={options.isFetching}
              onClick={() => void options.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        <fieldset className="inventory-adjustment-type" disabled={busy}>
          <legend>Adjustment type</legend>
          <label>
            <input
              type="radio"
              name={`${id}-direction`}
              value="add"
              checked={direction === 'add'}
              onChange={() => setDirection('add')}
            />
            Add stock
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-direction`}
              value="remove"
              checked={direction === 'remove'}
              onChange={() => setDirection('remove')}
            />
            Remove stock
          </label>
        </fieldset>
        <label className="field-label inventory-quantity-field" htmlFor={`${id}-quantity`}>
          <FieldHeading required>Quantity</FieldHeading>
          <input
            id={`${id}-quantity`}
            aria-label="Quantity"
            className="form-input"
            type="number"
            inputMode="decimal"
            min="0.001"
            max="1000000"
            step="0.001"
            required
            value={quantity}
            disabled={busy}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <span className="form-helper">
            {selectedProduct?.unit ? `Measured in ${selectedProduct.unit}. ` : ''}Enter a positive
            amount; the selected adjustment type sets its direction.
          </span>
        </label>
        <label className="field-label" htmlFor={`${id}-note`}>
          <FieldHeading>Reason / note</FieldHeading>
          <textarea
            id={`${id}-note`}
            aria-label="Reason / note"
            className="form-input"
            rows={3}
            maxLength={500}
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explain the stock correction"
          />
        </label>
        <p className="form-helper">
          Stock reserved for open orders cannot be removed. Every correction is recorded in the
          stock movement ledger.
        </p>
        {(validationError || error) && (
          <p className="field-error" role="alert">
            {validationError || error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button
            type="submit"
            className="button button-primary"
            disabled={busy || choicesUnavailable}
          >
            {busy ? 'Saving…' : 'Save adjustment'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
