import { FormField } from '@/components/common/FormField'
import { useRef } from 'react'
import { fromMinorUnits, toMinorUnits } from './order-decimals'

import { FormOptionsState } from '@/components/common/FormOptionsState'

import { useFieldArray, useForm } from 'react-hook-form'

import { Minus, Plus } from 'lucide-react'

import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'

import type { CreateTransferValues, TransferOptions } from './types'

type InventoryTransferDialogProps = {
  open: boolean

  onOpenChange: (open: boolean) => void

  onCreate: (values: CreateTransferValues) => Promise<boolean>

  options?: TransferOptions

  isLoadingOptions: boolean

  optionsError?: string

  onRetryOptions: () => void

  saveError?: string
}

export function InventoryTransferDialog({
  open,

  onOpenChange,

  onCreate,

  options,

  isLoadingOptions,

  optionsError,

  onRetryOptions,

  saveError,
}: InventoryTransferDialogProps) {
  const submittedIntent = useRef<{ payload: string; requestKey: string } | null>(null)
  const {
    control,

    register,

    handleSubmit,

    reset,

    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTransferValues>({
    defaultValues: {
      fromBranchId: '',

      toBranchId: '',

      items: [{ productId: '', quantity: '' }],

      note: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const canSubmit = Boolean(options && options.branches.length > 1 && options.products.length > 0)

  const submit = handleSubmit(async (values) => {
    const normalized = {
      fromBranchId: values.fromBranchId,
      toBranchId: values.toBranchId,
      items: values.items
        .map((item) => ({ ...item, quantity: fromMinorUnits(toMinorUnits(item.quantity, 3), 3) }))
        .sort((first, second) => first.productId.localeCompare(second.productId)),
      note: values.note?.trim() ?? '',
    }
    const payload = JSON.stringify(normalized)
    if (submittedIntent.current?.payload !== payload)
      submittedIntent.current = { payload, requestKey: crypto.randomUUID() }
    if (await onCreate({ ...normalized, requestKey: submittedIntent.current.requestKey })) {
      submittedIntent.current = null
      reset()
    }
  })

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return

    onOpenChange(nextOpen)

    if (!nextOpen) {
      submittedIntent.current = null
      reset()
    }
  }

  return (
    <AppDialog
      open={open}

      onOpenChange={handleOpenChange}

      title="New stock transfer"

      description="Move available stock between branches. The transfer posts immediately when saved."

      size="wide"
      hasUnsavedChanges={isDirty}
    >
      <form className="dialog-form" onSubmit={submit} aria-busy={isSubmitting}>
        <div className="transfer-branch-fields">
          <FormField label="From branch" required error={errors.fromBranchId?.message}>
            {(attributes) => (
              <select
                {...attributes}

                className="form-input"

                autoFocus

                disabled={isLoadingOptions || isSubmitting || !options}

                {...register('fromBranchId', { required: 'Choose the source branch.' })}
              >
                <option value="">Select source branch</option>

                {options?.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="To branch" required error={errors.toBranchId?.message}>
            {(attributes) => (
              <select
                {...attributes}

                className="form-input"

                disabled={isLoadingOptions || isSubmitting || !options}

                {...register('toBranchId', {
                  required: 'Choose the destination branch.',

                  validate: (value, formValues) =>
                    value !== formValues.fromBranchId || 'Choose a different destination branch.',
                })}
              >
                <option value="">Select destination branch</option>

                {options?.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <div className="transfer-items-heading">
          <strong>Products</strong>

          <button
            type="button"

            className="button button-quiet button-small"

            disabled={isSubmitting || !options?.products.length || fields.length >= 100}

            onClick={() => append({ productId: '', quantity: '' })}
          >
            <Plus size={14} /> Add product
          </button>
        </div>

        {fields.map((field, index) => (
          <div className="transfer-item-row" key={field.id}>
            <FormField label="Product" required error={errors.items?.[index]?.productId?.message}>
              {(attributes) => (
                <select
                  {...attributes}

                  className="form-input"

                  disabled={isLoadingOptions || isSubmitting || !options}

                  {...register(`items.${index}.productId`, {
                    required: 'Choose a product.',
                    validate: (value, formValues) =>
                      formValues.items.filter((item) => item.productId === value).length === 1 ||
                      'Each product can only appear once in a transfer.',
                  })}
                >
                  <option value="">Select product</option>

                  {options?.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku} · {product.unit}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField label="Quantity" required error={errors.items?.[index]?.quantity?.message}>
              {(attributes) => (
                <input
                  {...attributes}

                  className="form-input"

                  type="number"

                  min="0.001"
                  max="1000000"

                  step="0.001"

                  disabled={isSubmitting}

                  {...register(`items.${index}.quantity`, {
                    required: 'Enter a quantity.',

                    validate: (value) => {
                      try {
                        const milli = toMinorUnits(value, 3)
                        return (
                          (milli > 0n && milli <= 1_000_000_000n) ||
                          'Use a quantity greater than zero and up to 1,000,000.'
                        )
                      } catch {
                        return 'Use a number with at most three decimal places.'
                      }
                    },
                  })}

                  placeholder="0.000"
                />
              )}
            </FormField>

            <button
              type="button"

              className="icon-button transfer-remove"

              aria-label={`Remove product ${index + 1}`}

              disabled={isSubmitting || fields.length === 1}

              onClick={() => remove(index)}
            >
              <Minus size={16} />
            </button>
          </div>
        ))}

        <FormField label="Note">
          {(attributes) => (
            <input
              className="form-input"

              disabled={isSubmitting}

              maxLength={500}

              {...attributes}

              {...register('note')}

              placeholder="Optional transfer note"
            />
          )}
        </FormField>

        {!isLoadingOptions && !optionsError && !canSubmit && (
          <p className="field-error">
            {options?.branches.length === 1
              ? 'Two active branches are required to transfer stock.'
              : 'No active products or branches are available for a transfer.'}
          </p>
        )}

        <FormOptionsState
          loading={isLoadingOptions}

          error={optionsError}

          loadingText="Loading active products and branches…"

          onRetry={onRetryOptions}
        />

        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}

        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />

          <button
            type="submit"

            className="button button-primary"

            disabled={isSubmitting || isLoadingOptions || Boolean(optionsError) || !canSubmit}
          >
            <Plus size={16} />

            {isSubmitting ? 'Saving transfer…' : 'Complete transfer'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
