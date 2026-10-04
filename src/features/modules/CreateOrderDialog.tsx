import { FormField } from '@/components/common/FormField'
import { useRef } from 'react'

import { FormOptionsState } from '@/components/common/FormOptionsState'

import { useFieldArray, useForm, useWatch } from 'react-hook-form'

import { Minus, Plus } from 'lucide-react'

import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'

import type { CreateOrderValues, OrderOptions } from './types'

import { estimateOrderTotal, formatPeso, fromMinorUnits, toMinorUnits } from './order-decimals'

type CreateOrderDialogProps = {
  open: boolean

  onOpenChange: (open: boolean) => void

  onCreate: (values: CreateOrderValues) => Promise<boolean>

  options?: OrderOptions

  isLoadingOptions: boolean

  optionsError?: string

  onRetryOptions: () => void

  saveError?: string
}

export function CreateOrderDialog({
  open,

  onOpenChange,

  onCreate,

  options,

  isLoadingOptions,

  optionsError,

  onRetryOptions,

  saveError,
}: CreateOrderDialogProps) {
  const submittedIntent = useRef<{ payload: string; requestKey: string } | null>(null)
  const {
    control,

    register,

    handleSubmit,

    reset,

    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateOrderValues>({
    defaultValues: {
      customerId: '',

      branchId: '',

      items: [{ productId: '', quantity: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const items = useWatch({ control, name: 'items' })

  const canSubmit = Boolean(
    options?.customers.length && options.branches.length && options.products.length,
  )

  const estimatedTotal = estimateOrderTotal(items ?? [], options?.products ?? [])

  const submit = handleSubmit(async (values) => {
    const normalized = {
      customerId: values.customerId.toLowerCase(),
      branchId: values.branchId.toLowerCase(),
      items: values.items
        .map((item) => ({
          productId: item.productId.toLowerCase(),
          quantity: fromMinorUnits(toMinorUnits(item.quantity, 3), 3),
        }))
        .sort((first, second) => first.productId.localeCompare(second.productId)),
    }
    const payload = JSON.stringify(normalized)
    if (submittedIntent.current?.payload !== payload) {
      submittedIntent.current = { payload, requestKey: crypto.randomUUID() }
    }
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

      title="Create order"

      description="Add one or more products. Stock is reserved for every line in one transaction."

      size="lg"
      hasUnsavedChanges={isDirty}
    >
      <form className="dialog-form" onSubmit={submit} aria-busy={isSubmitting}>
        <div className="transfer-branch-fields">
          <FormField label="Customer" required error={errors.customerId?.message}>
            {(attributes) => (
              <select
                {...attributes}

                className="form-input"

                autoFocus

                disabled={isLoadingOptions || isSubmitting || !options}

                {...register('customerId', { required: 'Choose a customer.' })}
              >
                <option value="">Select customer</option>

                {options?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Branch" required error={errors.branchId?.message}>
            {(attributes) => (
              <select
                {...attributes}

                className="form-input"

                disabled={isLoadingOptions || isSubmitting || !options}

                {...register('branchId', { required: 'Choose a branch.' })}
              >
                <option value="">Select branch</option>

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
          <strong>Order items</strong>

          <button
            type="button"

            className="button button-quiet button-small"

            disabled={isSubmitting || !options?.products.length}

            onClick={() => append({ productId: '', quantity: '' })}
          >
            <Plus size={14} /> Add product
          </button>
        </div>

        {fields.map((field, index) => (
          <div className="order-item-row" key={field.id}>
            <FormField label="Product" required error={errors.items?.[index]?.productId?.message}>
              {(attributes) => (
                <select
                  {...attributes}

                  className="form-input"

                  disabled={isLoadingOptions || isSubmitting || !options}

                  {...register(`items.${index}.productId`, {
                    required: 'Choose a product.',

                    validate: (value, values) =>
                      values.items.findIndex((item) => item.productId === value) === index ||
                      'Each product can only appear once.',
                  })}
                >
                  <option value="">Select product</option>

                  {options?.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku} · {product.unit} ·{' '}
                      {formatCurrency(product.unitPrice)}
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

                    validate: (value) => Number(value) > 0 || 'Quantity must be greater than zero.',
                  })}

                  placeholder="0.000"
                />
              )}
            </FormField>

            <button
              type="button"

              className="icon-button transfer-remove"

              aria-label={`Remove order item ${index + 1}`}

              disabled={isSubmitting || fields.length === 1}

              onClick={() => remove(index)}
            >
              <Minus size={16} />
            </button>
          </div>
        ))}

        <p className="order-estimate">
          Estimated total <strong>{formatPeso(estimatedTotal)}</strong>
        </p>

        {!isLoadingOptions && !optionsError && !canSubmit && (
          <p className="field-error">
            {options && options.customers.length === 0
              ? 'Add an active customer before creating an order.'
              : 'Active products and a branch are required before creating an order.'}
          </p>
        )}

        <FormOptionsState
          loading={isLoadingOptions}

          error={optionsError}

          loadingText="Loading active order options…"

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

            {isSubmitting ? 'Saving order…' : 'Create order'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}

function formatCurrency(amount: string | number | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number(amount ?? 0),
  )
}
